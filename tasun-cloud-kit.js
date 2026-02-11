/* =========================================================
 * tasun-cloud-kit.js  (Most compatible - Worker first)
 * - Read config from: tasun-resources.json (default)
 * - Prefer Cloudflare Worker API (apiBase + endpoints.health/read/merge)
 * - Supports Access (cookie or Service Token headers)
 * - Compatible apply payload: { items, db, rows, counter, ver, updatedAt }
 * - Minimal stable API:
 *   TasunCloudKit.init(), TasunCloudKit.mount()
 *   ctrl.pullNow(), ctrl.saveMerged(), ctrl.status(), ctrl.destroy()
 * - Extra helpers:
 *   TasunCloudKit.getConfig(resourceKey)
 *   TasunCloudKit.applyCloudConfigFromResources(pageKey, hooks)
 *
 * ✅IMPORTANT (Global rule):
 * - pk is FORCED to "id" for ALL pages (no pk="k" allowed).
 * - Any mount({pk:"k"}) will be ignored to keep D1 merge fully consistent.
 * - Backward-compat: if item.id missing but item.k / item.key exists, we set item.id = item.k/key.
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
    resourcesInline: null, // optional object (for file:// fallback)
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
    var v = norm(_S.appVer) || norm(window.TASUN_APP_VER);
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
  function withQuery(url, kv) {
    try {
      var u = new URL(url, location.href);
      for (var k in kv) {
        if (!Object.prototype.hasOwnProperty.call(kv, k)) continue;
        if (!u.searchParams.get(k) && kv[k] !== undefined && kv[k] !== null && String(kv[k]).trim() !== "") {
          u.searchParams.set(k, String(kv[k]));
        }
      }
      return u.toString();
    } catch (e) {
      // naive fallback (only for 'key')
      if (kv && kv.key && url.indexOf("key=") < 0) {
        return url + (url.indexOf("?") >= 0 ? "&" : "?") + "key=" + encodeURIComponent(String(kv.key));
      }
      return url;
    }
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
    // inline first (if provided)
    if (_S.resourcesInline && typeof _S.resourcesInline === "object") {
      if (!_S._resourcesCache) {
        _S._resourcesCache = _S.resourcesInline;
        _S._resourcesUrlCacheKey = "inline";
      }
      return _S._resourcesCache;
    }

    var url = addV(_S.resourcesUrl || "tasun-resources.json");
    var cacheKey = url;

    if (_S._resourcesCache && _S._resourcesUrlCacheKey === cacheKey) {
      return _S._resourcesCache;
    }

    var resp, text, json;
    try {
      resp = await fetch(url, { cache: "no-store" });
      text = await resp.text();
      json = safeJSONParse(text);
    } catch (e) {
      // file:// may fail: fallback to inline if exists
      if (_S.resourcesInline && typeof _S.resourcesInline === "object") return _S.resourcesInline;
      throw new Error("Failed to load resources (fetch): " + url);
    }

    if (!resp || !resp.ok || !json || typeof json !== "object") {
      throw new Error("Failed to load resources: " + url);
    }

    // Compatible: { resources:{...} } or direct { key:{...} }
    if (json.resources && typeof json.resources === "object") json = json.resources;

    _S._resourcesCache = json;
    _S._resourcesUrlCacheKey = cacheKey;
    return json;
  }

  function normalizeEntry(resourceKey, entry) {
    entry = (entry && typeof entry === "object") ? entry : {};
    var out = shallowClone(entry) || {};
    out.resourceKey = resourceKey;

    // normalize apiBase
    if (out.apiBase && typeof out.apiBase === "string") {
      out.apiBase = out.apiBase.trim().replace(/\/+$/, "");
    }

    // normalize endpoints
    var ep = (out.endpoints && typeof out.endpoints === "object") ? shallowClone(out.endpoints) : {};
    out.endpoints = {
      health: norm(ep.health || "/health"),
      read: norm(ep.read || "/api/read"),
      merge: norm(ep.merge || "/api/merge"),
    };

    return out;
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

  // ✅ pk is forced to "id". We still support stable id fallback for key-value items.
  function ensureId(item) {
    if (!item || typeof item !== "object") return item;

    // already has id
    if (item.id !== undefined && item.id !== null && norm(item.id) !== "") return item;

    // fallback order (backward compat)
    var cand =
      (item.k !== undefined && item.k !== null && norm(item.k) !== "") ? item.k :
      (item.key !== undefined && item.key !== null && norm(item.key) !== "") ? item.key :
      (item.pk !== undefined && item.pk !== null && norm(item.pk) !== "") ? item.pk :
      (item._id !== undefined && item._id !== null && norm(item._id) !== "") ? item._id :
      "";

    if (norm(cand)) {
      item.id = String(cand).trim();
      return item;
    }

    // generate
    try {
      item.id = crypto.randomUUID();
    } catch (e) {
      item.id = String(Date.now()) + "_" + Math.random().toString(16).slice(2);
    }
    return item;
  }

  function toApplyPayload(remoteObj) {
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
  // Access helpers (cookie or Service Token headers)
  // -------------------------------
  function parseTokenRaw(raw) {
    raw = norm(raw);
    if (!raw) return null;
    var obj = safeJSONParse(raw);
    if (obj && typeof obj === "object") {
      var id = norm(obj.clientId || obj.id || obj.client_id || "");
      var sec = norm(obj.clientSecret || obj.secret || obj.client_secret || "");
      if (id && sec) return { clientId: id, clientSecret: sec };
    }
    var parts = raw.split(/[\s|,;]+/).map(norm).filter(Boolean);
    if (parts.length >= 2) return { clientId: parts[0], clientSecret: parts[1] };
    return null;
  }

  function resolveAccessToken(storageKey, forceToken) {
    try {
      if (forceToken) {
        if (typeof forceToken === "string") return parseTokenRaw(forceToken);
        if (forceToken && typeof forceToken === "object") {
          var idf = norm(forceToken.clientId || forceToken.id || forceToken.client_id || "");
          var secf = norm(forceToken.clientSecret || forceToken.secret || forceToken.client_secret || "");
          if (idf && secf) return { clientId: idf, clientSecret: secf };
        }
      }
    } catch (e) {}

    try {
      var w = window.TASUN_ACCESS_SERVICE_TOKEN;
      if (w && typeof w === "object") {
        var idw = norm(w.clientId || w.client_id || "");
        var secw = norm(w.clientSecret || w.client_secret || "");
        if (idw && secw) return { clientId: idw, clientSecret: secw };
      }
      if (typeof w === "string") {
        var t = parseTokenRaw(w);
        if (t) return t;
      }
    } catch (e2) {}

    storageKey = norm(storageKey) || "tasunAccessServiceToken_v1";
    try {
      var s1 = parseTokenRaw(sessionStorage.getItem(storageKey));
      if (s1) return s1;
    } catch (e3) {}
    try {
      var s2 = parseTokenRaw(localStorage.getItem(storageKey));
      if (s2) return s2;
    } catch (e4) {}

    return null;
  }

  function buildHeaders(extra, accessToken, meta) {
    var h = {};
    h["Accept"] = "application/json";
    if (meta && typeof meta === "object") {
      if (meta.appVer) h["X-Tasun-AppVer"] = String(meta.appVer);
      if (meta.page) h["X-Tasun-Page"] = String(meta.page);
      if (meta.user) h["X-Tasun-User"] = String(meta.user);
      if (meta.role) h["X-Tasun-Role"] = String(meta.role);
    }
    if (accessToken && accessToken.clientId && accessToken.clientSecret) {
      h["CF-Access-Client-Id"] = accessToken.clientId;
      h["CF-Access-Client-Secret"] = accessToken.clientSecret;
    }
    if (extra && typeof extra === "object") {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
    }
    return h;
  }

  // -------------------------------
  // Worker API
  // -------------------------------
  async function workerRead(entry, resourceKey, accessToken, meta) {
    var apiBase = norm(entry.apiBase);
    var ep = (entry.endpoints && typeof entry.endpoints === "object") ? entry.endpoints : {};
    var readPath = norm(ep.read || "/api/read");
    var url = joinUrl(apiBase, readPath);
    url = withQuery(url, { key: resourceKey });

    var r = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: (accessToken && accessToken.clientId) ? "omit" : "include",
      headers: buildHeaders(null, accessToken, meta)
    });

    var t = await r.text();
    var j = safeJSONParse(t);

    if (!r.ok) {
      throw new Error("Worker read failed: " + r.status + " " + (t || ""));
    }
    if (!j) {
      return { ver: 1, updatedAt: nowISO(), items: [] };
    }
    return j;
  }

  async function workerMerge(entry, resourceKey, items, accessToken, meta) {
    var apiBase = norm(entry.apiBase);
    var ep = (entry.endpoints && typeof entry.endpoints === "object") ? entry.endpoints : {};
    var mergePath = norm(ep.merge || "/api/merge");
    var url = joinUrl(apiBase, mergePath);

    // ✅ pk forced to "id"
    var body = {
      key: resourceKey,
      pk: "id",
      items: items,
      client: {
        ts: Date.now(),
        appVer: norm(_S.appVer) || norm(window.TASUN_APP_VER),
        ua: (typeof navigator !== "undefined" ? navigator.userAgent : "")
      }
    };

    var r = await fetch(url, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      credentials: (accessToken && accessToken.clientId) ? "omit" : "include",
      headers: buildHeaders({ "Content-Type": "application/json" }, accessToken, meta),
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
  // Public helpers
  // -------------------------------
  async function getConfig(resourceKey, opt) {
    opt = (opt && typeof opt === "object") ? opt : {};
    if (!_S.inited) init({});

    if (opt.resourcesUrl !== undefined) _S.resourcesUrl = norm(opt.resourcesUrl) || "tasun-resources.json";
    if (opt.resourcesInline && typeof opt.resourcesInline === "object") _S.resourcesInline = opt.resourcesInline;

    var resources = await loadResources();
    var entry = resources && resources[resourceKey];
    if (!entry) throw new Error("Resource not found in tasun-resources.json: " + resourceKey);
    return normalizeEntry(resourceKey, entry);
  }

  async function applyCloudConfigFromResources(pageKey, hooks) {
    hooks = (hooks && typeof hooks === "object") ? hooks : {};
    pageKey = norm(pageKey);
    if (!pageKey) return false;

    try {
      var cfg = await getConfig(pageKey, { resourcesUrl: hooks.resourcesUrl, resourcesInline: hooks.resourcesInline });
      if (typeof hooks.setApiBase === "function" && cfg.apiBase) hooks.setApiBase(cfg.apiBase);
      if (typeof hooks.setEndpoints === "function" && cfg.endpoints) hooks.setEndpoints(shallowClone(cfg.endpoints));
      return true;
    } catch (e) {
      return false;
    }
  }

  // -------------------------------
  // Public API
  // -------------------------------
  function init(cfg) {
    cfg = (cfg && typeof cfg === "object") ? cfg : {};

    if (!_S.appVer) _S.appVer = norm(window.TASUN_APP_VER);

    if (cfg.appVer !== undefined) _S.appVer = norm(cfg.appVer);
    if (cfg.resourcesUrl !== undefined) _S.resourcesUrl = norm(cfg.resourcesUrl) || "tasun-resources.json";
    if (cfg.resourcesInline && typeof cfg.resourcesInline === "object") _S.resourcesInline = cfg.resourcesInline;
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

    if (cfg.resourcesUrl !== undefined) _S.resourcesUrl = norm(cfg.resourcesUrl) || "tasun-resources.json";
    if (cfg.resourcesInline && typeof cfg.resourcesInline === "object") _S.resourcesInline = cfg.resourcesInline;

    var resourceKey = norm(cfg.resourceKey);

    // ✅FORCE pk/id rule (ignore cfg.pk / cfg.pkField)
    if (cfg.pk !== undefined || cfg.pkField !== undefined) {
      try {
        // non-breaking warning (helps you find pages still using pk:"k")
        console.warn("[TasunCloudKit] pk is forced to 'id'. Please remove pk from mount() on page:", resourceKey, "pk=", cfg.pk || cfg.pkField);
      } catch (e) {}
    }
    var watchCfg = cfg.watch || { intervalSec: 0 };
    var getLocal = (typeof cfg.getLocal === "function") ? cfg.getLocal : function () { return { items: [] }; };
    var apply = (typeof cfg.apply === "function") ? cfg.apply : function () {};

    var protectEmptyRemote = (cfg.protectEmptyRemote !== undefined) ? !!cfg.protectEmptyRemote : true;
    var canSeed = (typeof cfg.canSeed === "function") ? cfg.canSeed : function () { return true; };

    var accessKey = norm(cfg.accessTokenKey || cfg.accessKey || "tasunAccessServiceToken_v1");
    var accessToken = resolveAccessToken(accessKey, cfg.accessToken || null);

    var meta = {
      appVer: norm(_S.appVer) || norm(window.TASUN_APP_VER),
      page: resourceKey,
      user: (typeof cfg.user === "function") ? (cfg.user() || "") : norm(cfg.user || ""),
      role: (typeof cfg.role === "function") ? (cfg.role() || "") : norm(cfg.role || ""),
    };

    var apiBaseOverride = (typeof cfg.apiBase === "function") ? cfg.apiBase : function () { return norm(cfg.apiBase || ""); };

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
      access: accessToken ? "token" : "cookie",
      accessKey: accessKey,
      pk: "id"
    };

    var readyResolve;
    var ready = new Promise(function (res) { readyResolve = res; });

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
      var cfg0 = await getConfig(resourceKey);
      var o = apiBaseOverride ? norm(apiBaseOverride()) : "";
      if (o && /^https?:\/\//i.test(o)) cfg0.apiBase = o.replace(/\/+$/, "");
      lastStatus.apiBase = norm(cfg0.apiBase);
      return cfg0;
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
          var remote = await workerRead(entry, resourceKey, accessToken, meta);

          if (protectEmptyRemote) {
            var local = getLocal() || { items: [] };
            if (isRemoteEmpty(remote) && isLocalNotEmpty(local)) {
              var seedKey = "tasunCloudKit_seeded__" + resourceKey + "__" + norm(_S.appVer || "") + "__v2";
              if (!sessionStorage.getItem(seedKey)) {
                sessionStorage.setItem(seedKey, "1");
                safeApply(local, { source: "remote-empty-protected", reason: "keep-local" });
                lastStatus.mode = "remote-empty-protected";
                lastStatus.lastPullAt = Date.now();
                uiSet("CloudKit: remote empty → keep local");
                uiPulse(true);

                try {
                  if (canSeed()) {
                    saveMerged({ reason: "seed-empty-remote" });
                  }
                } catch (_e) {}
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

          try {
            safeApply(getLocal() || { items: [] }, { source: "local-fallback", error: lastStatus.lastError });
          } catch (_e2) {}
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

          var localObj = getLocal() || { items: [] };
          var items = extractItems(localObj) || [];

          for (var i = 0; i < items.length; i++) {
            if (items[i] && typeof items[i] === "object") {
              ensureId(items[i]); // ✅ id forced
              if (!items[i].createdAt) items[i].createdAt = nowISO();
              items[i].updatedAt = nowISO();
            }
          }

          var result = await workerMerge(entry, resourceKey, items, accessToken, meta);

          lastStatus.mode = "saved";
          lastStatus.lastSaveAt = Date.now();
          uiSet("CloudKit: saved " + resourceKey);
          uiPulse(true);

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

    (async function () {
      try {
        if (!resourceKey) throw new Error("mount() missing resourceKey");

        uiSet("CloudKit: mounting " + resourceKey);

        try { safeApply(getLocal() || { items: [] }, { source: "local-initial" }); } catch (e0) {}

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

  window.TasunCloudKit = {
    init: init,
    mount: mount,
    getConfig: getConfig,
    applyCloudConfigFromResources: applyCloudConfigFromResources,
    _debug: {
      state: function () { return shallowClone(_S); }
    }
  };
})();
