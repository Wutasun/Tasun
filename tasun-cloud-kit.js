/* tasun-cloud-kit.js
 * Tasun Standard Cloud Kit (Dropbox JSON Store + Lock + Watch + Auto-merge)
 * - One file for all pages: read/write/lock/watch + status bar + merge-safe save
 * - Does NOT change your page UI (only adds a small fixed status bar overlay)
 * - Auto detects read-only and hides lock buttons
 *
 * Public minimal API (fixed):
 *   TasunCloudKit.init(opts)
 *   TasunCloudKit.mount(pageOpts) -> cloud instance
 *   cloud.ready, cloud.syncNow(), cloud.saveMerged(), cloud.status(), cloud.destroy()
 *   cloud.store (low-level): read/write/lock/watch/unwatch
 */
(function (window, document) {
  "use strict";

  // ============================================================
  // 0) Utils
  // ============================================================
  function str(v){ return (v===undefined||v===null) ? "" : String(v); }
  function now(){ return Date.now(); }
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  function jsonParse(s, fallback){ try{ return JSON.parse(s); }catch(e){ return fallback; } }
  function safeJsonStringify(o){ try{ return JSON.stringify(o); }catch(e){ return ""; } }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  function uuid(){
    var a = Math.random().toString(16).slice(2);
    return "u" + Date.now().toString(16) + "_" + a;
  }

  function addV(url, v){
    var u = str(url);
    var vv = str(v).trim();
    if(!vv) return u;
    try{
      var uu = new URL(u, document.baseURI);
      uu.searchParams.set("v", vv);
      return uu.toString();
    }catch(e){
      return u + (u.indexOf("?")>=0 ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }

  function deepClone(obj){
    return jsonParse(safeJsonStringify(obj), null);
  }

  function stablePickRow(row){
    // for diff: ignore volatile keys
    if(!row || typeof row!=="object") return {};
    var out = {};
    Object.keys(row).sort().forEach(function(k){
      if(k==="updatedAt" || k==="createdAt" || k==="__ts") return;
      if(k==="meta") return;
      out[k] = row[k];
    });
    return out;
  }

  function rowFingerprint(row){
    return safeJsonStringify(stablePickRow(row)) || "";
  }

  function isObj(x){ return x && typeof x==="object"; }

  // ============================================================
  // 1) Dropbox Store (embedded) => window.TasunDropboxStore
  // ============================================================
  var Store = window.TasunDropboxStore || {};
  var STORE_VER = Store.storeVer || "20260129_01";

  var _storeCfg = {
    appVer: "",
    resourcesUrl: "tasun-resources.json",
    resourcesInline: null,
    tokenKey: "tasun_dropbox_token_v1",
    getToken: null,
    getUser: null,
    onStatus: null,
    fetchTimeoutMs: 12000,
    cachePrefix: "tasun_dbx_store__v1__"
  };

  var _registry = null, _registryLoaded=false, _registryLoading=null;
  var _memCache = {};       // { [key]: {payload, rev, loadedAt} }
  var _locks = {};          // lock states
  var _watchers = {};       // watchers

  function storeStatus(type,msg,detail){
    try{ if(typeof _storeCfg.onStatus==="function") _storeCfg.onStatus(type,msg,detail||null); }catch(e){}
  }

  function storeGetToken(){
    try{
      if(typeof _storeCfg.getToken==="function") return str(_storeCfg.getToken()).trim();
    }catch(e){}
    try{ return str(localStorage.getItem(_storeCfg.tokenKey)).trim(); }catch(e2){}
    return "";
  }

  function storeGetUser(){
    try{
      if(typeof _storeCfg.getUser==="function"){
        var u = _storeCfg.getUser();
        if(u && typeof u==="object") return u;
      }
    }catch(e){}
    return { username:"anonymous", role:"read" };
  }

  function ownerFromUser(u){
    u = u || storeGetUser();
    var username = str(u.username||u.user||u.name||"anonymous").trim() || "anonymous";
    var role = str(u.role||u.permission||"read").trim() || "read";
    var device = str(navigator.userAgent).slice(0,160);
    return { username: username, role: role, device: device };
  }

  async function fetchWithTimeout(url, options, timeoutMs){
    timeoutMs = clamp(Number(timeoutMs)||12000, 2000, 60000);
    var ctrl = new AbortController();
    var t = setTimeout(function(){ try{ ctrl.abort(); }catch(e){} }, timeoutMs);
    try{
      options = options || {};
      options.signal = ctrl.signal;
      return await fetch(url, options);
    }finally{
      clearTimeout(t);
    }
  }

  var DBX = {
    downloadUrl: "https://content.dropboxapi.com/2/files/download",
    uploadUrl:   "https://content.dropboxapi.com/2/files/upload",
    metaUrl:     "https://api.dropboxapi.com/2/files/get_metadata"
  };

  async function dbxDownloadPath(path){
    var token = storeGetToken();
    if(!token) throw new Error("Dropbox token missing.");
    var res = await fetchWithTimeout(DBX.downloadUrl, {
      method:"POST",
      headers:{
        "Authorization":"Bearer "+token,
        "Dropbox-API-Arg": JSON.stringify({ path: path })
      }
    }, _storeCfg.fetchTimeoutMs);

    if(!res.ok){
      var tx = await res.text().catch(function(){return "";});
      throw new Error("Dropbox download failed: "+res.status+" "+tx);
    }
    var metaHeader = res.headers.get("dropbox-api-result");
    var meta = metaHeader ? jsonParse(metaHeader,null) : null;
    var text = await res.text();
    return { text:text, meta:meta, rev:(meta&&meta.rev)?meta.rev:"" };
  }

  async function dbxGetMetadata(path){
    var token = storeGetToken();
    if(!token) throw new Error("Dropbox token missing.");
    var res = await fetchWithTimeout(DBX.metaUrl, {
      method:"POST",
      headers:{
        "Authorization":"Bearer "+token,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({ path:path, include_deleted:false })
    }, _storeCfg.fetchTimeoutMs);

    if(!res.ok){
      var tx = await res.text().catch(function(){return "";});
      throw new Error("Dropbox metadata failed: "+res.status+" "+tx);
    }
    return await res.json();
  }

  async function dbxUploadPath(path, contentText, modeObj){
    var token = storeGetToken();
    if(!token) throw new Error("Dropbox token missing.");
    var arg = {
      path: path,
      mode: modeObj || { ".tag":"overwrite" },
      autorename:false,
      mute:true,
      strict_conflict:true
    };
    var res = await fetchWithTimeout(DBX.uploadUrl, {
      method:"POST",
      headers:{
        "Authorization":"Bearer "+token,
        "Content-Type":"application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify(arg)
      },
      body: contentText
    }, _storeCfg.fetchTimeoutMs);

    if(!res.ok){
      var tx = await res.text().catch(function(){return "";});
      throw new Error("Dropbox upload failed: "+res.status+" "+tx);
    }
    return await res.json();
  }

  function regCacheKey(){ return _storeCfg.cachePrefix + "registry"; }

  async function loadRegistry(){
    if(_registryLoaded) return _registry || {};
    if(_registryLoading) return _registryLoading;

    _registryLoading = (async function(){
      if(_storeCfg.resourcesInline && typeof _storeCfg.resourcesInline==="object"){
        _registry = _storeCfg.resourcesInline;
        _registryLoaded = true;
        try{ localStorage.setItem(regCacheKey(), safeJsonStringify(_registry)); }catch(e){}
        return _registry;
      }

      var url = str(_storeCfg.resourcesUrl).trim();
      if(!url){
        var cached = null;
        try{ cached = jsonParse(localStorage.getItem(regCacheKey()), null); }catch(e2){}
        _registry = (cached && typeof cached==="object") ? cached : {};
        _registryLoaded = true;
        return _registry;
      }

      var finalUrl = addV(url, _storeCfg.appVer);
      try{
        var res = await fetchWithTimeout(finalUrl, { method:"GET", cache:"no-store" }, _storeCfg.fetchTimeoutMs);
        if(!res.ok) throw new Error("registry http "+res.status);
        var obj = await res.json();
        _registry = (obj && typeof obj==="object") ? obj : {};
        _registryLoaded = true;
        try{ localStorage.setItem(regCacheKey(), safeJsonStringify(_registry)); }catch(e3){}
        return _registry;
      }catch(e){
        var cached2=null;
        try{ cached2=jsonParse(localStorage.getItem(regCacheKey()), null); }catch(e4){}
        _registry = (cached2 && typeof cached2==="object") ? cached2 : {};
        _registryLoaded = true;
        storeStatus("warn","資源表讀取失敗，改用快取（可能不是最新）",{ error:str(e&&e.message) });
        return _registry;
      }finally{
        _registryLoading = null;
      }
    })();

    return _registryLoading;
  }

  function pick(obj, keys, fallback){
    for(var i=0;i<keys.length;i++){
      var k=keys[i];
      if(obj && obj[k]!==undefined && obj[k]!==null) return obj[k];
    }
    return fallback;
  }

  function resolveResource(resourceKey){
    var reg = _registry || {};
    var r = reg[resourceKey];
    if(!r || typeof r!=="object") return null;
    var db = r.db || {};
    var lock = r.lock || {};

    return {
      key: resourceKey,
      db: {
        path: str(pick(db,["path","dropboxPath"],"")).trim(),
        url:  str(pick(db,["url","rawUrl","httpUrl"],"")).trim()
      },
      lock: {
        path: str(pick(lock,["path","dropboxPath"],"")).trim(),
        url:  str(pick(lock,["url","rawUrl","httpUrl"],"")).trim()
      },
      meta: r.meta || {}
    };
  }

  function normalizePayload(obj, resourceKey){
    obj = (obj && typeof obj==="object") ? obj : {};
    if(!obj.meta || typeof obj.meta!=="object") obj.meta = {};
    if(!obj.meta.resource) obj.meta.resource = resourceKey;
    if(!obj.meta.schema) obj.meta.schema = "tasun.db.v1";
    if(!obj.meta.updatedAt) obj.meta.updatedAt = new Date().toISOString();
    if(!Array.isArray(obj.db)) obj.db = [];
    if(obj.counter===undefined || obj.counter===null) obj.counter = 0;
    return obj;
  }

  function payloadCacheKey(resourceKey){ return _storeCfg.cachePrefix + "payload__" + resourceKey; }
  function savePayloadCache(resourceKey, payload, rev){
    try{
      localStorage.setItem(payloadCacheKey(resourceKey), safeJsonStringify({ savedAt: now(), rev: str(rev), payload: payload }));
    }catch(e){}
  }
  function loadPayloadCache(resourceKey){
    try{
      var o = jsonParse(localStorage.getItem(payloadCacheKey(resourceKey)), null);
      if(o && o.payload) return o;
    }catch(e){}
    return null;
  }

  async function storeRead(resourceKey, opts){
    opts = opts || {};
    await loadRegistry();
    var res = resolveResource(resourceKey);
    if(!res) throw new Error("Unknown resourceKey: "+resourceKey);

    if(!!opts.preferCache && _memCache[resourceKey] && _memCache[resourceKey].payload){
      return { payload:_memCache[resourceKey].payload, rev:_memCache[resourceKey].rev||"", source:"mem" };
    }

    if(res.db.path){
      try{
        var dl = await dbxDownloadPath(res.db.path);
        var obj = jsonParse(dl.text, null);
        if(!obj) throw new Error("db json parse failed");
        obj = normalizePayload(obj, resourceKey);
        _memCache[resourceKey] = { payload:obj, rev:dl.rev||"", loadedAt:now() };
        savePayloadCache(resourceKey, obj, dl.rev||"");
        return { payload:obj, rev:dl.rev||"", source:"dropbox" };
      }catch(e1){
        storeStatus("warn","Dropbox 讀取失敗，改用快取/HTTP（若有）",{ resourceKey:resourceKey, error:str(e1&&e1.message) });
      }
    }

    if(opts.allowHttpReadOnly!==false && res.db.url){
      try{
        var url = addV(res.db.url, _storeCfg.appVer);
        var r2 = await fetchWithTimeout(url, { method:"GET", cache:"no-store" }, _storeCfg.fetchTimeoutMs);
        if(!r2.ok) throw new Error("http "+r2.status);
        var obj2 = await r2.json();
        obj2 = normalizePayload(obj2, resourceKey);
        _memCache[resourceKey] = { payload:obj2, rev:"", loadedAt:now() };
        savePayloadCache(resourceKey, obj2, "");
        return { payload:obj2, rev:"", source:"http" };
      }catch(e2){
        storeStatus("warn","HTTP 讀取失敗，改用快取",{ resourceKey:resourceKey, error:str(e2&&e2.message) });
      }
    }

    var c = loadPayloadCache(resourceKey);
    if(c && c.payload){
      var p = normalizePayload(c.payload, resourceKey);
      _memCache[resourceKey] = { payload:p, rev:str(c.rev||""), loadedAt:now() };
      return { payload:p, rev:str(c.rev||""), source:"cache" };
    }

    var empty = normalizePayload({ db:[], counter:0 }, resourceKey);
    _memCache[resourceKey] = { payload:empty, rev:"", loadedAt:now() };
    return { payload:empty, rev:"", source:"empty" };
  }

  async function storeWrite(resourceKey, payload, opts){
    opts = opts || {};
    await loadRegistry();
    var res = resolveResource(resourceKey);
    if(!res) throw new Error("Unknown resourceKey: "+resourceKey);
    if(!res.db.path) throw new Error("This resource has no Dropbox db.path (cannot write).");

    if(opts.requireLock !== false){
      var ls = _locks[resourceKey];
      if(!ls || !ls.lockId) throw new Error("Lock not held. Acquire lock before write.");
    }

    var p = normalizePayload(payload, resourceKey);
    p.meta.updatedAt = new Date().toISOString();
    var u = ownerFromUser(storeGetUser());
    p.meta.updatedBy = u.username;
    p.meta.updatedRole = u.role;
    p.meta.storeVer = STORE_VER;

    var text = JSON.stringify(p, null, 2);
    var rev = str(opts.rev || (_memCache[resourceKey] && _memCache[resourceKey].rev) || "");
    var mode = rev ? { ".tag":"update", update:rev } : { ".tag":"overwrite" };

    var meta = await dbxUploadPath(res.db.path, text, mode);
    var newRev = meta && meta.rev ? meta.rev : "";

    _memCache[resourceKey] = { payload:p, rev:newRev, loadedAt:now() };
    savePayloadCache(resourceKey, p, newRev);

    try{ window.dispatchEvent(new CustomEvent("tasun:db-updated",{ detail:{ resourceKey:resourceKey, rev:newRev } })); }catch(e){}
    return { rev:newRev, meta:meta };
  }

  // ----- Lock -----
  function lockCacheKey(resourceKey){ return _storeCfg.cachePrefix + "lock__" + resourceKey; }
  function saveLockCache(resourceKey, obj, rev){
    try{ localStorage.setItem(lockCacheKey(resourceKey), safeJsonStringify({ savedAt:now(), rev:str(rev), lock:obj })); }catch(e){}
  }
  function loadLockCache(resourceKey){
    try{
      var o = jsonParse(localStorage.getItem(lockCacheKey(resourceKey)), null);
      if(o && o.lock) return o;
    }catch(e){}
    return null;
  }
  function normalizeLock(obj, resourceKey){
    obj = (obj && typeof obj==="object") ? obj : {};
    if(!obj.schema) obj.schema = "tasun.lock.v1";
    obj.resource = resourceKey;
    if(!obj.owner || typeof obj.owner!=="object") obj.owner = { username:"unknown", role:"read", device:"" };
    obj.acquiredAt = Number(obj.acquiredAt)||0;
    obj.heartbeatAt = Number(obj.heartbeatAt)||0;
    obj.expiresAt = Number(obj.expiresAt)||0;
    obj.ttlSec = clamp(Number(obj.ttlSec)||90, 30, 600);
    obj.lockId = str(obj.lockId||"");
    return obj;
  }
  function isExpired(lockObj){
    var ex = Number(lockObj && lockObj.expiresAt) || 0;
    return ex <= now();
  }

  async function lockRead(resourceKey){
    await loadRegistry();
    var res = resolveResource(resourceKey);
    if(!res) throw new Error("Unknown resourceKey: "+resourceKey);

    if(res.lock.path){
      try{
        var dl = await dbxDownloadPath(res.lock.path);
        var obj = normalizeLock(jsonParse(dl.text,null), resourceKey);
        saveLockCache(resourceKey, obj, dl.rev||"");
        return { lock:obj, rev:dl.rev||"", source:"dropbox" };
      }catch(e1){
        storeStatus("warn","Lock 讀取失敗，改用快取/HTTP（若有）",{ resourceKey:resourceKey, error:str(e1&&e1.message) });
      }
    }
    if(res.lock.url){
      try{
        var url = addV(res.lock.url, _storeCfg.appVer);
        var r2 = await fetchWithTimeout(url, { method:"GET", cache:"no-store" }, _storeCfg.fetchTimeoutMs);
        if(!r2.ok) throw new Error("http "+r2.status);
        var obj2 = normalizeLock(await r2.json(), resourceKey);
        saveLockCache(resourceKey, obj2, "");
        return { lock:obj2, rev:"", source:"http" };
      }catch(e2){
        storeStatus("warn","Lock HTTP 讀取失敗，改用快取",{ resourceKey:resourceKey, error:str(e2&&e2.message) });
      }
    }
    var c = loadLockCache(resourceKey);
    if(c && c.lock) return { lock: normalizeLock(c.lock, resourceKey), rev:str(c.rev||""), source:"cache" };
    return { lock: normalizeLock({}, resourceKey), rev:"", source:"empty" };
  }

  async function lockWrite(resourceKey, lockObj, opts){
    opts = opts || {};
    await loadRegistry();
    var res = resolveResource(resourceKey);
    if(!res) throw new Error("Unknown resourceKey: "+resourceKey);
    if(!res.lock.path) throw new Error("This resource has no Dropbox lock.path (cannot write lock).");

    var obj = normalizeLock(lockObj, resourceKey);
    var text = JSON.stringify(obj, null, 2);
    var rev = str(opts.rev||"");
    var mode = rev ? { ".tag":"update", update:rev } : { ".tag":"overwrite" };

    var meta = await dbxUploadPath(res.lock.path, text, mode);
    var newRev = meta && meta.rev ? meta.rev : "";
    saveLockCache(resourceKey, obj, newRev);
    return { rev:newRev, meta:meta };
  }

  function startHeartbeat(resourceKey){
    var st = _locks[resourceKey];
    if(!st || !st.lockId) return;
    if(st.hbTimer) return;
    var intervalMs = Math.max(10000, Math.floor(st.ttlSec*1000/2));
    st.hbTimer = setInterval(function(){ lockHeartbeat(resourceKey).catch(function(){}); }, intervalMs);
  }
  function stopHeartbeat(resourceKey){
    var st = _locks[resourceKey];
    if(!st) return;
    if(st.hbTimer){ try{ clearInterval(st.hbTimer); }catch(e){} st.hbTimer=null; }
  }

  async function lockAcquire(resourceKey, owner, opts){
    opts = opts || {};
    owner = owner || ownerFromUser(storeGetUser());
    var ttlSec = clamp(Number(opts.ttlSec)||90, 30, 600);
    var waitMs = clamp(Number(opts.waitMs)||8000, 0, 60000);
    var retryDelayMs = clamp(Number(opts.retryDelayMs)||650, 250, 5000);

    await loadRegistry();
    var res = resolveResource(resourceKey);
    if(!res) throw new Error("Unknown resourceKey: "+resourceKey);
    if(!res.lock.path) throw new Error("This resource has no Dropbox lock.path (cannot lock).");

    var myLockId = uuid();
    var start = now();

    while(true){
      var cur = await lockRead(resourceKey);
      var lockObj = normalizeLock(cur.lock, resourceKey);
      var curRev = str(cur.rev||"");
      var free = (!lockObj.lockId) || isExpired(lockObj);

      if(free){
        var ts = now();
        var newLock = {
          schema:"tasun.lock.v1",
          resource:resourceKey,
          lockId:myLockId,
          owner:owner,
          acquiredAt:ts,
          heartbeatAt:ts,
          expiresAt:ts + ttlSec*1000,
          ttlSec:ttlSec
        };
        try{
          var wr = await lockWrite(resourceKey, newLock, { rev: curRev });
          _locks[resourceKey] = { lockId: myLockId, expiresAt:newLock.expiresAt, ttlSec:ttlSec, lastLockObj:newLock, lockRev:wr.rev||"", hbTimer:null };
          startHeartbeat(resourceKey);
          storeStatus("info","已取得鎖",{ resourceKey:resourceKey, owner:owner.username, ttlSec:ttlSec });
          return { lockId:myLockId, expiresAt:newLock.expiresAt, ttlSec:ttlSec };
        }catch(e1){
          storeStatus("warn","取得鎖失敗，重試中…",{ resourceKey:resourceKey, error:str(e1&&e1.message) });
        }
      }else{
        var who = (lockObj.owner && lockObj.owner.username) ? lockObj.owner.username : "unknown";
        var leftMs = (Number(lockObj.expiresAt)||0) - now();
        storeStatus("info","鎖被占用："+who,{ resourceKey:resourceKey, leftMs:leftMs });
      }

      if(waitMs<=0) throw new Error("Lock busy.");
      if(now()-start > waitMs) throw new Error("Lock timeout.");
      await sleep(retryDelayMs);
    }
  }

  async function lockHeartbeat(resourceKey){
    var st = _locks[resourceKey];
    if(!st || !st.lockId) return false;

    var cur = await lockRead(resourceKey);
    var lockObj = normalizeLock(cur.lock, resourceKey);
    var curRev = str(cur.rev||"");

    if(str(lockObj.lockId) !== str(st.lockId)){
      stopHeartbeat(resourceKey);
      delete _locks[resourceKey];
      storeStatus("warn","已失去鎖（lockId 不一致）",{ resourceKey:resourceKey });
      return false;
    }

    var ts = now();
    lockObj.heartbeatAt = ts;
    lockObj.expiresAt = ts + (st.ttlSec*1000);

    try{
      var wr = await lockWrite(resourceKey, lockObj, { rev: curRev });
      st.expiresAt = lockObj.expiresAt;
      st.lastLockObj = lockObj;
      st.lockRev = wr.rev || "";
      return true;
    }catch(e){
      storeStatus("warn","鎖心跳更新失敗",{ resourceKey:resourceKey, error:str(e&&e.message) });
      return false;
    }
  }

  async function lockRelease(resourceKey){
    var st = _locks[resourceKey];
    if(!st || !st.lockId) return true;

    try{
      var cur = await lockRead(resourceKey);
      var lockObj = normalizeLock(cur.lock, resourceKey);
      var curRev = str(cur.rev||"");

      if(str(lockObj.lockId) !== str(st.lockId)){
        stopHeartbeat(resourceKey);
        delete _locks[resourceKey];
        return true;
      }

      lockObj.heartbeatAt = now();
      lockObj.expiresAt = 0;
      await lockWrite(resourceKey, lockObj, { rev: curRev });

      stopHeartbeat(resourceKey);
      delete _locks[resourceKey];
      storeStatus("info","已釋放鎖",{ resourceKey:resourceKey });
      return true;
    }catch(e){
      storeStatus("warn","釋放鎖失敗（可忽略，過 TTL 會自動失效）",{ resourceKey:resourceKey, error:str(e&&e.message) });
      stopHeartbeat(resourceKey);
      delete _locks[resourceKey];
      return false;
    }
  }

  function lockIsHolding(resourceKey){
    var st = _locks[resourceKey];
    return !!(st && st.lockId);
  }

  // ----- Watch -----
  async function getDbRev(resourceKey){
    await loadRegistry();
    var res = resolveResource(resourceKey);
    if(!res) throw new Error("Unknown resourceKey: "+resourceKey);
    if(!res.db.path) return "";
    var meta = await dbxGetMetadata(res.db.path);
    return meta && meta.rev ? meta.rev : "";
  }

  function storeWatch(resourceKey, opts){
    opts = opts || {};
    var intervalSec = clamp(Number(opts.intervalSec)||8, 3, 120);
    var onChange = (typeof opts.onChange==="function") ? opts.onChange : null;

    storeUnwatch(resourceKey);

    var w = { intervalMs: intervalSec*1000, timer:null, lastRev:"", onChange:onChange };
    _watchers[resourceKey] = w;

    w.timer = setInterval(function(){
      (async function(){
        try{
          var r = await getDbRev(resourceKey);
          if(!w.lastRev) w.lastRev = r;
          if(r && w.lastRev && r !== w.lastRev){
            w.lastRev = r;
            try{ await storeRead(resourceKey, { preferCache:false }); }catch(e2){}
            if(w.onChange) w.onChange({ resourceKey:resourceKey, rev:r });
            try{ window.dispatchEvent(new CustomEvent("tasun:db-changed",{ detail:{ resourceKey:resourceKey, rev:r } })); }catch(e3){}
          }
        }catch(e){ /* ignore */ }
      })();
    }, w.intervalMs);

    return function(){ storeUnwatch(resourceKey); };
  }

  function storeUnwatch(resourceKey){
    var w = _watchers[resourceKey];
    if(!w) return;
    if(w.timer){ try{ clearInterval(w.timer); }catch(e){} }
    delete _watchers[resourceKey];
  }

  async function storeTransaction(resourceKey, mutator, opts){
    opts = opts || {};
    if(typeof mutator!=="function") throw new Error("mutator must be function(payload)=>payload|void");
    var owner = opts.owner || ownerFromUser(storeGetUser());
    var ttlSec = clamp(Number(opts.ttlSec)||90, 30, 600);

    await lockAcquire(resourceKey, owner, { ttlSec:ttlSec, waitMs:opts.waitMs, retryDelayMs:opts.retryDelayMs });
    try{
      var r = await storeRead(resourceKey, { preferCache:false });
      var payload = r.payload, rev = r.rev || "";
      var out = await mutator(payload);
      if(out && typeof out==="object") payload = out;
      var wr = await storeWrite(resourceKey, payload, { rev:rev, requireLock:true });
      return { rev: wr.rev, payload: payload };
    }finally{
      await lockRelease(resourceKey);
    }
  }

  // init store (idempotent)
  Store.init = function(options){
    options = options || {};
    _storeCfg.appVer = str(options.appVer || window.TASUN_APP_VER || "").trim();
    _storeCfg.resourcesUrl = str(options.resourcesUrl || _storeCfg.resourcesUrl || "").trim();
    _storeCfg.resourcesInline = (options.resourcesInline && typeof options.resourcesInline==="object") ? options.resourcesInline : null;

    _storeCfg.tokenKey = str(options.tokenKey || _storeCfg.tokenKey);
    _storeCfg.getToken = (typeof options.getToken==="function") ? options.getToken : null;
    _storeCfg.getUser  = (typeof options.getUser==="function") ? options.getUser  : null;
    _storeCfg.onStatus = (typeof options.onStatus==="function") ? options.onStatus : null;
    _storeCfg.fetchTimeoutMs = Number(options.fetchTimeoutMs)||_storeCfg.fetchTimeoutMs;

    Store.storeVer = STORE_VER;
    Store.version = STORE_VER;
    Store.cfg = Object.assign({}, _storeCfg);

    _registryLoaded=false; _registry=null; _registryLoading=null;
    storeStatus("info","TasunDropboxStore init",{ storeVer:STORE_VER, appVer:_storeCfg.appVer });
    return Store;
  };

  Store.ready = async function(){ await loadRegistry(); return true; };

  Store.getToken = storeGetToken;
  Store.getUser = storeGetUser;
  Store.ownerFromUser = ownerFromUser;
  Store.loadRegistry = loadRegistry;
  Store.resolve = function(resourceKey){ return resolveResource(resourceKey); };

  Store.read = storeRead;
  Store.write = storeWrite;
  Store.transaction = storeTransaction;

  Store.lock = {
    read: lockRead,
    acquire: lockAcquire,
    heartbeat: lockHeartbeat,
    release: lockRelease,
    isHolding: lockIsHolding
  };

  Store.watch = storeWatch;
  Store.unwatch = storeUnwatch;

  window.TasunDropboxStore = Store;

  // ============================================================
  // 2) Cloud Kit wrapper => window.TasunCloudKit
  // ============================================================
  var KIT_VER = "20260129_01";

  var _kitCfg = {
    appVer: str(window.TASUN_APP_VER || "").trim(),
    resourcesUrl: "tasun-resources.json",
    resourcesInline: null,
    tokenKey: "tasun_dropbox_token_v1",
    getToken: null,
    getUser: null,
    ui: { enabled: true }
  };

  function defaultGetUser(){
    // Prefer TasunCore.Auth if exists
    try{
      var Core = window.TasunCore;
      if(Core && Core.Auth){
        var role = (Core.Auth.role && Core.Auth.role()) || "read";
        var cur = (Core.Auth.current && Core.Auth.current()) || null;
        var username = (cur && (cur.username || cur.user || cur.name)) ? (cur.username || cur.user || cur.name) : "anonymous";
        return { username: username, role: role };
      }
    }catch(e){}
    return { username:"anonymous", role:"read" };
  }

  function canWriteByUser(u){
    var role = str(u && u.role || "read").toLowerCase();
    return role==="admin" || role==="write";
  }

  function makeStatusBar(){
    var el = document.getElementById("tasunCloudStatusBar");
    if(el) return el;

    el = document.createElement("div");
    el.id = "tasunCloudStatusBar";
    el.setAttribute("role","status");
    el.style.cssText = [
      "position:fixed","left:10px","right:10px","bottom:10px",
      "z-index:99999",
      "display:flex","align-items:center","gap:10px",
      "padding:8px 10px",
      "border-radius:999px",
      "border:1px solid rgba(246,214,150,.28)",
      "background:rgba(14,18,16,.72)",
      "backdrop-filter: blur(8px)",
      "color:rgba(246,214,150,.96)",
      "font: 600 13px/1.2 system-ui, -apple-system, Segoe UI, Arial",
      "letter-spacing:.04em",
      "box-shadow:0 18px 50px rgba(0,0,0,.35)"
    ].join(";");

    el.innerHTML =
      '<span data-part="msg" style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Cloud: —</span>' +
      '<button data-act="sync"   style="border:1px solid rgba(246,214,150,.25);background:rgba(255,255,255,.06);color:inherit;border-radius:999px;padding:6px 10px;cursor:pointer;">同步</button>' +
      '<button data-act="lock"   style="border:1px solid rgba(246,214,150,.25);background:rgba(255,255,255,.06);color:inherit;border-radius:999px;padding:6px 10px;cursor:pointer;">取得鎖</button>' +
      '<button data-act="unlock" style="border:1px solid rgba(246,214,150,.25);background:rgba(255,255,255,.06);color:inherit;border-radius:999px;padding:6px 10px;cursor:pointer;display:none;">釋放鎖</button>';

    document.body.appendChild(el);
    return el;
  }

  function setBarMsg(bar, text){
    if(!bar) return;
    var msg = bar.querySelector('[data-part="msg"]');
    if(msg) msg.textContent = text;
  }

  function setBarButtons(bar, st){
    if(!bar) return;
    var btnLock = bar.querySelector('[data-act="lock"]');
    var btnUnlk = bar.querySelector('[data-act="unlock"]');

    // read-only => hide both
    if(st.readOnly){
      if(btnLock) btnLock.style.display = "none";
      if(btnUnlk) btnUnlk.style.display = "none";
      return;
    }

    // writable
    if(st.holdingLock){
      if(btnLock) btnLock.style.display = "none";
      if(btnUnlk) btnUnlk.style.display = "inline-block";
    }else{
      if(btnLock) btnLock.style.display = "inline-block";
      if(btnUnlk) btnUnlk.style.display = "none";
    }
  }

  function computeDelta(basePayload, localPayload, pk){
    pk = pk || "uid";
    basePayload = isObj(basePayload) ? basePayload : { db:[] };
    localPayload = isObj(localPayload) ? localPayload : { db:[] };

    var baseDb = Array.isArray(basePayload.db) ? basePayload.db : [];
    var localDb = Array.isArray(localPayload.db) ? localPayload.db : [];

    var baseMap = new Map();
    baseDb.forEach(function(r){
      var k = str(r && r[pk]);
      if(k) baseMap.set(k, r);
    });

    var localMap = new Map();
    localDb.forEach(function(r){
      var k = str(r && r[pk]);
      if(k) localMap.set(k, r);
    });

    var added = [];
    var changed = [];
    var deleted = [];

    localDb.forEach(function(r){
      var k = str(r && r[pk]);
      if(!k) return;
      if(!baseMap.has(k)){
        added.push(r);
      }else{
        var b = baseMap.get(k);
        if(rowFingerprint(b) !== rowFingerprint(r)) changed.push(r);
      }
    });

    baseDb.forEach(function(r){
      var k = str(r && r[pk]);
      if(!k) return;
      if(!localMap.has(k)) deleted.push(r);
    });

    return { added:added, changed:changed, deleted:deleted };
  }

  function ensureUidDb(db, pk){
    pk = pk || "uid";
    if(!Array.isArray(db)) return db;
    for(var i=0;i<db.length;i++){
      var r = db[i];
      if(!isObj(r)) continue;
      if(!str(r[pk]).trim()) r[pk] = uuid();
    }
    return db;
  }

  function maxId(db, idField){
    idField = idField || "id";
    var m = 0;
    if(!Array.isArray(db)) return 0;
    for(var i=0;i<db.length;i++){
      var n = Number(db[i] && db[i][idField]);
      if(Number.isFinite(n) && n>m) m=n;
    }
    return m;
  }

  function indexByPk(db, pk){
    var map = new Map();
    if(!Array.isArray(db)) return map;
    for(var i=0;i<db.length;i++){
      var r = db[i];
      if(!isObj(r)) continue;
      var k = str(r[pk]).trim();
      if(k) map.set(k, r);
    }
    return map;
  }

  function stashConflicts(resourceKey, conflicts){
    try{
      localStorage.setItem("tasun_cloud_conflicts__"+resourceKey, safeJsonStringify({
        savedAt: now(),
        conflicts: conflicts
      }));
    }catch(e){}
  }

  function mount(pageOpts){
    pageOpts = pageOpts || {};
    var resourceKey = str(pageOpts.resourceKey).trim();
    if(!resourceKey) throw new Error("mount(): resourceKey is required");

    var pk = str(pageOpts.pk || "uid").trim() || "uid";
    var idField = str(pageOpts.idField || "id").trim() || "id";
    var counterField = str(pageOpts.counterField || "counter").trim() || "counter";

    var getLocal = pageOpts.getLocal;
    var apply = pageOpts.apply;

    if(typeof getLocal!=="function") throw new Error("mount(): getLocal() is required");
    if(typeof apply!=="function") throw new Error("mount(): apply(payload) is required");

    var mergeOpt = pageOpts.merge || {};
    var conflictPolicy = str(mergeOpt.conflictPolicy || "stash-remote"); 
    // "stash-remote" (default): keep remote, stash conflict rows locally
    // "prefer-local": overwrite remote with local on conflict

    var watchOpt = pageOpts.watch || null;
    var watchIntervalSec = watchOpt ? clamp(Number(watchOpt.intervalSec)||8, 3, 120) : 0;

    var u = (typeof _kitCfg.getUser==="function") ? _kitCfg.getUser() : defaultGetUser();
    var readOnly = (pageOpts.readOnly===true) ? true : (pageOpts.readOnly===false ? false : !canWriteByUser(u));

    // status bar
    var bar = null;
    if(_kitCfg.ui && _kitCfg.ui.enabled !== false){
      try{ bar = makeStatusBar(); }catch(e){}
    }

    var st = {
      resourceKey: resourceKey,
      readOnly: !!readOnly,
      holdingLock: false,
      dirty: false,
      pendingRev: "",
      lastRev: "",
      lastSyncAt: 0,
      lastSource: "",
      lastMsg: "",
      online: (navigator.onLine !== false)
    };

    function refreshBar(){
      if(!bar) return;
      var parts = [];
      parts.push("Cloud:"+resourceKey);
      parts.push(st.online ? "Online" : "Offline");
      if(st.lastSource) parts.push("src:"+st.lastSource);
      if(st.lastRev) parts.push("rev:"+st.lastRev.slice(0,6));
      if(st.pendingRev) parts.push("遠端更新待同步");
      if(st.dirty) parts.push("本機未儲存");
      if(st.readOnly) parts.push("read-only");
      else parts.push(st.holdingLock ? "已鎖定" : "未鎖定");
      setBarMsg(bar, parts.join(" · "));
      setBarButtons(bar, st);
    }

    function computeDirty(basePayload){
      try{
        var local = getLocal() || {};
        var localDb = ensureUidDb(Array.isArray(local.db)?local.db:[], pk);
        var baseDb  = ensureUidDb(Array.isArray(basePayload && basePayload.db)?basePayload.db:[], pk);
        if(localDb.length !== baseDb.length) return true;

        var baseMap = indexByPk(baseDb, pk);
        for(var i=0;i<localDb.length;i++){
          var r = localDb[i];
          var k = str(r && r[pk]).trim();
          if(!k || !baseMap.has(k)) return true;
          if(rowFingerprint(baseMap.get(k)) !== rowFingerprint(r)) return true;
        }
        return false;
      }catch(e){
        return true;
      }
    }

    var basePayload = null;

    async function syncNow(){
      var rr = await Store.read(resourceKey, { preferCache:false });
      var payload = rr.payload || { db:[], counter:0 };
      payload.db = ensureUidDb(payload.db, pk);

      basePayload = deepClone(payload) || payload;
      st.lastRev = str(rr.rev||"");
      st.lastSource = str(rr.source||"");
      st.lastSyncAt = now();
      st.pendingRev = "";
      st.dirty = false;

      // auto snapshot (standard extra feature)
      try{
        localStorage.setItem("tasun_cloud_snapshot__"+resourceKey, safeJsonStringify({
          savedAt: st.lastSyncAt,
          rev: st.lastRev,
          payload: payload
        }));
      }catch(e){}

      apply(payload, { source: rr.source, rev: rr.rev, at: st.lastSyncAt });
      refreshBar();
      return rr;
    }

    async function acquireLock(){
      if(st.readOnly) throw new Error("read-only");
      var owner = ownerFromUser((typeof _kitCfg.getUser==="function") ? _kitCfg.getUser() : defaultGetUser());
      var r = await Store.lock.acquire(resourceKey, owner, { ttlSec: 90, waitMs: 8000 });
      st.holdingLock = true;
      refreshBar();
      return r;
    }

    async function releaseLock(){
      try{ await Store.lock.release(resourceKey); }catch(e){}
      st.holdingLock = false;
      refreshBar();
      return true;
    }

    async function saveMerged(){
      if(st.readOnly) throw new Error("read-only");

      // get local snapshot
      var local = getLocal() || {};
      local = isObj(local) ? local : {};
      local.db = ensureUidDb(Array.isArray(local.db)?local.db:[], pk);

      if(!basePayload){
        // if never synced, do a sync first (use cache if needed)
        try{ await syncNow(); }catch(e){}
      }
      var base = basePayload || { db:[], counter:0 };
      base.db = ensureUidDb(Array.isArray(base.db)?base.db:[], pk);

      // delta from base -> local
      var delta = computeDelta(base, local, pk);

      // lock + rebase on latest remote, then apply delta
      await acquireLock();
      try{
        var latest = await Store.read(resourceKey, { preferCache:false });
        var remote = latest.payload || { db:[], counter:0 };
        remote.db = ensureUidDb(Array.isArray(remote.db)?remote.db:[], pk);

        var remoteMap = indexByPk(remote.db, pk);
        var baseMap = indexByPk(base.db, pk);

        var conflicts = [];

        // apply adds (assign new display id)
        var curMaxId = Math.max(maxId(remote.db, idField), Number(remote[counterField]||0)||0);
        delta.added.forEach(function(r){
          var key = str(r && r[pk]).trim();
          if(!key) return;
          if(remoteMap.has(key)) return; // already exists
          curMaxId += 1;
          var nr = deepClone(r) || r;
          nr[idField] = curMaxId; // display serial
          remote.db.push(nr);
          remoteMap.set(key, nr);
        });

        // apply changes
        delta.changed.forEach(function(r){
          var key = str(r && r[pk]).trim();
          if(!key) return;

          var remoteRow = remoteMap.get(key);
          if(!remoteRow){
            // treat as add
            curMaxId += 1;
            var nr2 = deepClone(r) || r;
            nr2[idField] = curMaxId;
            remote.db.push(nr2);
            remoteMap.set(key, nr2);
            return;
          }

          // conflict check: remote differs from base and local differs from base
          var baseRow = baseMap.get(key);
          var remoteChanged = baseRow ? (rowFingerprint(baseRow) !== rowFingerprint(remoteRow)) : false;

          if(remoteChanged){
            conflicts.push({ pk:key, local:r, remote:remoteRow, base:baseRow||null });
            if(conflictPolicy === "prefer-local"){
              // overwrite remote
              var keepId = remoteRow[idField];
              Object.keys(remoteRow).forEach(function(k){ delete remoteRow[k]; });
              Object.keys(r).forEach(function(k){ remoteRow[k] = r[k]; });
              remoteRow[idField] = keepId;
            }else{
              // stash-remote: keep remote; do nothing
            }
          }else{
            // safe overwrite
            var keepId2 = remoteRow[idField];
            Object.keys(remoteRow).forEach(function(k){ delete remoteRow[k]; });
            Object.keys(r).forEach(function(k){ remoteRow[k] = r[k]; });
            remoteRow[idField] = keepId2;
          }
        });

        // deletions (disabled by default, but you can enable later)
        // if(mergeOpt.allowDelete===true) ...

        // update counter
        remote[counterField] = Math.max(curMaxId, Number(remote[counterField]||0)||0);

        // write back (rev-safe)
        var wr = await Store.write(resourceKey, remote, { rev: latest.rev || "", requireLock:true });

        st.lastRev = str(wr.rev||"");
        st.lastSource = "dropbox";
        st.lastSyncAt = now();
        st.pendingRev = "";
        st.dirty = false;

        // stash conflicts (standard extra feature)
        if(conflicts.length){
          stashConflicts(resourceKey, conflicts);
        }

        // update base and apply remote-as-truth
        basePayload = deepClone(remote) || remote;
        apply(remote, { source:"dropbox", rev:st.lastRev, at:st.lastSyncAt, conflicts:conflicts.length });

        refreshBar();
        return { payload: remote, rev: st.lastRev, conflicts: conflicts.length };
      }finally{
        await releaseLock();
      }
    }

    function status(){
      // refresh dirty snapshot cheaply
      st.dirty = basePayload ? computeDirty(basePayload) : false;
      st.holdingLock = Store.lock.isHolding(resourceKey);
      st.online = (navigator.onLine !== false);
      refreshBar();
      return Object.assign({}, st);
    }

    // watch handling
    var unwatchFn = null;
    function startWatch(){
      if(!watchIntervalSec) return;
      if(unwatchFn) return;

      unwatchFn = Store.watch(resourceKey, {
        intervalSec: watchIntervalSec,
        onChange: async function(info){
          st.pendingRev = str(info && info.rev || "");
          st.online = (navigator.onLine !== false);

          // if not dirty => auto sync
          var dirtyNow = basePayload ? computeDirty(basePayload) : true;
          st.dirty = dirtyNow;

          if(!dirtyNow){
            try{ await syncNow(); }catch(e){}
          }else{
            refreshBar();
          }
        }
      });
    }

    function stopWatch(){
      if(unwatchFn){ try{ unwatchFn(); }catch(e){} unwatchFn=null; }
      try{ Store.unwatch(resourceKey); }catch(e2){}
    }

    function destroy(){
      stopWatch();
      try{ releaseLock(); }catch(e){}
      if(bar){
        try{ bar.remove(); }catch(e2){}
        bar = null;
      }
    }

    // bar events
    if(bar){
      bar.addEventListener("click", function(ev){
        var b = ev.target && ev.target.closest ? ev.target.closest("button[data-act]") : null;
        if(!b) return;
        var act = b.getAttribute("data-act");
        if(act==="sync"){
          syncNow().catch(function(){});
        }else if(act==="lock"){
          acquireLock().catch(function(){});
        }else if(act==="unlock"){
          releaseLock().catch(function(){});
        }
      });

      window.addEventListener("online", function(){ st.online=true; refreshBar(); });
      window.addEventListener("offline", function(){ st.online=false; refreshBar(); });
    }

    // ready chain
    var ready = (async function(){
      // init Store with kit cfg
      Store.init({
        appVer: _kitCfg.appVer,
        resourcesUrl: _kitCfg.resourcesUrl,
        resourcesInline: _kitCfg.resourcesInline,
        tokenKey: _kitCfg.tokenKey,
        getToken: _kitCfg.getToken || null,
        getUser:  _kitCfg.getUser || defaultGetUser,
        onStatus: function(type,msg,detail){
          // reflect status to bar without touching page UI
          st.lastMsg = str(msg);
          refreshBar();
        }
      });
      await Store.ready();

      // initial sync
      await syncNow().catch(function(){
        // fallback: try snapshot (auto restore)
        try{
          var snap = jsonParse(localStorage.getItem("tasun_cloud_snapshot__"+resourceKey), null);
          if(snap && snap.payload){
            basePayload = deepClone(snap.payload) || snap.payload;
            apply(basePayload, { source:"snapshot", rev:str(snap.rev||""), at:Number(snap.savedAt)||0 });
            st.lastSource="snapshot";
            st.lastRev=str(snap.rev||"");
            st.lastSyncAt=Number(snap.savedAt)||0;
          }
        }catch(e){}
      });

      startWatch();
      refreshBar();
      return true;
    })();

    // public instance
    var cloud = {
      key: resourceKey,
      ready: ready,
      syncNow: syncNow,
      saveMerged: saveMerged,
      status: status,
      destroy: destroy,
      store: Store
    };

    refreshBar();
    return cloud;
  }

  var Kit = window.TasunCloudKit || {};
  Kit.version = KIT_VER;

  Kit.init = function(opts){
    opts = opts || {};
    _kitCfg.appVer = str(opts.appVer || window.TASUN_APP_VER || _kitCfg.appVer).trim();
    _kitCfg.resourcesUrl = str(opts.resourcesUrl || _kitCfg.resourcesUrl).trim();
    _kitCfg.resourcesInline = (opts.resourcesInline && typeof opts.resourcesInline==="object") ? opts.resourcesInline : null;

    _kitCfg.tokenKey = str(opts.tokenKey || _kitCfg.tokenKey);
    _kitCfg.getToken = (typeof opts.getToken==="function") ? opts.getToken : null;
    _kitCfg.getUser  = (typeof opts.getUser==="function")  ? opts.getUser  : null;

    _kitCfg.ui = (opts.ui && typeof opts.ui==="object") ? opts.ui : (_kitCfg.ui || { enabled:true });

    return Kit;
  };

  Kit.mount = mount;

  window.TasunCloudKit = Kit;

})(window, document);
