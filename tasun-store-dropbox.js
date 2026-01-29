/* tasun-store-dropbox.js
 * Shared Dropbox JSON Store + Lock (client-side)
 * - Supports resource registry (tasun-resources.json)
 * - Read/Write JSON to Dropbox path (via Dropbox API v2)
 * - Cooperative lock file (ttl + heartbeat)
 * - Watch rev changes
 *
 * Author: Tasun Shared Module
 */
(function (window, document) {
  "use strict";

  var Store = window.TasunDropboxStore || {};
  var STORE_VER = "20260128_01";

  // -----------------------------
  // Utils
  // -----------------------------
  function str(v) { return (v === undefined || v === null) ? "" : String(v); }
  function now() { return Date.now(); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function jsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }

  function safeJsonStringify(obj) {
    try { return JSON.stringify(obj); } catch (e) { return ""; }
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function uuid() {
    // good-enough unique id for lock session
    var a = Math.random().toString(16).slice(2);
    return "u" + Date.now().toString(16) + "_" + a;
  }

  function addV(url, v) {
    var u = str(url);
    var vv = str(v).trim();
    if (!vv) return u;
    try {
      var uu = new URL(u, document.baseURI);
      uu.searchParams.set("v", vv);
      return uu.toString();
    } catch (e) {
      // fallback
      return u + (u.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }

  function pick(obj, keys, fallback) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return fallback;
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

  // -----------------------------
  // Internal state
  // -----------------------------
  var _cfg = {
    appVer: "",
    resourcesUrl: "",        // e.g. tasun-resources.json (recommended)
    resourcesInline: null,   // optional inline resources object
    tokenKey: "tasun_dropbox_token_v1",
    getToken: null,          // optional function() => token
    getUser: null,           // optional function() => {username, role}
    onStatus: null,          // optional function(type,msg,detail)
    fetchTimeoutMs: 12000,
    cachePrefix: "tasun_dbx_store__v1__"
  };

  var _registry = null;       // loaded resources registry
  var _registryLoaded = false;
  var _registryLoading = null;

  // per resource cache: {payload, rev, loadedAt}
  var _memCache = {};

  // lock states per resource
  var _locks = {}; // { [resourceKey]: { lockId, ownerId, expiresAt, hbTimer, ttlSec, lastLockObj } }

  function status(type, msg, detail) {
    try {
      if (typeof _cfg.onStatus === "function") _cfg.onStatus(type, msg, detail || null);
    } catch (e) {}
  }

  function getToken() {
    try {
      if (typeof _cfg.getToken === "function") {
        var t = _cfg.getToken();
        return str(t).trim();
      }
    } catch (e) {}
    try {
      return str(localStorage.getItem(_cfg.tokenKey)).trim();
    } catch (e2) {}
    return "";
  }

  function getUser() {
    try {
      if (typeof _cfg.getUser === "function") {
        var u = _cfg.getUser();
        if (u && typeof u === "object") return u;
      }
    } catch (e) {}
    // fallback: best effort (anonymous)
    return { username: "anonymous", role: "read" };
  }

  function ownerFromUser(u) {
    u = u || getUser();
    var username = str(u.username || u.user || u.name || "anonymous").trim() || "anonymous";
    var role = str(u.role || u.permission || "read").trim() || "read";
    // device fingerprint (lightweight)
    var device = str(navigator.userAgent).slice(0, 160);
    return { username: username, role: role, device: device };
  }

  // -----------------------------
  // Dropbox API v2 helpers (path-based)
  // -----------------------------
  var DBX = {
    downloadUrl: "https://content.dropboxapi.com/2/files/download",
    uploadUrl: "https://content.dropboxapi.com/2/files/upload",
    metaUrl: "https://api.dropboxapi.com/2/files/get_metadata"
  };

  async function dbxDownloadPath(path) {
    var token = getToken();
    if (!token) throw new Error("Dropbox token missing.");

    var arg = { path: path };
    var res = await fetchWithTimeout(DBX.downloadUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Dropbox-API-Arg": JSON.stringify(arg)
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
    var meta = await res.json();
    return meta;
  }

  async function dbxUploadPath(path, contentText, modeObj) {
    var token = getToken();
    if (!token) throw new Error("Dropbox token missing.");

    // modeObj:
    // - { ".tag":"overwrite" }
    // - { ".tag":"add" }
    // - { ".tag":"update", "update": "<rev>" }  // safest
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

    var meta = await res.json();
    return meta;
  }

  // -----------------------------
  // Registry (tasun-resources.json)
  // format:
  // {
  //   "sxdh-notes": { "db": {"path":"/Tasun/sxdh-notes.json"}, "lock":{"path":"/Tasun/sxdh-notes-lock.json2"} }
  // }
  // -----------------------------
  function regCacheKey() {
    return _cfg.cachePrefix + "registry";
  }

  async function loadRegistry() {
    if (_registryLoaded) return _registry || {};
    if (_registryLoading) return _registryLoading;

    _registryLoading = (async function () {
      // inline registry wins
      if (_cfg.resourcesInline && typeof _cfg.resourcesInline === "object") {
        _registry = _cfg.resourcesInline;
        _registryLoaded = true;
        try { localStorage.setItem(regCacheKey(), safeJsonStringify(_registry)); } catch (e) {}
        return _registry;
      }

      var url = str(_cfg.resourcesUrl).trim();
      if (!url) {
        // fallback: try cached
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
        // fallback to cached
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

  function resolveResource(resourceKey) {
    var reg = _registry || {};
    var r = reg[resourceKey];
    if (!r || typeof r !== "object") return null;

    // allow shortcuts:
    // r.db.path / r.lock.path
    // r.db.url  / r.lock.url (read-only)
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
  // Payload normalize
  // We keep generic, your pages can define schema. This store only ensures object shape.
  // -----------------------------
  function normalizePayload(obj, resourceKey) {
    obj = (obj && typeof obj === "object") ? obj : {};
    if (!obj.meta || typeof obj.meta !== "object") obj.meta = {};
    if (!obj.meta.resource) obj.meta.resource = resourceKey;
    if (!obj.meta.schema) obj.meta.schema = "tasun.db.v1";
    if (!obj.meta.updatedAt) obj.meta.updatedAt = new Date().toISOString();

    if (!Array.isArray(obj.db)) obj.db = [];
    // counter is optional
    if (obj.counter === undefined || obj.counter === null) obj.counter = 0;

    return obj;
  }

  function payloadCacheKey(resourceKey) {
    return _cfg.cachePrefix + "payload__" + resourceKey;
  }

  function savePayloadCache(resourceKey, payload, rev) {
    try {
      localStorage.setItem(payloadCacheKey(resourceKey), safeJsonStringify({
        savedAt: now(),
        rev: str(rev),
        payload: payload
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
  // Public: read/write payload
  // -----------------------------
  async function read(resourceKey, opts) {
    opts = opts || {};
    await loadRegistry();
    var res = resolveResource(resourceKey);
    if (!res) throw new Error("Unknown resourceKey: " + resourceKey);

    var preferCache = !!opts.preferCache;
    var allowHttpReadOnly = (opts.allowHttpReadOnly !== false);

    // in-memory cache
    if (preferCache && _memCache[resourceKey] && _memCache[resourceKey].payload) {
      return {
        payload: _memCache[resourceKey].payload,
        rev: _memCache[resourceKey].rev || "",
        source: "mem"
      };
    }

    // Try Dropbox path first
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

    // HTTP read-only fallback (if url exists)
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

    // Local cache
    var c = loadPayloadCache(resourceKey);
    if (c && c.payload) {
      var p = normalizePayload(c.payload, resourceKey);
      _memCache[resourceKey] = { payload: p, rev: str(c.rev || ""), loadedAt: now() };
      return { payload: p, rev: str(c.rev || ""), source: "cache" };
    }

    // nothing
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

    // lock required (recommended)
    if (opts.requireLock !== false) {
      var ls = _locks[resourceKey];
      if (!ls || !ls.lockId) throw new Error("Lock not held. Acquire lock before write.");
    }

    var p = normalizePayload(payload, resourceKey);
    // update meta
    p.meta.updatedAt = new Date().toISOString();
    var u = ownerFromUser(getUser());
    p.meta.updatedBy = u.username;
    p.meta.updatedRole = u.role;
    p.meta.storeVer = STORE_VER;

    var text = JSON.stringify(p, null, 2);

    // safest: update with known rev
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
  // lock payload:
  // {
  //   schema:"tasun.lock.v1",
  //   resource:"sxdh-notes",
  //   lockId:"...",
  //   owner:{username,role,device},
  //   acquiredAt: 123,
  //   heartbeatAt: 123,
  //   expiresAt: 123,
  //   ttlSec: 90
  // }
  // -----------------------------
  function lockCacheKey(resourceKey) {
    return _cfg.cachePrefix + "lock__" + resourceKey;
  }

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

    // Dropbox path first
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

    // HTTP read-only fallback
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

    // cache
    var c = loadLockCache(resourceKey);
    if (c && c.lock) {
      return { lock: normalizeLock(c.lock, resourceKey), rev: str(c.rev || ""), source: "cache" };
    }

    // empty lock
    var empty = normalizeLock({}, resourceKey);
    return { lock: empty, rev: "", source: "empty" };
  }

  async function writeLock(resourceKey, lockObj, opts) {
    opts = opts || {};
    await loadRegistry();
    var res = resolveResource(resourceKey);
    if (!res) throw new Error("Unknown resourceKey: " + resourceKey);
    if (!res.lock.path) throw new Error("This resource has no Dropbox lock.path (cannot write lock).");

    var obj = normalizeLock(lockObj, resourceKey);
    var text = JSON.stringify(obj, null, 2);

    // update with known rev to avoid overwriting someone else’s lock
    var rev = str(opts.rev || "");
    var mode = rev ? { ".tag": "update", update: rev } : { ".tag": "overwrite" };

    var meta = await dbxUploadPath(res.lock.path, text, mode);
    var newRev = meta && meta.rev ? meta.rev : "";

    saveLockCache(resourceKey, obj, newRev);
    return { rev: newRev, meta: meta };
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

    var myOwnerId = str(owner.username) + "|" + str(owner.role) + "|" + str(owner.device);
    var myLockId = uuid();

    var start = now();
    while (true) {
      // read current lock
      var cur = await readLock(resourceKey);
      var lockObj = normalizeLock(cur.lock, resourceKey);
      var curRev = str(cur.rev || "");

      var free = (!lockObj.lockId) || isExpired(lockObj);
      var mine = (!!lockObj.lockId) && (str(lockObj.owner && lockObj.owner.username) === str(owner.username));

      if (free) {
        // try to claim
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
          // Important: update with current rev if exists (prevents race)
          var wr = await writeLock(resourceKey, newLock, { rev: curRev });
          // success
          _locks[resourceKey] = {
            lockId: myLockId,
            ownerId: myOwnerId,
            expiresAt: newLock.expiresAt,
            ttlSec: ttlSec,
            lastLockObj: newLock,
            lockRev: wr.rev || ""
          };
          startHeartbeat(resourceKey);
          status("info", "已取得鎖", { resourceKey: resourceKey, owner: owner.username, ttlSec: ttlSec });
          return { lockId: myLockId, expiresAt: newLock.expiresAt, ttlSec: ttlSec };
        } catch (e1) {
          // someone else may have updated lock; retry
          status("warn", "取得鎖失敗，重試中…", { resourceKey: resourceKey, error: str(e1 && e1.message) });
        }
      } else {
        // occupied
        var who = (lockObj.owner && lockObj.owner.username) ? lockObj.owner.username : "unknown";
        var leftMs = (Number(lockObj.expiresAt) || 0) - now();
        status("info", "鎖被占用：" + who, { resourceKey: resourceKey, leftMs: leftMs });
      }

      if (waitMs <= 0) throw new Error("Lock busy.");
      if (now() - start > waitMs) throw new Error("Lock timeout.");
      await sleep(retryDelayMs);
    }
  }

  function startHeartbeat(resourceKey) {
    var st = _locks[resourceKey];
    if (!st || !st.lockId) return;
    if (st.hbTimer) return;

    // heartbeat interval = ttlSec/2 (min 10s)
    var intervalMs = Math.max(10000, Math.floor(st.ttlSec * 1000 / 2));

    st.hbTimer = setInterval(function () {
      heartbeat(resourceKey).catch(function () {});
    }, intervalMs);
  }

  async function heartbeat(resourceKey) {
    var st = _locks[resourceKey];
    if (!st || !st.lockId) return false;

    // re-read lock (avoid extending someone else)
    var cur = await readLock(resourceKey);
    var lockObj = normalizeLock(cur.lock, resourceKey);
    var curRev = str(cur.rev || "");

    if (str(lockObj.lockId) !== str(st.lockId)) {
      // lost lock
      stopHeartbeat(resourceKey);
      delete _locks[resourceKey];
      status("warn", "已失去鎖（lockId 不一致）", { resourceKey: resourceKey });
      return false;
    }

    // extend
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

  function stopHeartbeat(resourceKey) {
    var st = _locks[resourceKey];
    if (!st) return;
    if (st.hbTimer) {
      try { clearInterval(st.hbTimer); } catch (e) {}
      st.hbTimer = null;
    }
  }

  async function release(resourceKey) {
    var st = _locks[resourceKey];
    if (!st || !st.lockId) return true;

    try {
      // read & verify still mine
      var cur = await readLock(resourceKey);
      var lockObj = normalizeLock(cur.lock, resourceKey);
      var curRev = str(cur.rev || "");

      if (str(lockObj.lockId) !== str(st.lockId)) {
        // already replaced / expired
        stopHeartbeat(resourceKey);
        delete _locks[resourceKey];
        return true;
      }

      // release by expiring it
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
  // Watch rev changes (poll Dropbox metadata)
  // -----------------------------
  var _watchers = {}; // { [resourceKey]: {timer, intervalMs, lastRev, onChange} }

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

    var w = {
      intervalMs: intervalSec * 1000,
      timer: null,
      lastRev: "",
      onChange: onChange
    };
    _watchers[resourceKey] = w;

    w.timer = setInterval(function () {
      (async function () {
        try {
          var r = await getDbRev(resourceKey);
          if (!w.lastRev) w.lastRev = r;
          if (r && w.lastRev && r !== w.lastRev) {
            w.lastRev = r;
            // refresh memory cache
            try { await read(resourceKey, { preferCache: false }); } catch (e2) {}
            if (w.onChange) w.onChange({ resourceKey: resourceKey, rev: r });
            try {
              window.dispatchEvent(new CustomEvent("tasun:db-changed", { detail: { resourceKey: resourceKey, rev: r } }));
            } catch (e3) {}
          }
        } catch (e) {
          // ignore occasional errors
        }
      })();
    }, w.intervalMs);

    return function () { unwatch(resourceKey); };
  }

  function unwatch(resourceKey) {
    var w = _watchers[resourceKey];
    if (!w) return;
    if (w.timer) {
      try { clearInterval(w.timer); } catch (e) {}
    }
    delete _watchers[resourceKey];
  }

  // -----------------------------
  // Transaction helper
  // acquire lock -> read latest -> mutate -> write -> release
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
  // Init / Ready
  // -----------------------------
  Store.init = function (options) {
    options = options || {};
    _cfg.appVer = str(options.appVer || window.TASUN_APP_VER || "").trim();
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

    // reset registry load status if changed
    _registryLoaded = false;
    _registry = null;
    _registryLoading = null;

    status("info", "TasunDropboxStore init", { storeVer: STORE_VER, appVer: _cfg.appVer });
    return Store;
  };

  Store.ready = async function () {
    await loadRegistry();
    return true;
  };

  // basic getters
  Store.getToken = getToken;
  Store.getUser = getUser;
  Store.ownerFromUser = ownerFromUser;

  // registry / resolve
  Store.loadRegistry = loadRegistry;
  Store.resolve = function (resourceKey) {
    return resolveResource(resourceKey);
  };

  // data
  Store.read = read;
  Store.write = write;
  Store.transaction = transaction;

  // lock
  Store.lock = {
    read: readLock,
    acquire: acquire,
    heartbeat: heartbeat,
    release: release,
    isHolding: isHolding
  };

  // watch
  Store.watch = watch;
  Store.unwatch = unwatch;

  // expose
  window.TasunDropboxStore = Store;

})(window, document);

