/* tasun-cloud-kit.js
 * Tasun Cloud Kit (All-in-one)
 * - Dropbox JSON Store (read/write)
 * - Cooperative Lock (ttl + heartbeat)
 * - Watch rev changes (poll metadata)
 * - Standard StatusBar UI (auto read-only detection, auto hide lock buttons)
 * - Minimal Facade API for pages: TasunCloudKit.init().open().transaction()
 *
 * Version: 20260129_01
 */
(function (window, document) {
  "use strict";

  // =========================================================
  // 0) Common utils
  // =========================================================
  function str(v) { return (v === undefined || v === null) ? "" : String(v); }
  function now() { return Date.now(); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function jsonParse(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }
  function safeJsonStringify(obj) { try { return JSON.stringify(obj); } catch (e) { return ""; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function uuid() { return "u" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2); }

  function addV(url, v) {
    var u = str(url);
    var vv = str(v).trim();
    if (!vv) return u;
    try {
      var uu = new URL(u, document.baseURI);
      uu.searchParams.set("v", vv);
      return uu.toString();
    } catch (e) {
      return u + (u.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }

  // fetch with timeout
  async function fetchWithTimeout(url, options, timeoutMs) {
    timeoutMs = clamp(Number(timeoutMs) || 12000, 2000, 60000);
    var ctrl = new AbortController();
    var t = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, timeoutMs);
    try {
      options = options || {};
      options.signal = ctrl.signal;
      return await fetch(url, options);
    } finally {
      clearTimeout(t);
    }
  }

  // raf debounce
  function rafDebounce(fn) {
    var r = 0;
    return function () {
      try { window.cancelAnimationFrame(r); } catch (e) {}
      r = window.requestAnimationFrame(function () {
        try { fn(); } catch (e2) {}
      });
    };
  }

  function escapeHtml(s) {
    s = str(s);
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pad2(n) { n = Number(n) || 0; return (n < 10 ? "0" : "") + n; }
  function fmtTime(ts) {
    ts = Number(ts) || 0;
    if (!ts) return "--:--:--";
    var d = new Date(ts);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }
  function fmtDateTime(ts) {
    ts = Number(ts) || 0;
    if (!ts) return "";
    var d = new Date(ts);
    return (
      d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
      " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds())
    );
  }
  function shortRev(rev) {
    rev = str(rev).trim();
    if (!rev) return "";
    return rev.length <= 8 ? rev : (rev.slice(0, 4) + "…" + rev.slice(-3));
  }

  // =========================================================
  // 1) Dropbox Store + Lock + Watch  (window.TasunDropboxStore)
  // =========================================================
  (function () {
    var Store = window.TasunDropboxStore || {};
    var STORE_VER = "20260129_01";

    // -----------------------------
    // Internal state
    // -----------------------------
    var _cfg = {
      appVer: "",
      resourcesUrl: "",        // tasun-resources.json
      resourcesInline: null,   // optional inline resources object
      tokenKey: "tasun_dropbox_token_v1",
      getToken: null,
      getUser: null,
      onStatus: null,
      fetchTimeoutMs: 12000,
      cachePrefix: "tasun_dbx_store__v1__"
    };

    var _registry = null;
    var _registryLoaded = false;
    var _registryLoading = null;

    var _memCache = {}; // { [key]: {payload, rev, loadedAt} }
    var _locks = {};    // { [key]: { lockId, expiresAt, ttlSec, hbTimer, lastLockObj, lockRev } }
    var _watchers = {}; // { [key]: { timer, intervalMs, lastRev, onChange } }

    function status(type, msg, detail) {
      try { if (typeof _cfg.onStatus === "function") _cfg.onStatus(type, msg, detail || null); } catch (e) {}
    }

    // -----------------------------
    // Token/User helpers (with your existing localStorage keys)
    // -----------------------------
    function getToken() {
      try {
        if (typeof _cfg.getToken === "function") return str(_cfg.getToken()).trim();
      } catch (e) {}
      try { return str(localStorage.getItem(_cfg.tokenKey)).trim(); } catch (e2) {}
      return "";
    }

    // default: try tasunCurrentUser_v1 (你權限表頁使用的 CURRENT_KEY)
    function getUser() {
      try {
        if (typeof _cfg.getUser === "function") {
          var u0 = _cfg.getUser();
          if (u0 && typeof u0 === "object") return u0;
        }
      } catch (e) {}

      try {
        var raw = localStorage.getItem("tasunCurrentUser_v1");
        var o = raw ? jsonParse(raw, null) : null;
        if (o && typeof o === "object") {
          var username = str(o.username || o.user || o.name || "").trim();
          var role = str(o.role || o.permission || "").trim();
          if (username) return { username: username, role: role || "read" };
        }
      } catch (e2) {}

      return { username: "anonymous", role: "read" };
    }

    function ownerFromUser(u) {
      u = u || getUser();
      var username = str(u.username || u.user || u.name || "anonymous").trim() || "anonymous";
      var role = str(u.role || u.permission || "read").trim() || "read";
      var device = str(navigator.userAgent).slice(0, 160);
      return { username: username, role: role, device: device };
    }

    // -----------------------------
    // Dropbox API v2 helpers
    // -----------------------------
    var DBX = {
      downloadUrl: "https://content.dropboxapi.com/2/files/download",
      uploadUrl: "https://content.dropboxapi.com/2/files/upload",
      metaUrl: "https://api.dropboxapi.com/2/files/get_metadata"
    };

    async function dbxDownloadPath(path) {
      var token = getToken();
      if (!token) throw new Error("Dropbox token missing.");

      var res = await fetchWithTimeout(DBX.downloadUrl, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Dropbox-API-Arg": JSON.stringify({ path: path })
        }
      }, _cfg.fetchTimeoutMs);

      if (!res.ok) {
        var tx = await res.text().catch(function(){ return ""; });
        throw new Error("Dropbox download failed: " + res.status + " " + tx);
      }

      var metaHeader = res.headers.get("dropbox-api-result");
      var meta = metaHeader ? jsonParse(metaHeader, null) : null;
      var text = await res.text();
      return { text: text, meta: meta, rev: meta && meta.rev ? meta.rev : "" };
    }

    async function dbxGetMetadata(path) {
      var token = getToken();
      if (!token) throw new Error("Dropbox token missing.");

      var res = await fetchWithTimeout(DBX.metaUrl, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ path: path, include_deleted: false })
      }, _cfg.fetchTimeoutMs);

      if (!res.ok) {
        var tx = await res.text().catch(function(){ return ""; });
        throw new Error("Dropbox metadata failed: " + res.status + " " + tx);
      }
      return await res.json();
    }

    async function dbxUploadPath(path, contentText, modeObj) {
      var token = getToken();
      if (!token) throw new Error("Dropbox token missing.");

      var arg = {
        path: path,
        mode: modeObj || { ".tag": "overwrite" },
        autorename: false,
        mute: true,
        strict_conflict: true
      };

      var res = await fetchWithTimeout(DBX.uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify(arg)
        },
        body: contentText
      }, _cfg.fetchTimeoutMs);

      if (!res.ok) {
        var tx = await res.text().catch(function(){ return ""; });
        throw new Error("Dropbox upload failed: " + res.status + " " + tx);
      }
      return await res.json();
    }

    // -----------------------------
    // Registry
    // -----------------------------
    function regCacheKey() { return _cfg.cachePrefix + "registry"; }

    async function loadRegistry() {
      if (_registryLoaded) return _registry || {};
      if (_registryLoading) return _registryLoading;

      _registryLoading = (async function () {
        if (_cfg.resourcesInline && typeof _cfg.resourcesInline === "object") {
          _registry = _cfg.resourcesInline;
          _registryLoaded = true;
          try { localStorage.setItem(regCacheKey(), safeJsonStringify(_registry)); } catch (e) {}
          return _registry;
        }

        var url = str(_cfg.resourcesUrl).trim();
        if (!url) {
          var cached = null;
          try { cached = jsonParse(localStorage.getItem(regCacheKey()), null); } catch (e2) {}
          _registry = (cached && typeof cached === "object") ? cached : {};
          _registryLoaded = true;
          return _registry;
        }

        var finalUrl = addV(url, _cfg.appVer);
        try {
          var res = await fetchWithTimeout(finalUrl, { method: "GET", cache: "no-store" }, _cfg.fetchTimeoutMs);
          if (!res.ok) throw new Error("registry http " + res.status);
          var obj = await res.json();
          _registry = (obj && typeof obj === "object") ? obj : {};
          _registryLoaded = true;
          try { localStorage.setItem(regCacheKey(), safeJsonStringify(_registry)); } catch (e3) {}
          return _registry;
        } catch (e) {
          var cached2 = null;
          try { cached2 = jsonParse(localStorage.getItem(regCacheKey()), null); } catch (e4) {}
          _registry = (cached2 && typeof cached2 === "object") ? cached2 : {};
          _registryLoaded = true;
          status("warn", "資源表讀取失敗，改用快取（可能不是最新）", { error: str(e && e.message) });
          return _registry;
        } finally {
          _registryLoading = null;
        }
      })();

      return _registryLoading;
    }

    function pick(obj, keys, fallback) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
      }
      return fallback;
    }

    function resolveResource(resourceKey) {
      var reg = _registry || {};
      var r = reg[resourceKey];
      if (!r || typeof r !== "object") return null;

      var db = r.db || {};
      var lock = r.lock || {};

      var dbPath = pick(db, ["path", "dropboxPath"], "");
      var lockPath = pick(lock, ["path", "dropboxPath"], "");

      var dbUrl = pick(db, ["url", "rawUrl", "httpUrl"], "");
      var lockUrl = pick(lock, ["url", "rawUrl", "httpUrl"], "");

      return {
        key: resourceKey,
        db: { path: str(dbPath).trim(), url: str(dbUrl).trim() },
        lock: { path: str(lockPath).trim(), url: str(lockUrl).trim() },
        meta: r.meta || {}
      };
    }

    // -----------------------------
    // Payload normalize/cache
    // -----------------------------
    function normalizePayload(obj, resourceKey) {
      obj = (obj && typeof obj === "object") ? obj : {};
      if (!obj.meta || typeof obj.meta !== "object") obj.meta = {};
      if (!obj.meta.resource) obj.meta.resource = resourceKey;
      if (!obj.meta.schema) obj.meta.schema = "tasun.db.v1";
      if (!obj.meta.updatedAt) obj.meta.updatedAt = new Date().toISOString();
      if (!Array.isArray(obj.db)) obj.db = [];
      if (obj.counter === undefined || obj.counter === null) obj.counter = 0;
      return obj;
    }

    function payloadCacheKey(resourceKey) { return _cfg.cachePrefix + "payload__" + resourceKey; }

    function savePayloadCache(resourceKey, payload, rev) {
      try {
        localStorage.setItem(payloadCacheKey(resourceKey), safeJsonStringify({
          savedAt: now(), rev: str(rev), payload: payload
        }));
      } catch (e) {}
    }

    function loadPayloadCache(resourceKey) {
      try {
        var o = jsonParse(localStorage.getItem(payloadCacheKey(resourceKey)), null);
        if (o && o.payload) return o;
      } catch (e) {}
      return null;
    }

    // -----------------------------
    // Public: read/write
    // -----------------------------
    async function read(resourceKey, opts) {
      opts = opts || {};
      await loadRegistry();

      var res = resolveResource(resourceKey);
      if (!res) throw new Error("Unknown resourceKey: " + resourceKey);

      var preferCache = !!opts.preferCache;
      var allowHttpReadOnly = (opts.allowHttpReadOnly !== false);

      if (preferCache && _memCache[resourceKey] && _memCache[resourceKey].payload) {
        return { payload: _memCache[resourceKey].payload, rev: _memCache[resourceKey].rev || "", source: "mem" };
      }

      if (res.db.path) {
        try {
          var dl = await dbxDownloadPath(res.db.path);
          var obj = jsonParse(dl.text, null);
          if (!obj) throw new Error("db json parse failed");
          obj = normalizePayload(obj, resourceKey);
          _memCache[resourceKey] = { payload: obj, rev: dl.rev || "", loadedAt: now() };
          savePayloadCache(resourceKey, obj, dl.rev || "");
          return { payload: obj, rev: dl.rev || "", source: "dropbox" };
        } catch (e1) {
          status("warn", "Dropbox 讀取失敗，改用快取/HTTP（若有）", { resourceKey: resourceKey, error: str(e1 && e1.message) });
        }
      }

      if (allowHttpReadOnly && res.db.url) {
        try {
          var url = addV(res.db.url, _cfg.appVer);
          var r2 = await fetchWithTimeout(url, { method: "GET", cache: "no-store" }, _cfg.fetchTimeoutMs);
          if (!r2.ok) throw new Error("http " + r2.status);
          var obj2 = await r2.json();
          obj2 = normalizePayload(obj2, resourceKey);
          _memCache[resourceKey] = { payload: obj2, rev: "", loadedAt: now() };
          savePayloadCache(resourceKey, obj2, "");
          return { payload: obj2, rev: "", source: "http" };
        } catch (e2) {
          status("warn", "HTTP 讀取失敗，改用快取", { resourceKey: resourceKey, error: str(e2 && e2.message) });
        }
      }

      var c = loadPayloadCache(resourceKey);
      if (c && c.payload) {
        var p = normalizePayload(c.payload, resourceKey);
        _memCache[resourceKey] = { payload: p, rev: str(c.rev || ""), loadedAt: now() };
        return { payload: p, rev: str(c.rev || ""), source: "cache" };
      }

      var empty = normalizePayload({ db: [], counter: 0 }, resourceKey);
      _memCache[resourceKey] = { payload: empty, rev: "", loadedAt: now() };
      return { payload: empty, rev: "", source: "empty" };
    }

    async function write(resourceKey, payload, opts) {
      opts = opts || {};
      await loadRegistry();

      var res = resolveResource(resourceKey);
      if (!res) throw new Error("Unknown resourceKey: " + resourceKey);
      if (!res.db.path) throw new Error("This resource has no Dropbox db.path (cannot write).");

      // lock required by default
      if (opts.requireLock !== false) {
        var ls = _locks[resourceKey];
        if (!ls || !ls.lockId) throw new Error("Lock not held. Acquire lock before write.");
      }

      var p = normalizePayload(payload, resourceKey);
      p.meta.updatedAt = new Date().toISOString();
      var u = ownerFromUser(getUser());
      p.meta.updatedBy = u.username;
      p.meta.updatedRole = u.role;
      p.meta.storeVer = STORE_VER;

      var text = JSON.stringify(p, null, 2);

      var rev = str(opts.rev || (_memCache[resourceKey] && _memCache[resourceKey].rev) || "");
      var mode = rev ? { ".tag": "update", update: rev } : { ".tag": "overwrite" };

      var meta = await dbxUploadPath(res.db.path, text, mode);
      var newRev = meta && meta.rev ? meta.rev : "";

      _memCache[resourceKey] = { payload: p, rev: newRev, loadedAt: now() };
      savePayloadCache(resourceKey, p, newRev);

      try {
        window.dispatchEvent(new CustomEvent("tasun:db-updated", { detail: { resourceKey: resourceKey, rev: newRev } }));
      } catch (e) {}

      return { rev: newRev, meta: meta };
    }

    // -----------------------------
    // Lock file (cooperative lock)
    // -----------------------------
    function lockCacheKey(resourceKey) { return _cfg.cachePrefix + "lock__" + resourceKey; }

    function saveLockCache(resourceKey, obj, rev) {
      try {
        localStorage.setItem(lockCacheKey(resourceKey), safeJsonStringify({ savedAt: now(), rev: str(rev), lock: obj }));
      } catch (e) {}
    }

    function loadLockCache(resourceKey) {
      try {
        var o = jsonParse(localStorage.getItem(lockCacheKey(resourceKey)), null);
        if (o && o.lock) return o;
      } catch (e) {}
      return null;
    }

    function normalizeLock(obj, resourceKey) {
      obj = (obj && typeof obj === "object") ? obj : {};
      if (!obj.schema) obj.schema = "tasun.lock.v1";
      obj.resource = resourceKey;
      if (!obj.owner || typeof obj.owner !== "object") obj.owner = { username: "unknown", role: "read", device: "" };
      obj.acquiredAt = Number(obj.acquiredAt) || 0;
      obj.heartbeatAt = Number(obj.heartbeatAt) || 0;
      obj.expiresAt = Number(obj.expiresAt) || 0;
      obj.ttlSec = clamp(Number(obj.ttlSec) || 90, 30, 600);
      obj.lockId = str(obj.lockId || "");
      return obj;
    }

    function isExpired(lockObj) {
      var ex = Number(lockObj && lockObj.expiresAt) || 0;
      return ex <= now();
    }

    async function readLock(resourceKey) {
      await loadRegistry();
      var res = resolveResource(resourceKey);
      if (!res) throw new Error("Unknown resourceKey: " + resourceKey);

      if (res.lock.path) {
        try {
          var dl = await dbxDownloadPath(res.lock.path);
          var obj = jsonParse(dl.text, null);
          obj = normalizeLock(obj, resourceKey);
          saveLockCache(resourceKey, obj, dl.rev || "");
          return { lock: obj, rev: dl.rev || "", source: "dropbox" };
        } catch (e1) {
          status("warn", "Lock 讀取失敗，改用快取/HTTP（若有）", { resourceKey: resourceKey, error: str(e1 && e1.message) });
        }
      }

      if (res.lock.url) {
        try {
          var url = addV(res.lock.url, _cfg.appVer);
          var r2 = await fetchWithTimeout(url, { method: "GET", cache: "no-store" }, _cfg.fetchTimeoutMs);
          if (!r2.ok) throw new Error("http " + r2.status);
          var obj2 = await r2.json();
          obj2 = normalizeLock(obj2, resourceKey);
          saveLockCache(resourceKey, obj2, "");
          return { lock: obj2, rev: "", source: "http" };
        } catch (e2) {
          status("warn", "Lock HTTP 讀取失敗，改用快取", { resourceKey: resourceKey, error: str(e2 && e2.message) });
        }
      }

      var c = loadLockCache(resourceKey);
      if (c && c.lock) return { lock: normalizeLock(c.lock, resourceKey), rev: str(c.rev || ""), source: "cache" };

      return { lock: normalizeLock({}, resourceKey), rev: "", source: "empty" };
    }

    async function writeLock(resourceKey, lockObj, opts) {
      opts = opts || {};
      await loadRegistry();
      var res = resolveResource(resourceKey);
      if (!res) throw new Error("Unknown resourceKey: " + resourceKey);
      if (!res.lock.path) throw new Error("This resource has no Dropbox lock.path (cannot write lock).");

      var obj = normalizeLock(lockObj, resourceKey);
      var text = JSON.stringify(obj, null, 2);

      var rev = str(opts.rev || "");
      var mode = rev ? { ".tag": "update", update: rev } : { ".tag": "overwrite" };

      var meta = await dbxUploadPath(res.lock.path, text, mode);
      var newRev = meta && meta.rev ? meta.rev : "";

      saveLockCache(resourceKey, obj, newRev);
      return { rev: newRev, meta: meta };
    }

    function startHeartbeat(resourceKey) {
      var st = _locks[resourceKey];
      if (!st || !st.lockId) return;
      if (st.hbTimer) return;

      var intervalMs = Math.max(10000, Math.floor(st.ttlSec * 1000 / 2));
      st.hbTimer = setInterval(function () { heartbeat(resourceKey).catch(function () {}); }, intervalMs);
    }

    function stopHeartbeat(resourceKey) {
      var st = _locks[resourceKey];
      if (!st) return;
      if (st.hbTimer) { try { clearInterval(st.hbTimer); } catch (e) {} }
      st.hbTimer = null;
    }

    async function acquire(resourceKey, owner, opts) {
      opts = opts || {};
      owner = owner || ownerFromUser(getUser());
      var ttlSec = clamp(Number(opts.ttlSec) || 90, 30, 600);
      var waitMs = clamp(Number(opts.waitMs) || 8000, 0, 60000);
      var retryDelayMs = clamp(Number(opts.retryDelayMs) || 650, 250, 5000);

      await loadRegistry();
      var res = resolveResource(resourceKey);
      if (!res) throw new Error("Unknown resourceKey: " + resourceKey);
      if (!res.lock.path) throw new Error("This resource has no Dropbox lock.path (cannot lock).");

      var myLockId = uuid();
      var start = now();

      while (true) {
        var cur = await readLock(resourceKey);
        var lockObj = normalizeLock(cur.lock, resourceKey);
        var curRev = str(cur.rev || "");

        var free = (!lockObj.lockId) || isExpired(lockObj);
        if (free) {
          var ts = now();
          var newLock = {
            schema: "tasun.lock.v1",
            resource: resourceKey,
            lockId: myLockId,
            owner: owner,
            acquiredAt: ts,
            heartbeatAt: ts,
            expiresAt: ts + ttlSec * 1000,
            ttlSec: ttlSec
          };

          try {
            var wr = await writeLock(resourceKey, newLock, { rev: curRev });
            _locks[resourceKey] = {
              lockId: myLockId,
              expiresAt: newLock.expiresAt,
              ttlSec: ttlSec,
              lastLockObj: newLock,
              lockRev: wr.rev || "",
              hbTimer: null
            };
            startHeartbeat(resourceKey);
            status("info", "已取得鎖", { resourceKey: resourceKey, owner: owner.username, ttlSec: ttlSec });
            return { lockId: myLockId, expiresAt: newLock.expiresAt, ttlSec: ttlSec };
          } catch (e1) {
            status("warn", "取得鎖失敗，重試中…", { resourceKey: resourceKey, error: str(e1 && e1.message) });
          }
        } else {
          var who = (lockObj.owner && lockObj.owner.username) ? lockObj.owner.username : "unknown";
          var leftMs = (Number(lockObj.expiresAt) || 0) - now();
          status("info", "鎖被占用：" + who, { resourceKey: resourceKey, leftMs: leftMs });
        }

        if (waitMs <= 0) throw new Error("Lock busy.");
        if (now() - start > waitMs) throw new Error("Lock timeout.");
        await sleep(retryDelayMs);
      }
    }

    async function heartbeat(resourceKey) {
      var st = _locks[resourceKey];
      if (!st || !st.lockId) return false;

      var cur = await readLock(resourceKey);
      var lockObj = normalizeLock(cur.lock, resourceKey);
      var curRev = str(cur.rev || "");

      if (str(lockObj.lockId) !== str(st.lockId)) {
        stopHeartbeat(resourceKey);
        delete _locks[resourceKey];
        status("warn", "已失去鎖（lockId 不一致）", { resourceKey: resourceKey });
        return false;
      }

      var ts = now();
      lockObj.heartbeatAt = ts;
      lockObj.expiresAt = ts + (st.ttlSec * 1000);

      try {
        var wr = await writeLock(resourceKey, lockObj, { rev: curRev });
        st.expiresAt = lockObj.expiresAt;
        st.lastLockObj = lockObj;
        st.lockRev = wr.rev || "";
        return true;
      } catch (e) {
        status("warn", "鎖心跳更新失敗", { resourceKey: resourceKey, error: str(e && e.message) });
        return false;
      }
    }

    async function release(resourceKey) {
      var st = _locks[resourceKey];
      if (!st || !st.lockId) return true;

      try {
        var cur = await readLock(resourceKey);
        var lockObj = normalizeLock(cur.lock, resourceKey);
        var curRev = str(cur.rev || "");

        if (str(lockObj.lockId) !== str(st.lockId)) {
          stopHeartbeat(resourceKey);
          delete _locks[resourceKey];
          return true;
        }

        lockObj.heartbeatAt = now();
        lockObj.expiresAt = 0;

        await writeLock(resourceKey, lockObj, { rev: curRev });

        stopHeartbeat(resourceKey);
        delete _locks[resourceKey];
        status("info", "已釋放鎖", { resourceKey: resourceKey });
        return true;
      } catch (e) {
        status("warn", "釋放鎖失敗（可忽略，過 TTL 會自動失效）", { resourceKey: resourceKey, error: str(e && e.message) });
        stopHeartbeat(resourceKey);
        delete _locks[resourceKey];
        return false;
      }
    }

    function isHolding(resourceKey) {
      var st = _locks[resourceKey];
      return !!(st && st.lockId);
    }

    // -----------------------------
    // Watch rev changes
    // -----------------------------
    async function getDbRev(resourceKey) {
      await loadRegistry();
      var res = resolveResource(resourceKey);
      if (!res) throw new Error("Unknown resourceKey: " + resourceKey);
      if (!res.db.path) return "";
      var meta = await dbxGetMetadata(res.db.path);
      return meta && meta.rev ? meta.rev : "";
    }

    function watch(resourceKey, opts) {
      opts = opts || {};
      var intervalSec = clamp(Number(opts.intervalSec) || 8, 3, 120);
      var onChange = (typeof opts.onChange === "function") ? opts.onChange : null;

      unwatch(resourceKey);

      var w = { intervalMs: intervalSec * 1000, timer: null, lastRev: "", onChange: onChange };
      _watchers[resourceKey] = w;

      w.timer = setInterval(function () {
        (async function () {
          try {
            var r = await getDbRev(resourceKey);
            if (!w.lastRev) w.lastRev = r;
            if (r && w.lastRev && r !== w.lastRev) {
              w.lastRev = r;
              try { await read(resourceKey, { preferCache: false }); } catch (e2) {}
              if (w.onChange) w.onChange({ resourceKey: resourceKey, rev: r });
              try {
                window.dispatchEvent(new CustomEvent("tasun:db-changed", { detail: { resourceKey: resourceKey, rev: r } }));
              } catch (e3) {}
            }
          } catch (e) {
            // ignore
          }
        })();
      }, w.intervalMs);

      return function () { unwatch(resourceKey); };
    }

    function unwatch(resourceKey) {
      var w = _watchers[resourceKey];
      if (!w) return;
      if (w.timer) { try { clearInterval(w.timer); } catch (e) {} }
      delete _watchers[resourceKey];
    }

    // -----------------------------
    // Transaction helper
    // -----------------------------
    async function transaction(resourceKey, mutator, opts) {
      opts = opts || {};
      if (typeof mutator !== "function") throw new Error("mutator must be function(payload) => payload|void");

      var owner = opts.owner || ownerFromUser(getUser());
      var ttlSec = clamp(Number(opts.ttlSec) || 90, 30, 600);

      await acquire(resourceKey, owner, { ttlSec: ttlSec, waitMs: opts.waitMs, retryDelayMs: opts.retryDelayMs });
      try {
        var r = await read(resourceKey, { preferCache: false });
        var payload = r.payload;
        var rev = r.rev || "";

        var out = await mutator(payload);
        if (out && typeof out === "object") payload = out;

        var wr = await write(resourceKey, payload, { rev: rev, requireLock: true });
        return { rev: wr.rev, payload: payload };
      } finally {
        await release(resourceKey);
      }
    }

    // -----------------------------
    // Init / Ready / Export
    // -----------------------------
    Store.init = function (options) {
      options = options || {};
      _cfg.appVer = str(options.appVer || window.TASUN_APP_VER || window.__CACHE_V || "").trim();
      _cfg.resourcesUrl = str(options.resourcesUrl || "").trim();
      _cfg.resourcesInline = options.resourcesInline && typeof options.resourcesInline === "object" ? options.resourcesInline : null;

      _cfg.tokenKey = str(options.tokenKey || _cfg.tokenKey);
      _cfg.getToken = (typeof options.getToken === "function") ? options.getToken : null;
      _cfg.getUser = (typeof options.getUser === "function") ? options.getUser : null;
      _cfg.onStatus = (typeof options.onStatus === "function") ? options.onStatus : null;
      _cfg.fetchTimeoutMs = Number(options.fetchTimeoutMs) || _cfg.fetchTimeoutMs;

      Store.version = STORE_VER;
      Store.storeVer = STORE_VER;
      Store.cfg = Object.assign({}, _cfg);

      _registryLoaded = false;
      _registry = null;
      _registryLoading = null;

      status("info", "TasunDropboxStore init", { storeVer: STORE_VER, appVer: _cfg.appVer });
      return Store;
    };

    Store.ready = async function () { await loadRegistry(); return true; };

    Store.getToken = getToken;
    Store.getUser = getUser;
    Store.ownerFromUser = ownerFromUser;

    Store.loadRegistry = loadRegistry;
    Store.resolve = function (resourceKey) { return resolveResource(resourceKey); };

    Store.read = read;
    Store.write = write;
    Store.transaction = transaction;

    Store.lock = { read: readLock, acquire: acquire, heartbeat: heartbeat, release: release, isHolding: isHolding };

    Store.watch = watch;
    Store.unwatch = unwatch;

    window.TasunDropboxStore = Store;
  })();

  // =========================================================
  // 2) StatusBar (window.TasunStatusBar)  + auto read-only hide lock buttons
  // =========================================================
  (function () {
    var Bar = window.TasunStatusBar || {};
    var BAR_VER = "20260129_01";

    var _cfg = {
      position: "top",
      zIndex: 99999,
      compact: false,
      showToken: false,
      maxResources: 6,
      enableDetailPanel: true,
      enableActions: true // actions exist, but lock buttons will auto-hide if read-only
    };

    var _root = null, _styleEl = null;
    var _items = {}; // { [key]: { key, source, rev, lastSyncAt, lastEvent, lockHeld, mgrRef } }
    var _lastMsg = { type: "idle", text: "", at: 0 };

    var _panelMask = null, _panel = null, _panelKey = "", _panelEls = null, _panelTickTimer = null;

    function getAppVer() { return str(window.TASUN_APP_VER || window.__CACHE_V || "").trim(); }

    function storeGetUser() {
      try {
        if (window.TasunDropboxStore && typeof window.TasunDropboxStore.getUser === "function") {
          var u = window.TasunDropboxStore.getUser();
          if (u && typeof u === "object") return u;
        }
      } catch (e) {}
      return { username: "anonymous", role: "read" };
    }

    function tokenStatus() {
      if (!_cfg.showToken) return "";
      try {
        if (window.TasunDropboxStore && typeof window.TasunDropboxStore.getToken === "function") {
          var t = str(window.TasunDropboxStore.getToken()).trim();
          return t ? "Token:OK" : "Token:none";
        }
      } catch (e) {}
      return "Token:?";
    }

    function isOnline() { try { return navigator.onLine !== false; } catch (e) {} return true; }

    // ★ 自動判定 read-only：role 不是 admin/write 就當 read-only
    function isReadOnly() {
      // allow explicit override (不改 UI，只是選配)
      if (window.TASUN_READ_ONLY === true) return true;
      if (window.TASUN_READ_ONLY === false) return false;

      // optional meta override
      try {
        var meta = document.querySelector('meta[name="tasun:mode"]');
        if (meta && /read/i.test(str(meta.content))) return true;
        if (meta && /write|edit/i.test(str(meta.content))) return false;
      } catch (e0) {}

      var u = storeGetUser();
      var role = str(u.role || u.permission || "read").toLowerCase().trim();
      return !(role === "admin" || role === "write");
    }

    function setMsg(type, text) { _lastMsg.type = str(type || "idle"); _lastMsg.text = str(text || "").trim(); _lastMsg.at = now(); render(); }

    function upsertItem(resourceKey, patch) {
      var k = str(resourceKey).trim(); if (!k) return;
      if (!_items[k]) _items[k] = { key: k, source: "", rev: "", lastSyncAt: 0, lastEvent: "", lockHeld: false, mgrRef: null };
      var it = _items[k];
      patch = patch || {};
      if (patch.source !== undefined) it.source = str(patch.source || "");
      if (patch.rev !== undefined) it.rev = str(patch.rev || "");
      if (patch.lastSyncAt !== undefined) it.lastSyncAt = Number(patch.lastSyncAt) || it.lastSyncAt;
      if (patch.lastEvent !== undefined) it.lastEvent = str(patch.lastEvent || "");
      if (patch.lockHeld !== undefined) it.lockHeld = !!patch.lockHeld;
      if (patch.mgrRef !== undefined) it.mgrRef = patch.mgrRef;

      var keys = Object.keys(_items);
      if (keys.length > _cfg.maxResources) {
        keys.sort(function (a, b) { return (Number(_items[a].lastSyncAt) || 0) - (Number(_items[b].lastSyncAt) || 0); });
        while (keys.length > _cfg.maxResources) delete _items[keys.shift()];
      }
    }

    function detectLockHeld(resourceKey) {
      try {
        if (window.TasunDropboxStore && window.TasunDropboxStore.lock && typeof window.TasunDropboxStore.lock.isHolding === "function") {
          return !!window.TasunDropboxStore.lock.isHolding(resourceKey);
        }
      } catch (e) {}
      return false;
    }

    function ensureDOM() {
      if (_root) return;

      _styleEl = document.createElement("style");
      _styleEl.setAttribute("data-tasun-statusbar", "1");
      _styleEl.textContent = [
        ".tasun-statusbar{position:fixed;left:0;right:0;display:flex;align-items:center;gap:10px;",
        "padding:8px 10px;font:12px/1.25 system-ui,-apple-system,Segoe UI,Roboto,'Noto Sans TC','Noto Serif TC',sans-serif;",
        "letter-spacing:.2px;color:rgba(236,236,236,.92);z-index:" + String(_cfg.zIndex) + ";}",
        ".tasun-statusbar[data-pos='top']{top:0;padding-top:calc(8px + env(safe-area-inset-top));}",
        ".tasun-statusbar[data-pos='bottom']{bottom:0;padding-bottom:calc(8px + env(safe-area-inset-bottom));}",
        ".tasun-statusbar .sb-shell{flex:1;display:flex;align-items:center;gap:10px;min-width:0;}",
        ".tasun-statusbar .sb-glass{background:linear-gradient(180deg, rgba(18,20,24,.55), rgba(10,12,14,.42));",
        "border-top:1px solid rgba(246,211,122,.22);border-bottom:1px solid rgba(246,211,122,.18);",
        "box-shadow:0 10px 30px rgba(0,0,0,.35);backdrop-filter: blur(10px);-webkit-backdrop-filter: blur(10px);}",
        ".tasun-statusbar .sb-pill{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;",
        "padding:4px 8px;border-radius:999px;border:1px solid rgba(246,211,122,.20);background:rgba(255,255,255,.04);}",
        ".tasun-statusbar .sb-dot{width:8px;height:8px;border-radius:50%;display:inline-block;}",
        ".tasun-statusbar .sb-dot.on{background:rgba(120,220,140,.95);box-shadow:0 0 10px rgba(120,220,140,.55);}",
        ".tasun-statusbar .sb-dot.off{background:rgba(240,120,120,.95);box-shadow:0 0 10px rgba(240,120,120,.55);}",
        ".tasun-statusbar .sb-muted{color:rgba(236,236,236,.72);}",
        ".tasun-statusbar .sb-strong{color:rgba(246,211,122,.95);}",
        ".tasun-statusbar .sb-msg{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
        ".tasun-statusbar .sb-items{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;}",
        ".tasun-statusbar .sb-item{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:260px;cursor:pointer;user-select:none;}",
        ".tasun-statusbar .sb-item:hover{background:rgba(255,255,255,.06);}",
        ".tasun-statusbar .sb-item:active{transform:translateY(1px);}",
        ".tasun-statusbar .sb-item .k{color:rgba(246,211,122,.92);}",
        ".tasun-statusbar .sb-item .src{color:rgba(236,236,236,.70);}",
        ".tasun-statusbar .sb-btn{margin-left:auto;display:inline-flex;align-items:center;gap:6px;}",
        ".tasun-statusbar .sb-mini{cursor:pointer;user-select:none;opacity:.9}",
        ".tasun-statusbar .sb-mini:hover{opacity:1}",
        ".tasun-statusbar[data-compact='1'] .sb-items{display:none;}",
        ".tasun-statusbar[data-compact='1'] .sb-msg{max-width:55vw;}",

        ".tasun-sb-mask{position:fixed;inset:0;z-index:" + String(_cfg.zIndex + 10) + ";",
        "background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;padding:16px;}",
        ".tasun-sb-panel{width:min(680px, 94vw);border-radius:18px;border:1px solid rgba(246,211,122,.22);",
        "background:linear-gradient(180deg, rgba(18,20,24,.82), rgba(10,12,14,.78));",
        "box-shadow:0 18px 60px rgba(0,0,0,.55);backdrop-filter: blur(12px);-webkit-backdrop-filter: blur(12px);",
        "color:rgba(236,236,236,.92);overflow:hidden;}",
        ".tasun-sb-panel .hd{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(246,211,122,.16);}",
        ".tasun-sb-panel .ttl{font-weight:700;color:rgba(246,211,122,.95);font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
        ".tasun-sb-panel .sub{margin-left:auto;color:rgba(236,236,236,.70);font-size:12px;white-space:nowrap;}",
        ".tasun-sb-panel .bd{padding:12px 14px;display:grid;grid-template-columns:160px 1fr;gap:8px 12px;}",
        ".tasun-sb-panel .k{color:rgba(236,236,236,.70);}",
        ".tasun-sb-panel .v{color:rgba(236,236,236,.92);word-break:break-word;}",
        ".tasun-sb-panel .v code{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;",
        "font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(246,211,122,.16);padding:2px 6px;border-radius:10px;}",
        ".tasun-sb-panel .ft{display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px;border-top:1px solid rgba(246,211,122,.16);justify-content:flex-end;}",
        ".tasun-sb-panel .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:12px;",
        "border:1px solid rgba(246,211,122,.22);background:rgba(255,255,255,.04);cursor:pointer;user-select:none;}",
        ".tasun-sb-panel .btn:hover{background:rgba(255,255,255,.06);}",
        ".tasun-sb-panel .btn:active{transform:translateY(1px);}",
        ".tasun-sb-panel .btn.primary{border-color:rgba(246,211,122,.30);color:rgba(246,211,122,.95);}",
        ".tasun-sb-panel .btn.danger{border-color:rgba(240,120,120,.35);color:rgba(240,160,160,.95);}",
        ".tasun-sb-panel .note{grid-column:1 / -1;color:rgba(236,236,236,.70);font-size:12px;}"
      ].join("\n");
      document.head.appendChild(_styleEl);

      _root = document.createElement("div");
      _root.className = "tasun-statusbar sb-glass";
      _root.setAttribute("data-pos", _cfg.position === "bottom" ? "bottom" : "top");
      _root.setAttribute("data-compact", _cfg.compact ? "1" : "0");

      _root.innerHTML = [
        "<div class='sb-shell'>",
        "  <div class='sb-pill' title='連線狀態'>",
        "    <span class='sb-dot on' data-id='dot'></span>",
        "    <span class='sb-muted' data-id='net'>ONLINE</span>",
        "  </div>",
        "  <div class='sb-pill' title='版本 / 使用者'>",
        "    <span class='sb-muted'>APP</span><span class='sb-strong' data-id='ver'>--</span>",
        "    <span class='sb-muted'>·</span>",
        "    <span class='sb-muted' data-id='user'>anonymous(read)</span>",
        "    <span class='sb-muted' data-id='token'></span>",
        "    <span class='sb-muted' data-id='mode'></span>",
        "  </div>",
        "  <div class='sb-pill sb-msg' title='狀態訊息'><span data-id='msg' class='sb-muted'>ready</span></div>",
        "  <div class='sb-items' data-id='items'></div>",
        "  <div class='sb-btn'>",
        "    <span class='sb-pill sb-mini' data-id='refresh' title='手動刷新（讀雲端）'>↻</span>",
        "    <span class='sb-pill sb-mini' data-id='toggle' title='切換精簡/展開'>▦</span>",
        "  </div>",
        "</div>"
      ].join("");

      document.body.appendChild(_root);

      ensurePanelDOM();

      _root.querySelector("[data-id='toggle']").addEventListener("click", function (e) {
        e.preventDefault();
        _cfg.compact = !_cfg.compact;
        _root.setAttribute("data-compact", _cfg.compact ? "1" : "0");
        render();
      }, { passive: false });

      _root.querySelector("[data-id='refresh']").addEventListener("click", function (e) {
        e.preventDefault();
        refreshAllCloud().catch(function () {});
      }, { passive: false });

      _root.addEventListener("click", function (ev) {
        if (!_cfg.enableDetailPanel) return;
        var el = ev.target;
        while (el && el !== _root) {
          var k = el.getAttribute && el.getAttribute("data-sb-key");
          if (k) { ev.preventDefault(); openPanel(k); return; }
          el = el.parentNode;
        }
      }, { passive: false });

      render();
    }

    function ensurePanelDOM() {
      if (_panelMask) return;

      _panelMask = document.createElement("div");
      _panelMask.className = "tasun-sb-mask";
      _panelMask.setAttribute("aria-hidden", "true");

      _panel = document.createElement("div");
      _panel.className = "tasun-sb-panel";
      _panel.innerHTML = [
        "<div class='hd'>",
        "  <div class='ttl' data-p='ttl'>resource</div>",
        "  <div class='sub' data-p='sub'>--</div>",
        "</div>",
        "<div class='bd'>",
        "  <div class='k'>Source</div><div class='v' data-p='source'>--</div>",
        "  <div class='k'>Rev</div><div class='v' data-p='rev'>--</div>",
        "  <div class='k'>Last Sync</div><div class='v' data-p='sync'>--</div>",
        "  <div class='k'>Last Event</div><div class='v' data-p='event'>--</div>",
        "  <div class='k'>Lock</div><div class='v' data-p='lock'>--</div>",
        "  <div class='k'>Lock Owner</div><div class='v' data-p='owner'>--</div>",
        "  <div class='k'>Expires</div><div class='v' data-p='expires'>--</div>",
        "  <div class='note' data-p='note'>提示：點右側資源即可查看；ESC 或點背景關閉。</div>",
        "</div>",
        "<div class='ft'>",
        "  <div class='btn' data-act='close'>關閉</div>",
        "  <div class='btn' data-act='refresh1'>讀雲端刷新</div>",
        "  <div class='btn primary' data-act='acquire'>嘗試取得鎖</div>",
        "  <div class='btn danger' data-act='release'>釋放鎖</div>",
        "</div>"
      ].join("");

      _panelMask.appendChild(_panel);
      document.body.appendChild(_panelMask);

      _panelEls = {
        ttl: _panel.querySelector("[data-p='ttl']"),
        sub: _panel.querySelector("[data-p='sub']"),
        source: _panel.querySelector("[data-p='source']"),
        rev: _panel.querySelector("[data-p='rev']"),
        sync: _panel.querySelector("[data-p='sync']"),
        event: _panel.querySelector("[data-p='event']"),
        lock: _panel.querySelector("[data-p='lock']"),
        owner: _panel.querySelector("[data-p='owner']"),
        expires: _panel.querySelector("[data-p='expires']"),
        note: _panel.querySelector("[data-p='note']")
      };

      _panelMask.addEventListener("click", function (ev) { if (ev.target === _panelMask) closePanel(); }, { passive: true });

      window.addEventListener("keydown", function (ev) {
        if (!_panelMask || _panelMask.style.display !== "flex") return;
        if (ev.key === "Escape" || ev.keyCode === 27) closePanel();
      }, { passive: true });

      _panel.querySelector("[data-act='close']").addEventListener("click", function () { closePanel(); }, { passive: true });
      _panel.querySelector("[data-act='refresh1']").addEventListener("click", function () { if (_cfg.enableActions) refreshOneCloud(_panelKey).catch(function () {}); }, { passive: true });
      _panel.querySelector("[data-act='acquire']").addEventListener("click", function () { if (_cfg.enableActions) acquireOneLock(_panelKey).catch(function () {}); }, { passive: true });
      _panel.querySelector("[data-act='release']").addEventListener("click", function () { if (_cfg.enableActions) releaseOneLock(_panelKey).catch(function () {}); }, { passive: true });
    }

    function applyPanelReadOnlyUI() {
      if (!_panel) return;
      var ro = isReadOnly();
      var acq = _panel.querySelector("[data-act='acquire']");
      var rel = _panel.querySelector("[data-act='release']");

      // ★ 需求：read-only 自動隱藏「取得鎖/釋放鎖」
      if (acq) acq.style.display = ro ? "none" : "inline-flex";
      if (rel) rel.style.display = ro ? "none" : "inline-flex";
    }

    function openPanel(resourceKey) {
      ensurePanelDOM();
      _panelKey = str(resourceKey).trim();
      if (!_panelKey) return;

      applyPanelReadOnlyUI();

      _panelMask.style.display = "flex";
      _panelMask.setAttribute("aria-hidden", "false");

      renderPanel();

      if (_panelTickTimer) { try { clearInterval(_panelTickTimer); } catch (e) {} }
      _panelTickTimer = setInterval(function () { try { renderPanelLockRemainingOnly(); } catch (e2) {} }, 1000);
    }

    function closePanel() {
      if (_panelTickTimer) { try { clearInterval(_panelTickTimer); } catch (e) {} }
      _panelTickTimer = null;

      if (_panelMask) {
        _panelMask.style.display = "none";
        _panelMask.setAttribute("aria-hidden", "true");
      }
      _panelKey = "";
    }

    function renderPanel() {
      if (!_panelEls || !_panelKey) return;

      var it = _items[_panelKey] || { key: _panelKey };
      var appVer = getAppVer() || "--";
      var u = storeGetUser();
      var userStr = str(u.username || "anonymous") + "(" + str(u.role || "read") + ")";

      _panelEls.ttl.textContent = it.key || _panelKey;
      _panelEls.sub.textContent = "APP " + appVer + " · " + userStr;

      _panelEls.source.innerHTML = "<code>" + escapeHtml(str(it.source || "--")) + "</code>";
      _panelEls.rev.innerHTML = it.rev
        ? ("<code>" + escapeHtml(shortRev(it.rev)) + "</code> <span class='k' style='margin-left:6px'>full</span> <code>" + escapeHtml(it.rev) + "</code>")
        : "<code>--</code>";

      _panelEls.sync.innerHTML = it.lastSyncAt
        ? ("<code>" + escapeHtml(fmtTime(it.lastSyncAt)) + "</code> <span class='k' style='margin-left:6px'>" + escapeHtml(fmtDateTime(it.lastSyncAt)) + "</span>")
        : "<code>--</code>";

      _panelEls.event.innerHTML = "<code>" + escapeHtml(str(it.lastEvent || "--")) + "</code>";

      _panelEls.lock.innerHTML = "<code>loading…</code>";
      _panelEls.owner.innerHTML = "<code>loading…</code>";
      _panelEls.expires.innerHTML = "<code>loading…</code>";

      readLockInfo(_panelKey).catch(function () {});
    }

    function renderPanelLockRemainingOnly() {
      if (!_panelEls || !_panelKey) return;
      var ex = Number(_panelEls.expires && _panelEls.expires.getAttribute("data-expiresat")) || 0;
      if (!ex) return;
      var leftSec = Math.max(0, Math.floor((ex - now()) / 1000));
      var base = _panelEls.expires.getAttribute("data-expiresstr") || "";
      if (!base) return;
      _panelEls.expires.innerHTML = "<code>" + escapeHtml(base) + "</code><span class='k' style='margin-left:6px'> · " + leftSec + "s</span>";
    }

    async function readLockInfo(resourceKey) {
      resourceKey = str(resourceKey).trim();
      if (!resourceKey) return;

      if (!window.TasunDropboxStore || !window.TasunDropboxStore.lock || typeof window.TasunDropboxStore.lock.read !== "function") {
        _panelEls.lock.innerHTML = "<code>store.lock not available</code>";
        _panelEls.owner.innerHTML = "<code>--</code>";
        _panelEls.expires.innerHTML = "<code>--</code>";
        return;
      }

      try {
        var r = await window.TasunDropboxStore.lock.read(resourceKey);
        var lockObj = r && r.lock ? r.lock : null;

        var lockId = lockObj && lockObj.lockId ? str(lockObj.lockId) : "";
        var exAt = lockObj && lockObj.expiresAt ? Number(lockObj.expiresAt) : 0;
        var hbAt = lockObj && lockObj.heartbeatAt ? Number(lockObj.heartbeatAt) : 0;
        var owner = lockObj && lockObj.owner ? lockObj.owner : null;

        var expired = exAt ? (exAt <= now()) : true;
        var heldLocal = detectLockHeld(resourceKey);

        var lockState = (!lockId || expired) ? "FREE" : "BUSY";
        if (heldLocal) lockState = "HOLDING";

        _panelEls.lock.innerHTML =
          "<code>" + escapeHtml(lockState) + "</code>" +
          (lockId ? (" <span class='k' style='margin-left:6px'>id</span> <code>" + escapeHtml(shortRev(lockId)) + "</code>") : "");

        var ownerStr = owner && (owner.username || owner.role)
          ? (str(owner.username || "unknown") + " (" + str(owner.role || "read") + ")")
          : "--";
        _panelEls.owner.innerHTML = "<code>" + escapeHtml(ownerStr) + "</code>";

        var exStr = exAt ? fmtDateTime(exAt) : "--";
        _panelEls.expires.setAttribute("data-expiresat", String(exAt || 0));
        _panelEls.expires.setAttribute("data-expiresstr", String(exStr || ""));
        var leftSec = exAt ? Math.max(0, Math.floor((exAt - now()) / 1000)) : 0;
        _panelEls.expires.innerHTML =
          "<code>" + escapeHtml(exStr) + "</code>" +
          (exAt ? ("<span class='k' style='margin-left:6px'> · " + leftSec + "s</span>") : "");

        _panelEls.note.textContent = hbAt ? ("提示：協作鎖（ttl+heartbeat）。Lock heartbeat: " + fmtDateTime(hbAt)) : "提示：點右側資源即可查看；ESC 或點背景關閉。";
      } catch (e) {
        _panelEls.lock.innerHTML = "<code>read lock failed</code>";
        _panelEls.owner.innerHTML = "<code>--</code>";
        _panelEls.expires.innerHTML = "<code>--</code>";
      }
    }

    async function refreshOneCloud(resourceKey) {
      resourceKey = str(resourceKey).trim();
      if (!resourceKey) return;

      if (!window.TasunDropboxStore || typeof window.TasunDropboxStore.read !== "function") {
        setMsg("warn", "store.read not available");
        return;
      }

      setMsg("info", "refresh " + resourceKey + " …");
      try {
        var r = await window.TasunDropboxStore.read(resourceKey, { preferCache: false });
        upsertItem(resourceKey, { source: r.source, rev: r.rev, lastSyncAt: now(), lastEvent: "panel-refresh" });
        setMsg("ok", "refreshed " + resourceKey);
        render();
        renderPanel();
      } catch (e) {
        setMsg("warn", "refresh fail " + resourceKey);
      }
    }

    async function acquireOneLock(resourceKey) {
      resourceKey = str(resourceKey).trim();
      if (!resourceKey) return;

      // read-only: 直接不做（按鈕也已隱藏，這是保險）
      if (isReadOnly()) { setMsg("warn", "read-only (no lock)"); return; }

      if (!window.TasunDropboxStore || !window.TasunDropboxStore.lock || typeof window.TasunDropboxStore.lock.acquire !== "function") {
        setMsg("warn", "store.lock.acquire not available");
        return;
      }

      setMsg("info", "acquire lock " + resourceKey + " …");
      try {
        var owner = null;
        try {
          if (typeof window.TasunDropboxStore.ownerFromUser === "function") {
            owner = window.TasunDropboxStore.ownerFromUser(window.TasunDropboxStore.getUser && window.TasunDropboxStore.getUser());
          }
        } catch (e1) {}
        owner = owner || { username: "anonymous", role: "read", device: str(navigator.userAgent).slice(0, 120) };

        await window.TasunDropboxStore.lock.acquire(resourceKey, owner, { ttlSec: 90, waitMs: 8000, retryDelayMs: 650 });
        upsertItem(resourceKey, { lockHeld: true, lastSyncAt: now(), lastEvent: "lock-acquired" });
        setMsg("ok", "lock acquired " + resourceKey);
        render();
        renderPanel();
      } catch (e) {
        setMsg("warn", "lock busy/failed " + resourceKey);
        renderPanel();
      }
    }

    async function releaseOneLock(resourceKey) {
      resourceKey = str(resourceKey).trim();
      if (!resourceKey) return;

      if (isReadOnly()) { setMsg("warn", "read-only (no lock)"); return; }

      if (!window.TasunDropboxStore || !window.TasunDropboxStore.lock || typeof window.TasunDropboxStore.lock.release !== "function") {
        setMsg("warn", "store.lock.release not available");
        return;
      }

      setMsg("info", "release lock " + resourceKey + " …");
      try {
        await window.TasunDropboxStore.lock.release(resourceKey);
        upsertItem(resourceKey, { lockHeld: false, lastSyncAt: now(), lastEvent: "lock-released" });
        setMsg("ok", "lock released " + resourceKey);
        render();
        renderPanel();
      } catch (e) {
        setMsg("warn", "release failed " + resourceKey);
        renderPanel();
      }
    }

    async function refreshAllCloud() {
      if (!window.TasunDropboxStore || typeof window.TasunDropboxStore.read !== "function") { setMsg("warn", "store not ready"); return; }
      setMsg("info", "refresh cloud…");
      var keys = Object.keys(_items);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        try {
          var r = await window.TasunDropboxStore.read(k, { preferCache: false });
          upsertItem(k, { source: r.source, rev: r.rev, lastSyncAt: now(), lastEvent: "manual-refresh" });
        } catch (e) {
          upsertItem(k, { lastEvent: "manual-refresh-fail" });
        }
      }
      setMsg("ok", "refreshed");
      render();
      if (_panelMask && _panelMask.style.display === "flex") renderPanel();
    }

    function render() {
      if (!_root) return;

      var online = isOnline();
      var dot = _root.querySelector("[data-id='dot']");
      var net = _root.querySelector("[data-id='net']");
      dot.className = "sb-dot " + (online ? "on" : "off");
      net.textContent = online ? "ONLINE" : "OFFLINE";

      _root.querySelector("[data-id='ver']").textContent = getAppVer() || "--";

      var u = storeGetUser();
      var role = str(u.role || "read");
      _root.querySelector("[data-id='user']").textContent = str(u.username || "anonymous") + "(" + role + ")";
      _root.querySelector("[data-id='token']").textContent = tokenStatus();

      // 顯示模式（不改 UI，只是輕量提示）
      var modeEl = _root.querySelector("[data-id='mode']");
      modeEl.textContent = isReadOnly() ? "· RO" : "· RW";

      var msgEl = _root.querySelector("[data-id='msg']");
      var txt = _lastMsg.text || "ready";
      if (_lastMsg.at) txt = txt + " · " + fmtTime(_lastMsg.at);
      msgEl.textContent = txt;

      var itemsEl = _root.querySelector("[data-id='items']");
      itemsEl.innerHTML = "";

      var ks = Object.keys(_items);
      ks.sort(function (a, b) { return (Number(_items[b].lastSyncAt) || 0) - (Number(_items[a].lastSyncAt) || 0); });

      ks.forEach(function (k) {
        var it = _items[k];
        it.lockHeld = it.mgrRef && it.mgrRef.lock && typeof it.mgrRef.lock.isHolding === "function"
          ? !!it.mgrRef.lock.isHolding()
          : detectLockHeld(k);

        var lockTxt = it.lockHeld ? "LOCK" : "";
        var src = it.source ? it.source.toUpperCase() : "";
        var rev = shortRev(it.rev);
        var t = fmtTime(it.lastSyncAt);

        var div = document.createElement("div");
        div.className = "sb-pill sb-item";
        div.setAttribute("data-sb-key", it.key);
        div.title =
          "resource: " + it.key +
          (it.rev ? ("\nrev: " + it.rev) : "") +
          (it.source ? ("\nsource: " + it.source) : "") +
          (it.lastEvent ? ("\nevent: " + it.lastEvent) : "") +
          "\n(點一下開詳細面板)";

        div.innerHTML =
          "<span class='k'>" + escapeHtml(it.key) + "</span>" +
          "<span class='sb-muted'>·</span>" +
          "<span class='src'>" + escapeHtml(src || "--") + "</span>" +
          (rev ? ("<span class='sb-muted'>·</span><span class='v'>" + escapeHtml(rev) + "</span>") : "") +
          "<span class='sb-muted'>·</span><span class='v'>" + escapeHtml(t) + "</span>" +
          (lockTxt ? ("<span class='sb-muted'>·</span><span class='sb-strong'>" + lockTxt + "</span>") : "");

        itemsEl.appendChild(div);
      });
    }

    function attachEvents() {
      window.addEventListener("online", function () { setMsg("net", "online"); render(); }, { passive: true });
      window.addEventListener("offline", function () { setMsg("net", "offline"); render(); }, { passive: true });
      window.addEventListener("focus", function () { render(); }, { passive: true });
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") render(); }, { passive: true });

      window.addEventListener("tasun:store-sync", function (ev) {
        var d = ev && ev.detail ? ev.detail : null;
        if (!d) return;
        var k = str(d.resourceKey).trim(); if (!k) return;

        upsertItem(k, { source: d.source, rev: d.rev, lastSyncAt: now(), lastEvent: str(d.reason || "sync") });
        if (d.reason) setMsg("sync", "sync " + k + " (" + d.reason + ")");
        render();
        if (_panelKey === k && _panelMask && _panelMask.style.display === "flex") { applyPanelReadOnlyUI(); renderPanel(); }
      }, { passive: true });

      window.addEventListener("tasun:db-updated", function (ev) {
        var d = ev && ev.detail ? ev.detail : null;
        if (!d) return;
        var k = str(d.resourceKey).trim(); if (!k) return;

        upsertItem(k, { rev: str(d.rev || ""), lastSyncAt: now(), lastEvent: "db-updated" });
        setMsg("sync", "updated " + k);
        render();
        if (_panelKey === k && _panelMask && _panelMask.style.display === "flex") { applyPanelReadOnlyUI(); renderPanel(); }
      }, { passive: true });

      window.addEventListener("tasun:db-changed", function (ev) {
        var d = ev && ev.detail ? ev.detail : null;
        if (!d) return;
        var k = str(d.resourceKey).trim(); if (!k) return;

        upsertItem(k, { rev: str(d.rev || ""), lastSyncAt: now(), lastEvent: "db-changed" });
        setMsg("sync", "changed " + k);
        render();
        if (_panelKey === k && _panelMask && _panelMask.style.display === "flex") { applyPanelReadOnlyUI(); renderPanel(); }
      }, { passive: true });
    }

    Bar.version = BAR_VER;

    Bar.init = function (options) {
      options = options || {};
      _cfg.position = (options.position === "bottom") ? "bottom" : "top";
      _cfg.zIndex = clamp(Number(options.zIndex || _cfg.zIndex) || 99999, 1, 2147483000);
      _cfg.compact = !!options.compact;
      _cfg.showToken = !!options.showToken;
      _cfg.maxResources = clamp(Number(options.maxResources || _cfg.maxResources) || 6, 1, 30);
      _cfg.enableDetailPanel = (options.enableDetailPanel !== false);
      _cfg.enableActions = (options.enableActions !== false);

      ensureDOM();
      attachEvents();
      setMsg("ok", "statusbar ready");
      render();
      return Bar;
    };

    Bar.bind = function (mgr) {
      if (!mgr || typeof mgr !== "object") return Bar;
      var k = str(mgr.key || mgr.resourceKey || "").trim();
      if (!k) return Bar;

      upsertItem(k, {
        mgrRef: mgr,
        source: str(mgr.source || ""),
        rev: str(mgr.rev || ""),
        lastSyncAt: now(),
        lastEvent: "bind"
      });

      if (typeof mgr.on === "function") {
        try {
          mgr.on(function (evt) {
            if (!evt) return;
            upsertItem(k, {
              source: str(evt.source || mgr.source || ""),
              rev: str(evt.rev || mgr.rev || ""),
              lastSyncAt: now(),
              lastEvent: str(evt.reason || "mgr")
            });
            render();
            if (_panelKey === k && _panelMask && _panelMask.style.display === "flex") { applyPanelReadOnlyUI(); renderPanel(); }
          });
        } catch (e) {}
      }

      setMsg("ok", "bind " + k);
      render();
      return Bar;
    };

    Bar.track = function (resourceKey, patch) { upsertItem(resourceKey, patch || { lastSyncAt: now(), lastEvent: "track" }); render(); return Bar; };
    Bar.msg = function (text) { setMsg("info", text); return Bar; };
    Bar.warn = function (text) { setMsg("warn", text); return Bar; };
    Bar.error = function (text) { setMsg("error", text); return Bar; };
    Bar.render = function () { render(); return Bar; };

    // 讓外部在切換帳號後能刷新 RO/RW 狀態
    Bar.refreshPermissions = function () {
      render();
      if (_panelMask && _panelMask.style.display === "flex") { applyPanelReadOnlyUI(); renderPanel(); }
      return Bar;
    };

    window.TasunStatusBar = Bar;
  })();

  // =========================================================
  // 3) Facade: TasunCloudKit  (你每頁只要呼叫這個)
  // =========================================================
  (function () {
    var Kit = window.TasunCloudKit || {};
    var KIT_VER = "20260129_01";

    var _cfg = {
      appVer: "",
      resourcesUrl: "",
      resourcesInline: null,
      tokenKey: "tasun_dropbox_token_v1",
      getToken: null,
      getUser: null,
      fetchTimeoutMs: 12000,

      // defaults
      watch: true,
      watchIntervalSec: 8,
      lockTtlSec: 90,
      lockWaitMs: 8000,
      lockRetryDelayMs: 650,

      // UI
      statusbar: true,
      statusbarOptions: { position: "top", compact: false, showToken: false }
    };

    var _inited = false;
    var _managers = {}; // { [resourceKey]: mgr }

    function canWriteByRole(user) {
      var role = str(user && (user.role || user.permission) || "read").toLowerCase().trim();
      return (role === "admin" || role === "write");
    }

    function getUserSafe() {
      try { if (_cfg.getUser) { var u = _cfg.getUser(); if (u && typeof u === "object") return u; } } catch (e) {}
      try {
        if (window.TasunDropboxStore && typeof window.TasunDropboxStore.getUser === "function") return window.TasunDropboxStore.getUser();
      } catch (e2) {}
      return { username: "anonymous", role: "read" };
    }

    function isReadOnlyPage() {
      if (window.TASUN_READ_ONLY === true) return true;
      if (window.TASUN_READ_ONLY === false) return false;
      var u = getUserSafe();
      return !canWriteByRole(u);
    }

    function fireStoreSync(resourceKey, payload, rev, source, reason) {
      try {
        window.dispatchEvent(new CustomEvent("tasun:store-sync", {
          detail: {
            resourceKey: resourceKey,
            reason: str(reason || "sync"),
            source: str(source || ""),
            rev: str(rev || ""),
            at: now()
          }
        }));
      } catch (e) {}
    }

    function buildOnStatus(userOnStatus) {
      return function (type, msg, detail) {
        // feed statusbar
        try {
          if (window.TasunStatusBar) {
            if (type === "warn") window.TasunStatusBar.warn(msg);
            else if (type === "error") window.TasunStatusBar.error(msg);
            else window.TasunStatusBar.msg(msg);
          }
        } catch (e0) {}
        // user callback
        try { if (typeof userOnStatus === "function") userOnStatus(type, msg, detail || null); } catch (e1) {}
      };
    }

    // -----------------------------
    // Manager for one resourceKey
    // -----------------------------
    function createManager(resourceKey, opts) {
      opts = opts || {};
      var key = str(resourceKey).trim();
      if (!key) throw new Error("resourceKey required");

      var Store = window.TasunDropboxStore;

      var st = {
        key: key,
        payload: null,
        rev: "",
        source: "",
        lastSyncAt: 0,
        listeners: [],
        unwatch: null
      };

      function emit(evt) {
        for (var i = 0; i < st.listeners.length; i++) {
          try { st.listeners[i](evt); } catch (e) {}
        }
      }

      function on(fn) {
        if (typeof fn !== "function") return function () {};
        st.listeners.push(fn);
        return function () {
          var idx = st.listeners.indexOf(fn);
          if (idx >= 0) st.listeners.splice(idx, 1);
        };
      }

      function lockIsHolding() {
        try { return Store && Store.lock && typeof Store.lock.isHolding === "function" ? !!Store.lock.isHolding(key) : false; } catch (e) {}
        return false;
      }

      async function pull(reason) {
        var r = await Store.read(key, { preferCache: !!opts.preferCache });
        st.payload = r.payload;
        st.rev = r.rev || "";
        st.source = r.source || "";
        st.lastSyncAt = now();

        fireStoreSync(key, st.payload, st.rev, st.source, reason || "pull");
        emit({ reason: reason || "pull", source: st.source, rev: st.rev, payload: st.payload, at: st.lastSyncAt });
        return r;
      }

      async function ensureLock() {
        if (isReadOnlyPage()) throw new Error("read-only page (no lock)");
        if (lockIsHolding()) return true;

        var u = getUserSafe();
        var owner = null;
        try { owner = Store.ownerFromUser ? Store.ownerFromUser(u) : null; } catch (e) {}
        owner = owner || { username: str(u.username || "anonymous"), role: str(u.role || "read"), device: str(navigator.userAgent).slice(0, 160) };

        await Store.lock.acquire(key, owner, {
          ttlSec: clamp(Number(opts.lockTtlSec || _cfg.lockTtlSec) || 90, 30, 600),
          waitMs: clamp(Number(opts.lockWaitMs || _cfg.lockWaitMs) || 8000, 0, 60000),
          retryDelayMs: clamp(Number(opts.lockRetryDelayMs || _cfg.lockRetryDelayMs) || 650, 250, 5000)
        });
        return true;
      }

      async function save(payload, saveOpts) {
        saveOpts = saveOpts || {};
        if (isReadOnlyPage()) throw new Error("read-only page (cannot write)");

        await ensureLock();

        var target = payload || st.payload || { db: [], counter: 0, meta: {} };
        var wr = await Store.write(key, target, { rev: st.rev || "", requireLock: true });
        st.rev = wr.rev || "";
        st.source = "dropbox";
        st.payload = target;
        st.lastSyncAt = now();

        fireStoreSync(key, st.payload, st.rev, st.source, "save");
        emit({ reason: "save", source: st.source, rev: st.rev, payload: st.payload, at: st.lastSyncAt });

        // 預設「自動釋放鎖」：更適合多人維護（不容易卡死）
        var autoRelease = (saveOpts.autoRelease !== false);
        if (autoRelease) { try { await Store.lock.release(key); } catch (e2) {} }

        return wr;
      }

      async function transact(mutator, txOpts) {
        txOpts = txOpts || {};
        if (isReadOnlyPage()) throw new Error("read-only page (cannot transaction)");

        var u = getUserSafe();
        var owner = null;
        try { owner = Store.ownerFromUser ? Store.ownerFromUser(u) : null; } catch (e) {}
        owner = owner || { username: str(u.username || "anonymous"), role: str(u.role || "read"), device: str(navigator.userAgent).slice(0, 160) };

        var ttlSec = clamp(Number(txOpts.ttlSec || opts.lockTtlSec || _cfg.lockTtlSec) || 90, 30, 600);

        var out = await Store.transaction(key, mutator, {
          owner: owner,
          ttlSec: ttlSec,
          waitMs: txOpts.waitMs || opts.lockWaitMs || _cfg.lockWaitMs,
          retryDelayMs: txOpts.retryDelayMs || opts.lockRetryDelayMs || _cfg.lockRetryDelayMs
        });

        st.payload = out.payload;
        st.rev = out.rev || st.rev;
        st.source = "dropbox";
        st.lastSyncAt = now();

        fireStoreSync(key, st.payload, st.rev, st.source, "transaction");
        emit({ reason: "transaction", source: st.source, rev: st.rev, payload: st.payload, at: st.lastSyncAt });

        return out;
      }

      function startWatch() {
        if (!Store || typeof Store.watch !== "function") return;
        if (st.unwatch) { try { st.unwatch(); } catch (e0) {} st.unwatch = null; }

        var enable = (opts.watch !== false);
        if (!enable) return;

        var intervalSec = clamp(Number(opts.watchIntervalSec || _cfg.watchIntervalSec) || 8, 3, 120);
        st.unwatch = Store.watch(key, {
          intervalSec: intervalSec,
          onChange: async function (info) {
            // rev changed -> pull newest
            try { await pull("watch"); } catch (e1) {}
          }
        });
      }

      function stopWatch() {
        if (st.unwatch) { try { st.unwatch(); } catch (e) {} }
        st.unwatch = null;
      }

      var mgr = {
        key: key,
        get payload() { return st.payload; },
        get rev() { return st.rev; },
        get source() { return st.source; },
        get lastSyncAt() { return st.lastSyncAt; },

        on: on,

        pull: pull,
        save: save,
        transaction: transact,

        lock: {
          isHolding: function () { return lockIsHolding(); },
          acquire: async function () { await ensureLock(); return true; },
          release: async function () { if (Store && Store.lock) return await Store.lock.release(key); return false; }
        },

        watch: {
          start: startWatch,
          stop: stopWatch
        },

        dispose: function () { stopWatch(); st.listeners = []; }
      };

      return { mgr: mgr, pull: pull, startWatch: startWatch };
    }

    // -----------------------------
    // Public API
    // -----------------------------
    Kit.version = KIT_VER;

    Kit.init = function (options) {
      options = options || {};
      _cfg.appVer = str(options.appVer || window.TASUN_APP_VER || window.__CACHE_V || "").trim();
      _cfg.resourcesUrl = str(options.resourcesUrl || "").trim();
      _cfg.resourcesInline = options.resourcesInline && typeof options.resourcesInline === "object" ? options.resourcesInline : null;

      _cfg.tokenKey = str(options.tokenKey || _cfg.tokenKey);
      _cfg.getToken = (typeof options.getToken === "function") ? options.getToken : null;
      _cfg.getUser = (typeof options.getUser === "function") ? options.getUser : null;
      _cfg.fetchTimeoutMs = Number(options.fetchTimeoutMs) || _cfg.fetchTimeoutMs;

      _cfg.watch = (options.watch !== false);
      _cfg.watchIntervalSec = clamp(Number(options.watchIntervalSec || _cfg.watchIntervalSec) || 8, 3, 120);

      _cfg.lockTtlSec = clamp(Number(options.lockTtlSec || _cfg.lockTtlSec) || 90, 30, 600);
      _cfg.lockWaitMs = clamp(Number(options.lockWaitMs || _cfg.lockWaitMs) || 8000, 0, 60000);
      _cfg.lockRetryDelayMs = clamp(Number(options.lockRetryDelayMs || _cfg.lockRetryDelayMs) || 650, 250, 5000);

      _cfg.statusbar = (options.statusbar !== false);
      _cfg.statusbarOptions = Object.assign({}, _cfg.statusbarOptions, (options.statusbarOptions || {}));

      // init Store
      var Store = window.TasunDropboxStore;
      Store.init({
        appVer: _cfg.appVer,
        resourcesUrl: _cfg.resourcesUrl,
        resourcesInline: _cfg.resourcesInline,
        tokenKey: _cfg.tokenKey,
        getToken: _cfg.getToken,
        getUser: _cfg.getUser,
        fetchTimeoutMs: _cfg.fetchTimeoutMs,
        onStatus: buildOnStatus(options.onStatus)
      });

      // init StatusBar
      if (_cfg.statusbar && window.TasunStatusBar) {
        window.TasunStatusBar.init(_cfg.statusbarOptions);
      }

      _inited = true;
      return Kit;
    };

    Kit.ready = async function () {
      if (!_inited) Kit.init({});
      if (window.TasunDropboxStore && typeof window.TasunDropboxStore.ready === "function") await window.TasunDropboxStore.ready();
      // statusbar refresh RO/RW
      try { if (window.TasunStatusBar && typeof window.TasunStatusBar.refreshPermissions === "function") window.TasunStatusBar.refreshPermissions(); } catch (e) {}
      return true;
    };

    // 一頁最常用：open(resourceKey) -> 自動 pull + 自動 watch + 自動綁 statusbar
    Kit.open = async function (resourceKey, opts) {
      opts = opts || {};
      if (!_inited) Kit.init({});
      await Kit.ready();

      var key = str(resourceKey).trim();
      if (!key) throw new Error("resourceKey required");

      // reuse
      if (_managers[key]) return _managers[key];

      // merge default options
      var finalOpts = Object.assign({
        watch: _cfg.watch,
        watchIntervalSec: _cfg.watchIntervalSec,
        lockTtlSec: _cfg.lockTtlSec,
        lockWaitMs: _cfg.lockWaitMs,
        lockRetryDelayMs: _cfg.lockRetryDelayMs,
        preferCache: true
      }, opts);

      var built = createManager(key, finalOpts);
      var mgr = built.mgr;

      // initial pull (preferCache true to keep fast; then immediate cloud pull if you want)
      await built.pull("open");

      // start watch (auto sync)
      built.startWatch();

      // bind statusbar (track)
      try { if (window.TasunStatusBar) window.TasunStatusBar.bind(mgr); } catch (e) {}

      _managers[key] = mgr;
      return mgr;
    };

    // 切換帳號後呼叫：刷新狀態列 RO/RW & panel 按鈕
    Kit.refreshPermissions = function () {
      try { if (window.TasunStatusBar && typeof window.TasunStatusBar.refreshPermissions === "function") window.TasunStatusBar.refreshPermissions(); } catch (e) {}
      return Kit;
    };

    // 給外部查
    Kit.isReadOnly = function () { return isReadOnlyPage(); };
    Kit.getUser = function () { return getUserSafe(); };

    window.TasunCloudKit = Kit;
  })();

})(window, document);
