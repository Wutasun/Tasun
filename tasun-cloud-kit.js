/* =========================================================
 * tasun-cloud-kit.js  (Most compatible - Worker first)
 * - Read config from: tasun-resources.json (default)
 * - Prefer Cloudflare Worker API (apiBase + endpoints.read/merge)
 * - Compatible apply payload: { items, db, rows, counter, ver, updatedAt }
 * - Minimal stable API:
 *   TasunCloudKit.init(), TasunCloudKit.mount()
 *   ctrl.pullNow(), ctrl.saveMerged(), ctrl.status(), ctrl.destroy()
 * ========================================================= */
(function () {
  "use strict";

  // -------------------------------
  // Internal state (singleton)
  // -------------------------------
  var _S = {
    inited: false,
    appVer: "",
    resourcesUrl: "tasun-resources.json",
    ui: { enabled: true, position: "bottom-right" },

    _resourcesCache: null,
    _resourcesUrlCacheKey: "",
    _uiMounted: false,
    _uiEl: null,
    _uiMsgEl: null,
  };

  // -------------------------------
  // Utils
  // -------------------------------
  function norm(s) {
    return s === undefined || s === null ? "" : String(s).trim();
  }
  function nowISO() {
    return new Date().toISOString();
  }
  function addV(url) {
    url = norm(url);
    var v = norm(_S.appVer);
    if (!url || !v) return url;
    try {
      var u = new URL(url, location.href);
      if (!u.searchParams.get("v")) u.searchParams.set("v", v);
      return u.toString();
    } catch (e) {
      return url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(v);
    }
  }
  function safeJSONParse(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }
  function shallowClone(x) {
    if (!x || typeof x !== "object") return x;
    if (Array.isArray(x)) return x.slice();
    var o = {};
    for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k];
    return o;
  }

  function joinUrl(base, path) {
    base = norm(base).replace(/\/+$/, "");
    path = norm(path);
    if (!path) return base;
    if (path[0] !== "/") path = "/" + path;
    return base + path;
  }

  // -------------------------------
  // Minimal UI (optional)
  // -------------------------------
  function uiEnsure() {
    if (!_S.ui || !_S.ui.enabled) return;
    if (_S._uiMounted) return;
    _S._uiMounted = true;

    try {
      var box = document.createElement("div");
      box.setAttribute("data-tasun-cloud-ui", "1");
      box.style.cssText =
        "position:fixed; z-index:99999;" +
        (_S.ui.position === "bottom-left" ? "left:12px;" : "right:12px;") +
        "bottom:12px;" +
        "font: 12px/1.4 system-ui, -apple-system, Segoe UI, Arial;" +
        "background: rgba(18,22,20,.72);" +
        "border: 1px solid rgba(246,214,150,.22);" +
        "border-radius: 999px;" +
        "padding: 8px 10px;" +
        "color: rgba(246,214,150,.96);" +
        "box-shadow: 0 14px 35px rgba(0,0,0,.25);" +
        "backdrop-filter: blur(6px);" +
        "display:flex; align-items:center; gap:8px;" +
        "user-select:none;";

      var dot = document.createElement("span");
      dot.style.cssText =
        "width:8px;height:8px;border-radius:999px;background:rgba(255,255,255,.35);" +
        "box-shadow: 0 0 0 2px rgba(255,255,255,.08) inset;";
      box.appendChild(dot);

      var msg = document.createElement("span");
      msg.textContent = "CloudKit ready";
      msg.style.cssText = "white-space:nowrap;";
      box.appendChild(msg);

      document.body.appendChild(box);
      _S._uiEl = box;
      _S._uiMsgEl = msg;

      uiSet("CloudKit ready");
    } catch (e) {}
  }

  function uiSet(text) {
    if (!_S._uiMsgEl) return;
    try {
      _S._uiMsgEl.textContent = String(text || "");
    } catch (e) {}
  }

  function uiPulse(ok) {
    if (!_S._uiEl) return;
    try {
      var dot = _S._uiEl.firstChild;
      if (dot && dot.style) {
        dot.style.background = ok ? "rgba(120,255,190,.75)" : "rgba(255,160,160,.75)";
      }
      setTimeout(function () {
        if (dot && dot.style) {
          dot.style.background = "rgba(255,255,255,.35)";
        }
      }, 550);
    } catch (e) {}
  }

  // -------------------------------
  // Resources loader (tasun-resources.json)
  // -------------------------------
  async function loadResources() {
    var url = addV(_S.resourcesUrl || "tasun-resources.json");
    var cacheKey = url;

    if (_S._resourcesCache && _S._resourcesUrlCacheKey === cacheKey) {
      return _S._resourcesCache;
    }

    var resp = await fetch(url, { cache: "no-store" });
    var text = await resp.text();
    var json = safeJSONParse(text);

    if (!resp.ok || !json || typeof json !== "object") {
      throw new Error("Failed to load resources: " + url);
    }

    // Compatible: { resources:{...} } or direct { key:{...} }
    if (json.resources && typeof json.resources === "object") json = json.resources;

    _S._resourcesCache = json;
    _S._resourcesUrlCacheKey = cacheKey;
    return json;
  }

  function extractItems(any) {
    if (Array.isArray(any)) return any;
    if (any && typeof any === "object") {
      if (Array.isArray(any.items)) return any.items;
      if (Array.isArray(any.db)) return any.db;
      if (Array.isArray(any.rows)) return any.rows;
      if (Array.isArray(any.data)) return any.data;
      // allow single object
      return [any];
    }
    return [];
  }

  function ensureId(item, pkField) {
    if (!item || typeof item !== "object") return item;
    if (item.id) return item;
    pkField = norm(pkField || "id");
    if (pkField && item[pkField] !== undefined && item[pkField] !== null && String(item[pkField]).trim() !== "") {
      item.id = String(item[pkField]).trim();
      return item;
    }
    try {
      item.id = crypto.randomUUID();
    } catch (e) {
      item.id = String(Date.now()) + "_" + Math.random().toString(16).slice(2);
    }
    return item;
  }

  function toApplyPayload(remoteObj) {
    // remoteObj may be {ver, updatedAt, items} or others
    var items = extractItems(remoteObj);
    return {
      ver: remoteObj && remoteObj.ver !== undefined ? remoteObj.ver : 1,
      updatedAt: (remoteObj && remoteObj.updatedAt) ? remoteObj.updatedAt : nowISO(),
      items: items,
      // compat aliases:
      db: items,
      rows: items,
      counter: items.length
    };
  }

  // -------------------------------
  // Worker API
  // -------------------------------
  async function workerRead(entry) {
    var apiBase = norm(entry.apiBase);
    var ep = (entry.endpoints && typeof entry.endpoints === "object") ? entry.endpoints : {};
    var readPath = norm(ep.read || "/api/read");
    var url = joinUrl(apiBase, readPath);

    var r = await fetch(url, { cache: "no-store" });
    var t = await r.text();
    var j = safeJSONParse(t);

    if (!r.ok) {
      throw new Error("Worker read failed: " + r.status + " " + (t || ""));
    }
    if (!j) {
      // allow empty or non-json
      return { ver: 1, updatedAt: nowISO(), items: [] };
    }
    return j;
  }

  async function workerMerge(entry, items) {
    var apiBase = norm(entry.apiBase);
    var ep = (entry.endpoints && typeof entry.endpoints === "object") ? entry.endpoints : {};
    var mergePath = norm(ep.merge || "/api/merge");
    var url = joinUrl(apiBase, mergePath);

    var body = { items: items };

    var r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    var t = await r.text();
    var j = safeJSONParse(t);

    if (!r.ok) {
      throw new Error("Worker merge failed: " + r.status + " " + (t || ""));
    }
    return j || { ok: true };
  }

  // -------------------------------
  // Public API
  // -------------------------------
  function init(cfg) {
    cfg = (cfg && typeof cfg === "object") ? cfg : {};

    if (cfg.appVer !== undefined) _S.appVer = norm(cfg.appVer);
    if (cfg.resourcesUrl !== undefined) _S.resourcesUrl = norm(cfg.resourcesUrl) || "tasun-resources.json";
    if (cfg.ui && typeof cfg.ui === "object") _S.ui = Object.assign({}, _S.ui, cfg.ui);

    _S.inited = true;
    uiEnsure();
    uiSet("CloudKit inited");
    return true;
  }

  function mount(cfg) {
    cfg = (cfg && typeof cfg === "object") ? cfg : {};
    if (!_S.inited) init({});

    uiEnsure();

    var resourceKey = norm(cfg.resourceKey);
    var pkField = norm(cfg.pk || cfg.pkField || "id"); // used to derive id if missing
    var watchCfg = cfg.watch || { intervalSec: 0 };
    var getLocal = (typeof cfg.getLocal === "function") ? cfg.getLocal : function () { return { items: [] }; };
    var apply = (typeof cfg.apply === "function") ? cfg.apply : function () {};

    var protectEmptyRemote = (cfg.protectEmptyRemote !== undefined) ? !!cfg.protectEmptyRemote : true;

    var destroyed = false;
    var timer = null;
    var lastStatus = {
      mode: "init",
      resourceKey: resourceKey,
      apiBase: "",
      lastPullAt: 0,
      lastSaveAt: 0,
      lastError: "",
      watchSec: Number((watchCfg && watchCfg.intervalSec) || 0),
      appVer: norm(_S.appVer),
      resourcesUrl: norm(_S.resourcesUrl),
    };

    var readyResolve;
    var ready = new Promise(function (res) { readyResolve = res; });

    // serialize ops
    var _chain = Promise.resolve();
    function enqueue(fn) {
      _chain = _chain.then(function () {
        if (destroyed) return;
        return fn();
      }).catch(function (e) {
        lastStatus.lastError = (e && e.message) ? String(e.message) : String(e || "");
      });
      return _chain;
    }

    function status() { return shallowClone(lastStatus); }

    function destroy() {
      destroyed = true;
      if (timer) clearInterval(timer);
      timer = null;
      lastStatus.mode = "destroyed";
      uiSet(resourceKey ? ("CloudKit: " + resourceKey + " stopped") : "CloudKit stopped");
    }

    function safeApply(anyPayload, info) {
      try {
        apply(toApplyPayload(anyPayload), info || {});
      } catch (e) {}
    }

    async function resolveEntry() {
      var resources = await loadResources();
      var entry = resources && resources[resourceKey];
      if (!entry) throw new Error("Resource not found in resources.json: " + resourceKey);
      if (!entry.apiBase) throw new Error("Resource missing apiBase: " + resourceKey);
      lastStatus.apiBase = norm(entry.apiBase);
      return entry;
    }

    function isRemoteEmpty(remoteObj) {
      var items = extractItems(remoteObj);
      return !items || items.length === 0;
    }

    function isLocalNotEmpty(localObj) {
      var items = extractItems(localObj);
      return !!(items && items.length > 0);
    }

    function pullNow() {
      return enqueue(async function () {
        if (destroyed) return;

        lastStatus.lastError = "";
        uiSet("CloudKit: pulling " + resourceKey);

        try {
          var entry = await resolveEntry();
          var remote = await workerRead(entry);

          // protect empty remote: keep local, then seed once
          if (protectEmptyRemote) {
            var local = getLocal() || { items: [] };
            if (isRemoteEmpty(remote) && isLocalNotEmpty(local)) {
              var seedKey = "tasunCloudKit_seeded__" + resourceKey + "__" + norm(_S.appVer || "");
              if (!sessionStorage.getItem(seedKey)) {
                sessionStorage.setItem(seedKey, "1");
                safeApply(local, { source: "remote-empty-protected", reason: "keep-local" });
                lastStatus.mode = "remote-empty-protected";
                lastStatus.lastPullAt = Date.now();
                uiSet("CloudKit: remote empty → keep local");
                uiPulse(true);

                // seed to remote (non-blocking in queue)
                saveMerged({ reason: "seed-empty-remote" });
                return;
              }
            }
          }

          safeApply(remote, { source: "remote", fetchedAt: Date.now() });
          lastStatus.mode = "synced";
          lastStatus.lastPullAt = Date.now();
          uiSet("CloudKit: pulled " + resourceKey);
          uiPulse(true);
        } catch (e) {
          lastStatus.lastError = (e && e.message) ? String(e.message) : String(e || "");
          lastStatus.mode = "error";
          uiSet("CloudKit: pull error");
          uiPulse(false);
          console.warn("[TasunCloudKit] pullNow error:", lastStatus.lastError);

          // fallback apply local to avoid blank
          try {
            safeApply(getLocal() || { items: [] }, { source: "local-fallback", error: lastStatus.lastError });
          } catch (_e) {}
        }
      });
    }

    function saveMerged(opts) {
      opts = opts || {};
      return enqueue(async function () {
        if (destroyed) return false;

        lastStatus.lastError = "";
        uiSet("CloudKit: saving " + resourceKey);

        try {
          var entry = await resolveEntry();

          // local -> items
          var localObj = getLocal() || { items: [] };
          var items = extractItems(localObj) || [];
          // ensure id
          for (var i = 0; i < items.length; i++) {
            if (items[i] && typeof items[i] === "object") {
              ensureId(items[i], pkField);
              if (!items[i].createdAt) items[i].createdAt = nowISO();
              items[i].updatedAt = nowISO();
            }
          }

          // merge on server
          var result = await workerMerge(entry, items);

          lastStatus.mode = "saved";
          lastStatus.lastSaveAt = Date.now();
          uiSet("CloudKit: saved " + resourceKey);
          uiPulse(true);

          // refresh remote -> apply
          await pullNow();
          return result;
        } catch (e) {
          lastStatus.lastError = (e && e.message) ? String(e.message) : String(e || "");
          lastStatus.mode = "error";
          uiSet("CloudKit: save error");
          uiPulse(false);
          console.warn("[TasunCloudKit] saveMerged error:", lastStatus.lastError);
          return false;
        }
      });
    }

    // init async
    (async function () {
      try {
        if (!resourceKey) throw new Error("mount() missing resourceKey");

        uiSet("CloudKit: mounting " + resourceKey);

        // apply local once first
        try { safeApply(getLocal() || { items: [] }, { source: "local-initial" }); } catch (e) {}

        await pullNow();

        var sec = Number((watchCfg && watchCfg.intervalSec) || 0);
        if (Number.isFinite(sec) && sec > 0) {
          timer = setInterval(function () {
            if (destroyed) return;
            pullNow();
          }, Math.max(2000, sec * 1000));
        }

        lastStatus.mode = "ready";
        readyResolve(true);
      } catch (e) {
        lastStatus.lastError = (e && e.message) ? String(e.message) : String(e || "");
        lastStatus.mode = "error";
        uiSet("CloudKit: mount error");
        uiPulse(false);
        console.warn("[TasunCloudKit] mount error:", lastStatus.lastError);
        try { readyResolve(false); } catch (_e) {}
      }
    })();

    return {
      ready: ready,
      pullNow: pullNow,
      saveMerged: saveMerged,
      status: status,
      destroy: destroy,
    };
  }

  // export
  window.TasunCloudKit = {
    init: init,
    mount: mount,
    _debug: {
      state: function () { return shallowClone(_S); }
    }
  };
})();
