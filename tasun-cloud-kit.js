/* =========================================================
 * tasun-cloud-kit.js  (Most compatible - Worker first)  [STANDARD v1.1 PATCHED]
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
 * ✅STANDARD v1 (Global rule):
 * - pk is FORCED to "uid" for ALL pages (uuid-based, stable).
 * - Any mount({pk:"k"/"id"}) will be ignored.
 * - Required fields ensured: uid, rev, updatedAt, deleted
 * - id is display only (never forced / never auto UUID).
 * - Backward-compat:
 *   - If uid missing AND legacy id exists (id/k/key/...), we generate a STABLE uid by hashing legacy + fingerprint
 *     (prevents multi-device legacy collisions from overwriting).
 *   - If uid missing AND NO legacy id, treat as NEW record => random uid (prevents multi-device collision).
 * - Server-compat:
 *   - POST body sends {items, rows, db} and also {local:{items,rows,db,counter}}
 * ========================================================= */
(function () {
  "use strict";

  // ✅ Global PK (STANDARD v1)
  var GLOBAL_PK = "uid";

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
    _uiMsgEl: null
  };

  // -------------------------------
  // Utils
  // -------------------------------
  function norm(s) { return (s === undefined || s === null) ? "" : String(s).trim(); }
  function nowISO() { return new Date().toISOString(); }

  // Math.imul fallback (more compatible)
  var _imul = Math.imul || function (a, b) {
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff;
    var bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  };

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
    try { return JSON.parse(text); } catch (e) { return null; }
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
        if (!u.searchParams.get(k) && kv[k] !== undefined && kv[k] !== null && norm(kv[k]) !== "") {
          u.searchParams.set(k, String(kv[k]));
        }
      }
      return u.toString();
    } catch (e) {
      if (kv && kv.key && url.indexOf("key=") < 0) {
        return url + (url.indexOf("?") >= 0 ? "&" : "?") + "key=" + encodeURIComponent(String(kv.key));
      }
      return url;
    }
  }

  function mkErr(code, msg, status, body) {
    var e = new Error(msg || code || "ERROR");
    e.code = code || "ERROR";
    if (status !== undefined) e.status = status;
    if (body !== undefined) e.body = body;
    return e;
  }

  // fnv1a hash (stable, ES5) — no padStart
  function fnv1a(str) {
    str = String(str || "");
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = _imul(h, 0x01000193);
    }
    var hex = (h >>> 0).toString(16);
    while (hex.length < 8) hex = "0" + hex;
    return hex;
  }

  // stable stringify with sorted keys (small + deterministic)
  function stableStringify(obj, depth) {
    depth = (depth === undefined) ? 6 : depth;
    if (depth <= 0) return '"[depth]"';

    if (obj === null) return "null";
    var t = typeof obj;

    if (t === "string") return JSON.stringify(obj);
    if (t === "number" || t === "boolean") return String(obj);
    if (t !== "object") return JSON.stringify(String(obj));

    if (Array.isArray(obj)) {
      var a = [];
      for (var i = 0; i < obj.length; i++) a.push(stableStringify(obj[i], depth - 1));
      return "[" + a.join(",") + "]";
    }

    var keys = [];
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) keys.push(k);
    keys.sort();

    var parts = [];
    for (var j = 0; j < keys.length; j++) {
      var kk = keys[j];
      parts.push(JSON.stringify(kk) + ":" + stableStringify(obj[kk], depth - 1));
    }
    return "{" + parts.join(",") + "}";
  }

  function firstNonEmpty() {
    for (var i = 0; i < arguments.length; i++) {
      var v = norm(arguments[i]);
      if (v) return v;
    }
    return "";
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
    try { _S._uiMsgEl.textContent = String(text || ""); } catch (e) {}
  }

  function uiPulse(ok) {
    if (!_S._uiEl) return;
    try {
      var dot = _S._uiEl.firstChild;
      if (dot && dot.style) dot.style.background = ok ? "rgba(120,255,190,.75)" : "rgba(255,160,160,.75)";
      setTimeout(function () {
        if (dot && dot.style) dot.style.background = "rgba(255,255,255,.35)";
      }, 550);
    } catch (e) {}
  }

  // -------------------------------
  // Resources loader (tasun-resources.json)
  // -------------------------------
  async function loadResources() {
    if (_S.resourcesInline && typeof _S.resourcesInline === "object") {
      if (!_S._resourcesCache) {
        _S._resourcesCache = _S.resourcesInline;
        _S._resourcesUrlCacheKey = "inline";
      }
      return _S._resourcesCache;
    }

    var url = addV(_S.resourcesUrl || "tasun-resources.json");
    var cacheKey = url;

    if (_S._resourcesCache && _S._resourcesUrlCacheKey === cacheKey) return _S._resourcesCache;

    var resp, text, json;
    try {
      resp = await fetch(url, { cache: "no-store" });
      text = await resp.text();
      json = safeJSONParse(text);
    } catch (e) {
      if (_S.resourcesInline && typeof _S.resourcesInline === "object") return _S.resourcesInline;
      throw mkErr("RES_FETCH_FAIL", "Failed to load resources (fetch): " + url);
    }

    if (!resp || !resp.ok || !json || typeof json !== "object") throw mkErr("RES_BAD", "Failed to load resources: " + url, resp ? resp.status : 0, text);

    if (json.resources && typeof json.resources === "object") json = json.resources;

    _S._resourcesCache = json;
    _S._resourcesUrlCacheKey = cacheKey;
    return json;
  }

  function normalizeEntry(resourceKey, entry) {
    entry = (entry && typeof entry === "object") ? entry : {};
    var out = shallowClone(entry) || {};
    out.resourceKey = resourceKey;

    if (out.apiBase && typeof out.apiBase === "string") out.apiBase = out.apiBase.trim().replace(/\/+$/, "");

    var ep = (out.endpoints && typeof out.endpoints === "object") ? shallowClone(out.endpoints) : {};
    out.endpoints = {
      health: norm(ep.health || "/health"),
      read:   norm(ep.read   || "/api/read"),
      merge:  norm(ep.merge  || "/api/merge")
    };

    return out;
  }

  // Unwrap remote formats: {payload|data|result} / direct
  function unwrapRemote(obj) {
    if (!obj || typeof obj !== "object") return obj;
    var p = obj;
    if (p && typeof p === "object") {
      if (p.payload && typeof p.payload === "object") p = p.payload;
      else if (p.data && typeof p.data === "object") p = p.data;
      else if (p.result && typeof p.result === "object") p = p.result;
    }
    return p;
  }

  function extractItems(any) {
    if (Array.isArray(any)) return any;
    any = unwrapRemote(any);
    if (any && typeof any === "object") {
      if (Array.isArray(any.items)) return any.items;
      if (Array.isArray(any.db)) return any.db;
      if (Array.isArray(any.rows)) return any.rows;
      if (Array.isArray(any.data)) return any.data;
      return [];
    }
    return [];
  }

  // -------------------------------
  // STANDARD v1: ensure uid/rev/updatedAt/deleted
  // -------------------------------
  function randomUid() {
    try { return (crypto && crypto.randomUUID) ? crypto.randomUUID() : ""; } catch (e) {}
    return "u" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
  }

  // ✅ PATCH: only derive STABLE uid when legacy id exists (migration only)
  function buildStableUid(item) {
    // id is "display only", but in migration old pages may have used id/k/key as identifier
    var legacyId = firstNonEmpty(item.id, item.k, item.key, item.pk, item._id);
    if (!legacyId) return ""; // ✅ no legacy key => do NOT stable-hash (treat as NEW)

    // include fingerprint so same legacyId with different content becomes different uid (prevents overwrite)
    var clone = shallowClone(item) || {};
    delete clone.uid; delete clone.rev; delete clone.updatedAt; delete clone.createdAt;
    var sig = "v1|legacy=" + String(legacyId) + "|fp=" + stableStringify(clone, 6);

    return "u_" + fnv1a(sig);
  }

  function ensureStandardFields(item, nowIso) {
    if (!item || typeof item !== "object") return item;

    // uid
    var u = norm(item.uid);
    if (!u) {
      var stable = buildStableUid(item);
      item.uid = stable || randomUid(); // ✅ NEW record => random uid (no collision)
    }

    // deleted (tombstone)
    if (item.deleted === undefined || item.deleted === null) item.deleted = false;
    item.deleted = !!item.deleted;

    // createdAt / updatedAt
    if (!item.createdAt) item.createdAt = nowIso;
    if (!item.updatedAt) item.updatedAt = nowIso;

    // rev (number)
    var rv = Number(item.rev);
    if (!isFinite(rv) || rv < 0) rv = 0;
    item.rev = rv;

    return item;
  }

  // fingerprint to decide whether to bump rev/updatedAt
  function fingerprintItem(item) {
    if (!item || typeof item !== "object") return "";
    // Exclude volatile fields from fingerprint
    var clone = shallowClone(item) || {};
    delete clone.updatedAt;
    delete clone.createdAt;
    delete clone.rev;
    // keep deleted in fingerprint (deletion is a change)
    return fnv1a(stableStringify(clone, 6));
  }

  function toApplyPayload(remoteObj) {
    remoteObj = unwrapRemote(remoteObj) || remoteObj;
    var items = extractItems(remoteObj);
    return {
      ver: (remoteObj && remoteObj.ver !== undefined) ? remoteObj.ver : 1,
      updatedAt: (remoteObj && remoteObj.updatedAt) ? remoteObj.updatedAt : nowISO(),
      items: items,
      db: items,
      rows: items,
      counter: (remoteObj && remoteObj.counter !== undefined) ? remoteObj.counter : items.length
    };
  }

  // -------------------------------
  // Access helpers
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
    try { var s1 = parseTokenRaw(sessionStorage.getItem(storageKey)); if (s1) return s1; } catch (e3) {}
    try { var s2 = parseTokenRaw(localStorage.getItem(storageKey));  if (s2) return s2; } catch (e4) {}
    return null;
  }

  function buildHeaders(extra, accessToken, meta) {
    var h = {};
    h["Accept"] = "application/json";
    if (meta && typeof meta === "object") {
      if (meta.appVer) h["X-Tasun-AppVer"] = String(meta.appVer);
      if (meta.page)  h["X-Tasun-Page"]   = String(meta.page);
      if (meta.user)  h["X-Tasun-User"]   = String(meta.user);
      if (meta.role)  h["X-Tasun-Role"]   = String(meta.role);
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

  async function fetchJson(url, opt) {
    var r = await fetch(url, opt);
    var t = "";
    try { t = await r.text(); } catch (e) { t = ""; }
    var j = safeJSONParse(t);

    // Detect Access HTML login page even with 200 OK
    var low = (t || "").slice(0, 1200).toLowerCase();
    var looksHtml = low.indexOf("<html") >= 0 || low.indexOf("<!doctype") >= 0;
    var looksAccess = looksHtml && (low.indexOf("cloudflare access") >= 0 || low.indexOf("cf-access") >= 0 || low.indexOf("access login") >= 0);

    return { r: r, text: t, json: j, looksAccessHtml: looksAccess };
  }

  function altReadPath(p) {
    p = norm(p);
    if (p === "/api/read") return "/api/tasun/pull";
    if (p === "/api/tasun/pull") return "/api/read";
    return "";
  }
  function altMergePath(p) {
    p = norm(p);
    if (p === "/api/merge") return "/api/tasun/merge";
    if (p === "/api/tasun/merge") return "/api/merge";
    return "";
  }

  // -------------------------------
  // Worker API
  // -------------------------------
  async function workerRead(entry, resourceKey, accessToken, meta) {
    var apiBase = norm(entry.apiBase);
    var ep = (entry.endpoints && typeof entry.endpoints === "object") ? entry.endpoints : {};
    var readPath = norm(ep.read || "/api/read");

    async function doRead(path) {
      var url = joinUrl(apiBase, path);
      url = withQuery(url, { key: resourceKey });
      return fetchJson(url, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        credentials: (accessToken && accessToken.clientId) ? "omit" : "include",
        headers: buildHeaders(null, accessToken, meta)
      });
    }

    var out = await doRead(readPath);

    // 404 fallback
    if (!out.r.ok && out.r.status === 404) {
      var alt = altReadPath(readPath);
      if (alt) out = await doRead(alt);
    }

    if (out.looksAccessHtml) throw mkErr("ACCESS_DENY", "Access login required (HTML).", out.r.status, out.text);

    // Some workers return {ok:false,...} with 200
    if (out.r.ok && out.json && typeof out.json === "object" && out.json.ok === false) {
      throw mkErr("API_FAIL", (out.json.error || out.json.message || "API_FAIL"), out.r.status, out.text);
    }

    if (!out.r.ok) throw mkErr("READ_FAIL", "Worker read failed: " + out.r.status, out.r.status, out.text);

    return out.json || { ver: 1, updatedAt: nowISO(), items: [] };
  }

  async function workerMerge(entry, resourceKey, localPayload, accessToken, meta) {
    var apiBase = norm(entry.apiBase);
    var ep = (entry.endpoints && typeof entry.endpoints === "object") ? entry.endpoints : {};
    var mergePath = norm(ep.merge || "/api/merge");

    async function doMerge(path) {
      var url = joinUrl(apiBase, path);

      // Accept both styles:
      // - items/rows/db at root
      // - local:{items,rows,db,counter}
      var body = {
        key: resourceKey,
        pk: GLOBAL_PK,         // ✅ forced
        pkField: GLOBAL_PK,    // ✅ for servers that look for pkField
        idField: "id",         // display-only hint
        counterField: "counter",
        items: localPayload.items,
        rows: localPayload.items,
        db: localPayload.items,
        counter: localPayload.counter,
        local: {
          items: localPayload.items,
          rows: localPayload.items,
          db: localPayload.items,
          counter: localPayload.counter
        },
        client: {
          ts: Date.now(),
          requestId: localPayload.requestId || "",
          appVer: norm(_S.appVer) || norm(window.TASUN_APP_VER),
          ua: (typeof navigator !== "undefined" ? navigator.userAgent : "")
        }
      };

      return fetchJson(url, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        credentials: (accessToken && accessToken.clientId) ? "omit" : "include",
        headers: buildHeaders({ "Content-Type": "application/json" }, accessToken, meta),
        body: JSON.stringify(body)
      });
    }

    var out = await doMerge(mergePath);

    // 404 fallback
    if (!out.r.ok && out.r.status === 404) {
      var alt = altMergePath(mergePath);
      if (alt) out = await doMerge(alt);
    }

    if (out.looksAccessHtml) throw mkErr("ACCESS_DENY", "Access login required (HTML).", out.r.status, out.text);

    if (out.r.ok && out.json && typeof out.json === "object" && out.json.ok === false) {
      throw mkErr("API_FAIL", (out.json.error || out.json.message || "API_FAIL"), out.r.status, out.text);
    }

    if (!out.r.ok) throw mkErr("MERGE_FAIL", "Worker merge failed: " + out.r.status, out.r.status, out.text);

    return out.json || { ok: true };
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

    // ✅ PATCH: support default fallback so new pages don't require editing resources.json every time
    var entry = resources && (resources[resourceKey] || resources.__default || resources["*"] || resources.default);
    if (!entry) throw mkErr("RES_MISSING", "Resource not found in tasun-resources.json: " + resourceKey);

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

    // ✅FORCE pk/uid rule (ignore cfg.pk / cfg.pkField)
    if (cfg.pk !== undefined || cfg.pkField !== undefined) {
      try {
        console.warn("[TasunCloudKit] pk is forced to 'uid'. Please remove pk from mount() on page:", resourceKey, "pk=", cfg.pk || cfg.pkField);
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
      role: (typeof cfg.role === "function") ? (cfg.role() || "") : norm(cfg.role || "")
    };

    var apiBaseOverride = (typeof cfg.apiBase === "function") ? cfg.apiBase : function () { return norm(cfg.apiBase || ""); };

    var destroyed = false;
    var timer = null;

    // Local snapshot map for rev/updatedAt bump decision
    var snap = {}; // uid -> fingerprint

    var lastStatus = {
      mode: "init",
      code: "",
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
      pk: GLOBAL_PK
    };

    var readyResolve;
    var ready = new Promise(function (res) { readyResolve = res; });

    var _chain = Promise.resolve();
    function enqueue(fn) {
      _chain = _chain.then(function () {
        if (destroyed) return;
        return fn();
      }).catch(function (e) {
        lastStatus.code = e && e.code ? String(e.code) : "ERROR";
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
      try { apply(toApplyPayload(anyPayload), info || {}); } catch (e) {}
      // after apply, rebuild snapshot from current local
      try {
        var cur = getLocal() || {};
        var items = extractItems(cur) || [];
        var i;
        snap = {};
        for (i = 0; i < items.length; i++) {
          var it = items[i];
          if (it && typeof it === "object") {
            var uid = norm(it.uid);
            if (uid) snap[uid] = fingerprintItem(it);
          }
        }
      } catch (_e) {}
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
        lastStatus.code = "";
        uiSet("CloudKit: pulling " + resourceKey);

        try {
          var entry = await resolveEntry();
          var remote = await workerRead(entry, resourceKey, accessToken, meta);

          if (protectEmptyRemote) {
            var local = getLocal() || { items: [] };
            if (isRemoteEmpty(remote) && isLocalNotEmpty(local)) {
              var seedKey = "tasunCloudKit_seeded__" + resourceKey + "__" + norm(_S.appVer || "") + "__v3";
              if (!sessionStorage.getItem(seedKey)) {
                sessionStorage.setItem(seedKey, "1");
                safeApply(local, { source: "remote-empty-protected", reason: "keep-local" });
                lastStatus.mode = "remote-empty-protected";
                lastStatus.lastPullAt = Date.now();
                uiSet("CloudKit: remote empty → keep local");
                uiPulse(true);

                try { if (canSeed()) saveMerged({ reason: "seed-empty-remote" }); } catch (_e) {}
                return;
              }
            }
          }

          // ensure standard fields on remote BEFORE apply (so pages always see uid/rev/updatedAt/deleted)
          try {
            var p = unwrapRemote(remote) || remote;
            var arr = extractItems(p) || [];
            var nowIso = nowISO();
            for (var i = 0; i < arr.length; i++) ensureStandardFields(arr[i], nowIso);
          } catch (_e2) {}

          safeApply(remote, { source: "remote", fetchedAt: Date.now() });
          lastStatus.mode = "synced";
          lastStatus.lastPullAt = Date.now();
          uiSet("CloudKit: pulled " + resourceKey);
          uiPulse(true);
        } catch (e) {
          lastStatus.code = e && e.code ? String(e.code) : "ERROR";
          lastStatus.lastError = (e && e.message) ? String(e.message) : String(e || "");
          lastStatus.mode = "error";
          uiSet("CloudKit: pull error");
          uiPulse(false);
          console.warn("[TasunCloudKit] pullNow error:", lastStatus.code, lastStatus.lastError);

          // local fallback (do NOT overwrite UI with empty)
          try { safeApply(getLocal() || { items: [] }, { source: "local-fallback", error: lastStatus.lastError }); } catch (_e3) {}
        }
      });
    }

    function saveMerged(opts) {
      opts = opts || {};
      return enqueue(async function () {
        if (destroyed) return false;

        lastStatus.lastError = "";
        lastStatus.code = "";
        uiSet("CloudKit: saving " + resourceKey);

        try {
          var entry = await resolveEntry();

          var localObj = getLocal() || { items: [] };
          var items = extractItems(localObj) || [];

          // counter hint (optional)
          var counter = 0;
          try {
            var lo = unwrapRemote(localObj) || localObj;
            if (lo && typeof lo === "object" && lo.counter !== undefined) counter = Number(lo.counter) || 0;
          } catch (_ec) {}
          if (!isFinite(counter) || counter < 0) counter = 0;

          // requestId (optional but helps idempotency)
          var reqId = "";
          try {
            // deviceId can be provided by page; else generate/stash here
            var didKey = "tasunDeviceId_v1";
            var did = "";
            try { did = norm(localStorage.getItem(didKey)); } catch (_e0) {}
            if (!did) {
              did = "d_" + randomUid();
              try { localStorage.setItem(didKey, did); } catch (_e1) {}
            }
            reqId = did + "_" + Date.now() + "_" + Math.random().toString(16).slice(2);
          } catch (_e2) {}

          var nowIso = nowISO();

          // ensure standard fields + bump rev/updatedAt ONLY when changed vs snapshot
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || typeof it !== "object") continue;

            ensureStandardFields(it, nowIso);

            var uid = norm(it.uid);
            var fp = fingerprintItem(it);
            var prev = snap[uid];

            // If new or changed -> bump rev + updatedAt
            if (!prev || prev !== fp) {
              it.rev = Number(it.rev || 0) + 1;
              it.updatedAt = nowIso;
              snap[uid] = fp;
            }
          }

          var localPayload = {
            items: items,
            counter: counter,
            requestId: reqId
          };

          var result = await workerMerge(entry, resourceKey, localPayload, accessToken, meta);

          lastStatus.mode = "saved";
          lastStatus.lastSaveAt = Date.now();
          uiSet("CloudKit: saved " + resourceKey);
          uiPulse(true);

          // always pull full result after merge (server source of truth)
          await pullNow();
          return result;
        } catch (e) {
          lastStatus.code = e && e.code ? String(e.code) : "ERROR";
          lastStatus.lastError = (e && e.message) ? String(e.message) : String(e || "");
          lastStatus.mode = "error";
          uiSet("CloudKit: save error");
          uiPulse(false);
          console.warn("[TasunCloudKit] saveMerged error:", lastStatus.code, lastStatus.lastError);
          return false;
        }
      });
    }

    (async function () {
      try {
        if (!resourceKey) throw mkErr("MOUNT_MISSING_KEY", "mount() missing resourceKey");

        uiSet("CloudKit: mounting " + resourceKey);

        // local initial apply
        try { safeApply(getLocal() || { items: [] }, { source: "local-initial" }); } catch (e0) {}

        // pull first
        await pullNow();

        // watch pull
        var sec = Number((watchCfg && watchCfg.intervalSec) || 0);
        if (isFinite(sec) && sec > 0) {
          timer = setInterval(function () {
            if (destroyed) return;
            pullNow();
          }, Math.max(2000, sec * 1000));
        }

        lastStatus.mode = "ready";
        try { readyResolve(true); } catch (_e) {}
      } catch (e) {
        lastStatus.code = e && e.code ? String(e.code) : "ERROR";
        lastStatus.lastError = (e && e.message) ? String(e.message) : String(e || "");
        lastStatus.mode = "error";
        uiSet("CloudKit: mount error");
        uiPulse(false);
        console.warn("[TasunCloudKit] mount error:", lastStatus.code, lastStatus.lastError);
        try { readyResolve(false); } catch (_e2) {}
      }
    })();

    return {
      ready: ready,
      pullNow: pullNow,
      saveMerged: saveMerged,
      status: status,
      destroy: destroy
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
