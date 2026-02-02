/* =========================================================
 * tasun-cloud-kit.js  (Drop-in replacement - upgraded)
 * - Dropbox JSON DB + lock (optional)
 * - Auto-create db/lock if missing (with folder)
 * - Protect local when remote is empty (seed/merge back once)
 * - Local-only fallback if no token
 * - Minimal stable API:
 *   init(), mount(), ctrl.pullNow(), ctrl.saveMerged(), ctrl.status(), ctrl.destroy()
 * ========================================================= */
(function(){
  "use strict";

  // -------------------------------
  // Internal state (singleton)
  // -------------------------------
  var _S = {
    inited: false,
    appVer: "",
    resourcesUrl: "tasun-resources.json",
    ui: { enabled:true, hideLockButtons:true, position:"bottom-right" },
    lock: { enabled:false, auto:false },

    _resourcesCache: null,
    _resourcesUrlCacheKey: "",
    _uiMounted: false,
    _uiEl: null,
    _uiMsgEl: null
  };

  // -------------------------------
  // Utils
  // -------------------------------
  function norm(s){ return (s===undefined||s===null) ? "" : String(s).trim(); }
  function nowISO(){ return new Date().toISOString(); }

  function addV(url){
    url = norm(url);
    var v = norm(_S.appVer);
    if(!url || !v) return url;
    try{
      var u = new URL(url, location.href);
      if(!u.searchParams.get("v")) u.searchParams.set("v", v);
      return u.toString();
    }catch(e){
      return url + (url.indexOf("?")>=0 ? "&" : "?") + "v=" + encodeURIComponent(v);
    }
  }

  function safeJSONParse(text){
    if(!text) return null;
    try{ return JSON.parse(text); }catch(e){ return null; }
  }

  function stableStringify(obj){
    try{ return JSON.stringify(obj, null, 2); }catch(e){ return "{}"; }
  }

  function shallowClone(x){
    if(!x || typeof x!=="object") return x;
    if(Array.isArray(x)) return x.slice();
    var o = {};
    for(var k in x){ if(Object.prototype.hasOwnProperty.call(x,k)) o[k]=x[k]; }
    return o;
  }

  function ensureLeadingSlash(p){
    p = norm(p);
    if(!p) return "";
    if(p[0] !== "/") p = "/" + p;
    return p;
  }

  // ✅ row 內容穩定比對（避免 key 順序不同造成誤判衝突）
  function stableRowString(x){
    if(x === null) return "null";
    var t = typeof x;
    if(t === "string") return JSON.stringify(x);
    if(t === "number" || t === "boolean") return String(x);
    if(t !== "object") return JSON.stringify(x);

    if(Array.isArray(x)){
      var a = new Array(x.length);
      for(var i=0;i<x.length;i++) a[i] = stableRowString(x[i]);
      return "[" + a.join(",") + "]";
    }
    var keys = Object.keys(x).sort();
    var parts = [];
    for(var k=0;k<keys.length;k++){
      var key = keys[k];
      parts.push(JSON.stringify(key) + ":" + stableRowString(x[key]));
    }
    return "{" + parts.join(",") + "}";
  }

  // -------------------------------
  // Minimal UI (optional)
  // -------------------------------
  function uiEnsure(){
    if(!_S.ui || !_S.ui.enabled) return;
    if(_S._uiMounted) return;
    _S._uiMounted = true;

    try{
      var box = document.createElement("div");
      box.setAttribute("data-tasun-cloud-ui","1");
      box.style.cssText =
        "position:fixed; z-index:99999;" +
        (_S.ui.position==="bottom-left" ? "left:12px;" : "right:12px;") +
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
    }catch(e){}
  }

  function uiSet(text){
    if(!_S._uiMsgEl) return;
    try{ _S._uiMsgEl.textContent = String(text||""); }catch(e){}
  }

  function uiPulse(ok){
    if(!_S._uiEl) return;
    try{
      var dot = _S._uiEl.firstChild;
      if(dot && dot.style){
        dot.style.background = ok ? "rgba(120,255,190,.75)" : "rgba(255,160,160,.75)";
      }
      setTimeout(function(){
        if(dot && dot.style){
          dot.style.background = "rgba(255,255,255,.35)";
        }
      }, 550);
    }catch(e){}
  }

  // -------------------------------
  // Dropbox API helpers
  // -------------------------------
  function getDropboxToken(){
    try{
      var t = (localStorage.getItem("tasunDropboxToken_v1") || "").trim();
      if(!t) return "";
      t = t.replace(/^Bearer\s+/i,"").trim();
      return t;
    }catch(e){ return ""; }
  }

  function isNotFoundErr(err){
    try{
      var s = (err && err.message) ? String(err.message) : "";
      var sum = (err && err.__dropbox && err.__dropbox.error_summary) ? String(err.__dropbox.error_summary) : "";
      var all = (s + " " + sum).toLowerCase();
      return all.indexOf("not_found")>=0 || all.indexOf("path/not_found")>=0;
    }catch(e){ return false; }
  }

  function isAlreadyExistsErr(err){
    try{
      var s = (err && err.message) ? String(err.message) : "";
      var sum = (err && err.__dropbox && err.__dropbox.error_summary) ? String(err.__dropbox.error_summary) : "";
      var all = (s + " " + sum).toLowerCase();
      return all.indexOf("conflict")>=0 || all.indexOf("already_exists")>=0 || all.indexOf("path/conflict")>=0;
    }catch(e){ return false; }
  }

  async function dbxRpc(endpoint, bodyObj){
    var token = getDropboxToken();
    if(!token) throw new Error("NO_DROPBOX_TOKEN");

    var resp = await fetch("https://api.dropboxapi.com/2" + endpoint, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bodyObj || {})
    });

    var text = await resp.text();
    var json = safeJSONParse(text) || { error_summary: text || "" };

    if(!resp.ok){
      var err = new Error(json && json.error_summary ? json.error_summary : ("Dropbox RPC error: " + endpoint));
      err.__dropbox = json;
      err.__status = resp.status;
      throw err;
    }
    return json;
  }

  async function dbxDownload(path){
    var token = getDropboxToken();
    if(!token) throw new Error("NO_DROPBOX_TOKEN");

    var resp = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Dropbox-API-Arg": JSON.stringify({ path: path })
      }
    });

    var text = await resp.text();
    if(!resp.ok){
      var json = safeJSONParse(text) || { error_summary: text || "" };
      var err = new Error(json && json.error_summary ? json.error_summary : "Dropbox download error");
      err.__dropbox = json;
      err.__status = resp.status;
      throw err;
    }
    return text;
  }

  async function dbxUpload(path, contentText, mode){
    var token = getDropboxToken();
    if(!token) throw new Error("NO_DROPBOX_TOKEN");

    var arg = {
      path: path,
      mode: mode || "overwrite",
      autorename: false,
      mute: true,
      strict_conflict: true
    };

    var resp = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify(arg)
      },
      body: contentText || ""
    });

    var text = await resp.text();
    var json = safeJSONParse(text) || { error_summary: text || "" };

    if(!resp.ok){
      var err = new Error(json && json.error_summary ? json.error_summary : "Dropbox upload error");
      err.__dropbox = json;
      err.__status = resp.status;
      throw err;
    }
    return json;
  }

  function parentFolderOf(path){
    path = norm(path);
    if(!path || path==="/") return "";
    var i = path.lastIndexOf("/");
    if(i<=0) return "";
    return path.slice(0, i);
  }

  async function ensureFolder(folderPath){
    folderPath = norm(folderPath);
    if(!folderPath || folderPath==="/") return true;
    try{
      await dbxRpc("/files/create_folder_v2", { path: folderPath, autorename:false });
      return true;
    }catch(e){
      if(isAlreadyExistsErr(e)) return true;
      throw e;
    }
  }

  async function exists(path){
    try{
      await dbxRpc("/files/get_metadata", { path: path, include_deleted:false });
      return true;
    }catch(e){
      if(isNotFoundErr(e)) return false;
      throw e;
    }
  }

  /**
   * ✅ 핵심：確保遠端 db / lock 存在，不存在就建立
   * - 無 Token：略過（走本機模式）
   * - 會自動建立父資料夾（例如 /Tasun）
   * - seedDb 預設用標準結構 {counter:0, db:[]}
   */
  async function ensureRemoteDbLock(dbPath, lockPath, opt){
    opt = opt || {};
    var seedDb   = (opt.seedDb   !== undefined) ? opt.seedDb   : { counter:0, db:[] };
    var seedLock = (opt.seedLock !== undefined) ? opt.seedLock : { locked:false, by:"", ts:0 };

    var token = getDropboxToken();
    if(!token) return false;

    dbPath = ensureLeadingSlash(dbPath);
    lockPath = ensureLeadingSlash(lockPath);

    // folder
    var f1 = parentFolderOf(dbPath);
    var f2 = parentFolderOf(lockPath);
    if(f1) await ensureFolder(f1);
    if(f2 && f2!==f1) await ensureFolder(f2);

    // db
    if(dbPath){
      var okDb = await exists(dbPath);
      if(!okDb){
        try{
          await dbxUpload(dbPath, stableStringify(seedDb), "add");
        }catch(e){
          if(!isAlreadyExistsErr(e)) throw e;
        }
      }
    }

    // lock
    if(lockPath){
      var okLock = await exists(lockPath);
      if(!okLock){
        try{
          await dbxUpload(lockPath, stableStringify(seedLock), "add");
        }catch(e){
          if(!isAlreadyExistsErr(e)) throw e;
        }
      }
    }

    return true;
  }

  // -------------------------------
  // Resources (tasun-resources.json)
  // -------------------------------
  async function loadResources(){
    var url = addV(_S.resourcesUrl || "tasun-resources.json");
    var cacheKey = url;

    if(_S._resourcesCache && _S._resourcesUrlCacheKey === cacheKey){
      return _S._resourcesCache;
    }

    var resp = await fetch(url, { cache:"no-store" });
    var text = await resp.text();
    var json = safeJSONParse(text);
    if(!resp.ok || !json || typeof json!=="object"){
      throw new Error("Failed to load resources: " + url);
    }

    // ✅ 相容兩種格式： { key:{db:{path...}} } 或 { resources:{ key:{...} } }
    if(json.resources && typeof json.resources==="object") json = json.resources;

    _S._resourcesCache = json;
    _S._resourcesUrlCacheKey = cacheKey;
    return json;
  }

  // -------------------------------
  // Merge helpers (generic)
  // -------------------------------
  function getPk(row, pkField){
    if(!row || typeof row!=="object") return "";
    return norm(row[pkField]);
  }

  function rowEquals(a,b){
    try{ return stableRowString(a) === stableRowString(b); }catch(e){ return false; }
  }

  function stashConflicts(resourceKey, conflicts){
    if(!conflicts || conflicts.length===0) return;
    try{
      var key = "tasunCloudKit_conflicts__" + norm(resourceKey || "unknown");
      var arr = safeJSONParse(localStorage.getItem(key)) || [];
      if(!Array.isArray(arr)) arr = [];
      arr = arr.concat(conflicts);
      if(arr.length > 40) arr = arr.slice(arr.length - 40);
      localStorage.setItem(key, JSON.stringify(arr));
    }catch(e){}
  }

  function normalizePayload(p){
    p = (p && typeof p==="object") ? p : {};
    var counter = Number(p.counter || 0);
    if(!Number.isFinite(counter)) counter = 0;

    var db = Array.isArray(p.db) ? p.db : [];
    // 允許 rows
    if(!Array.isArray(db) && Array.isArray(p.rows)) db = p.rows;

    return { counter: counter, db: db };
  }

  function mergePayload(localP, remoteP, opt){
    opt = opt || {};
    var pk = norm(opt.pk || "k");
    var conflictPolicy = norm((opt.merge && opt.merge.conflictPolicy) || opt.conflictPolicy || "stash-remote").toLowerCase();

    var L = normalizePayload(localP);
    var R = normalizePayload(remoteP);

    var mapL = new Map();
    var mapR = new Map();

    for(var i=0;i<L.db.length;i++){
      var lk = getPk(L.db[i], pk);
      if(!lk) continue;
      mapL.set(lk, L.db[i]);
    }
    for(var j=0;j<R.db.length;j++){
      var rk = getPk(R.db[j], pk);
      if(!rk) continue;
      mapR.set(rk, R.db[j]);
    }

    var keys = new Set();
    mapL.forEach(function(_,k){ keys.add(k); });
    mapR.forEach(function(_,k){ keys.add(k); });

    var mergedDb = [];
    var conflicts = [];

    keys.forEach(function(k){
      var a = mapL.get(k);
      var b = mapR.get(k);

      if(a && !b){ mergedDb.push(a); return; }
      if(!a && b){ mergedDb.push(b); return; }

      if(rowEquals(a,b)){
        mergedDb.push(a);
        return;
      }

      if(conflictPolicy === "prefer-remote"){
        mergedDb.push(b);
        conflicts.push({ ts: Date.now(), pk: k, policy:"prefer-remote", local:a, remote:b });
        return;
      }

      if(conflictPolicy === "prefer-local"){
        mergedDb.push(a);
        conflicts.push({ ts: Date.now(), pk: k, policy:"prefer-local", local:a, remote:b });
        return;
      }

      // default: stash-remote (保留 local，遠端衝突另存)
      mergedDb.push(a);
      conflicts.push({ ts: Date.now(), pk: k, policy:"stash-remote", local:a, remote:b });
    });

    var counter = Math.max(L.counter||0, R.counter||0);
    return { payload: { counter: counter, db: mergedDb }, conflicts: conflicts };
  }

  // -------------------------------
  // Remote read/write (db file)
  // -------------------------------
  async function remoteReadJson(path){
    var raw = await dbxDownload(path);
    var obj = safeJSONParse(raw);

    if(!obj){
      // 非 JSON：當作空
      return { counter:0, db:[] };
    }

    // 允許遠端直接存 array
    if(Array.isArray(obj)) return { counter:0, db: obj };

    if(typeof obj !== "object") return { counter:0, db:[] };

    // 允許 rows
    if(!Array.isArray(obj.db) && Array.isArray(obj.rows)) obj.db = obj.rows;

    return normalizePayload(obj);
  }

  async function remoteWriteJson(path, payload){
    var out = shallowClone(payload);
    out._meta = {
      app: "TasunCloudKit",
      appVer: norm(_S.appVer),
      savedAt: nowISO()
    };
    await dbxUpload(path, stableStringify(out), "overwrite");
    return true;
  }

  // -------------------------------
  // Main API: init / mount
  // -------------------------------
  function init(cfg){
    cfg = (cfg && typeof cfg==="object") ? cfg : {};

    if(cfg.appVer !== undefined) _S.appVer = norm(cfg.appVer);
    if(cfg.resourcesUrl !== undefined) _S.resourcesUrl = norm(cfg.resourcesUrl) || "tasun-resources.json";

    if(cfg.ui && typeof cfg.ui==="object"){
      _S.ui = Object.assign({}, _S.ui, cfg.ui);
    }
    if(cfg.lock && typeof cfg.lock==="object"){
      _S.lock = Object.assign({}, _S.lock, cfg.lock);
    }

    _S.inited = true;
    uiEnsure();
    uiSet("CloudKit inited");
    return true;
  }

  function mount(cfg){
    cfg = (cfg && typeof cfg==="object") ? cfg : {};
    if(!_S.inited) init({});

    uiEnsure();

    var resourceKey   = norm(cfg.resourceKey);
    var pkField       = norm(cfg.pk || "k");
    var mergeCfg      = cfg.merge || { conflictPolicy:"stash-remote", lock:"none" };
    var watchCfg      = cfg.watch || { intervalSec: 0 };
    var getLocal      = (typeof cfg.getLocal === "function") ? cfg.getLocal : function(){ return { counter:0, db:[] }; };
    var apply         = (typeof cfg.apply === "function") ? cfg.apply : function(){};

    var counterField  = norm(cfg.counterField || "counter");

    // ✅ 預設開：確保遠端不存在就建立
    var ensureRemote  = (cfg.ensureRemote !== undefined) ? !!cfg.ensureRemote : true;
    // ✅ 預設開：遠端空白保護
    var protectEmptyRemote = (mergeCfg && mergeCfg.protectEmptyRemote !== undefined) ? !!mergeCfg.protectEmptyRemote : true;

    var destroyed = false;
    var timer = null;
    var lastStatus = {
      mode: "init",
      resourceKey: resourceKey,
      dbPath: "",
      lockPath: "",
      lastPullAt: 0,
      lastSaveAt: 0,
      lastError: "",
      hasToken: !!getDropboxToken(),
      watchSec: Number((watchCfg && watchCfg.intervalSec) || 0),
      appVer: norm(_S.appVer),
      resourcesUrl: norm(_S.resourcesUrl)
    };

    var readyResolve;
    var ready = new Promise(function(res){ readyResolve = res; });

    // ✅ 互斥排隊：避免 pull/save/watch 同時執行
    var _chain = Promise.resolve();
    function enqueue(fn){
      _chain = _chain.then(function(){
        if(destroyed) return;
        return fn();
      }).catch(function(e){
        // 不讓鏈斷
        lastStatus.lastError = (e && e.message) ? String(e.message) : String(e||"");
      });
      return _chain;
    }

    function status(){
      lastStatus.hasToken = !!getDropboxToken();
      return shallowClone(lastStatus);
    }

    function destroy(){
      destroyed = true;
      if(timer) clearInterval(timer);
      timer = null;
      lastStatus.mode = "destroyed";
      uiSet(resourceKey ? ("CloudKit: " + resourceKey + " stopped") : "CloudKit stopped");
    }

    async function ensureAndResolvePaths(){
      var resources = await loadResources();
      var entry = resources && resources[resourceKey];
      if(!entry || !entry.db || !entry.db.path){
        throw new Error("Resource not found in resources.json: " + resourceKey);
      }

      var dbPath = ensureLeadingSlash(entry.db.path);
      var lockPath = (entry.lock && entry.lock.path) ? ensureLeadingSlash(entry.lock.path) : "";

      lastStatus.dbPath = dbPath;
      lastStatus.lockPath = lockPath;

      if(ensureRemote){
        try{
          await ensureRemoteDbLock(dbPath, lockPath, {
            seedDb: { counter:0, db:[] },
            seedLock: { locked:false, by:"", ts:0 }
          });
        }catch(e){
          lastStatus.lastError = (e && e.message) ? String(e.message) : String(e||"");
          console.warn("[TasunCloudKit] ensureRemoteDbLock failed:", lastStatus.lastError);
        }
      }

      return { dbPath: dbPath, lockPath: lockPath };
    }

    function isEmptyPayload(p){
      p = normalizePayload(p);
      return (!p.counter || p.counter===0) && (!p.db || p.db.length===0);
    }

    function safeApply(payload, info){
      try{
        // 兼容 counterField
        if(counterField !== "counter"){
          payload[counterField] = payload.counter;
        }
        apply(payload, info || {});
      }catch(e){}
    }

    function pullNow(){
      return enqueue(async function(){
        if(destroyed) return;

        lastStatus.lastError = "";
        lastStatus.hasToken = !!getDropboxToken();

        var token = getDropboxToken();
        if(!token){
          var localOnly = getLocal() || {};
          safeApply(localOnly, { source:"local-only", reason:"no-token" });
          lastStatus.mode = "local-only";
          lastStatus.lastPullAt = Date.now();
          uiSet("CloudKit: local-only (no token)");
          uiPulse(false);
          return;
        }

        try{
          var paths = await ensureAndResolvePaths();
          var remoteP = await remoteReadJson(paths.dbPath);

          // ✅ 遠端空白保護：遠端空 & 本機有 → 不覆寫，改推回雲端一次
          if(protectEmptyRemote){
            var localP = normalizePayload(getLocal() || { counter:0, db:[] });
            if(isEmptyPayload(remoteP) && !isEmptyPayload(localP)){
              var seedKey = "tasunCloudKit_seeded__" + norm(resourceKey||"") + "__" + norm(_S.appVer||"");
              if(!sessionStorage.getItem(seedKey)){
                sessionStorage.setItem(seedKey, "1");
                // 先維持本機
                safeApply(localP, { source:"remote-empty-protected", reason:"keep-local" });
                lastStatus.mode = "remote-empty-protected";
                lastStatus.lastPullAt = Date.now();
                uiSet("CloudKit: remote empty → keep local");
                uiPulse(true);

                // 再推回雲端合併一次（把本機資料寫上去）
                // 注意：用 enqueue 會接在這次 pull 後面執行，不會打架
                saveMerged({ reason:"seed-empty-remote" });
                return;
              }
            }
          }

          safeApply(remoteP, { source:"remote", fetchedAt: Date.now() });
          lastStatus.mode = "synced";
          lastStatus.lastPullAt = Date.now();
          uiSet("CloudKit: pulled " + resourceKey);
          uiPulse(true);

        }catch(e){
          lastStatus.lastError = (e && e.message) ? String(e.message) : String(e||"");
          lastStatus.mode = "error";
          uiSet("CloudKit: error");
          uiPulse(false);
          console.warn("[TasunCloudKit] pullNow error:", lastStatus.lastError);

          // 失敗仍套用本機，避免 UI 空白
          try{
            var localFallback = getLocal() || {};
            safeApply(localFallback, { source:"local-fallback", error:lastStatus.lastError });
          }catch(_e){}
        }
      });
    }

    function saveMerged(opts){
      opts = opts || {};
      return enqueue(async function(){
        if(destroyed) return false;

        lastStatus.lastError = "";
        lastStatus.hasToken = !!getDropboxToken();

        var token = getDropboxToken();
        if(!token){
          uiSet("CloudKit: local-only (cannot save remote)");
          uiPulse(false);
          return false;
        }

        try{
          var paths = await ensureAndResolvePaths();

          var localP = normalizePayload(getLocal() || { counter:0, db:[] });
          var remoteP = await remoteReadJson(paths.dbPath);
          remoteP = normalizePayload(remoteP);

          var merged = mergePayload(localP, remoteP, { pk: pkField, merge: mergeCfg });
          if(merged.conflicts && merged.conflicts.length){
            stashConflicts(resourceKey, merged.conflicts);
          }

          var out = merged.payload;
          out.counter = Math.max(Number(out.counter||0), Number(localP.counter||0), Number(remoteP.counter||0));

          await remoteWriteJson(paths.dbPath, out);

          lastStatus.mode = "saved";
          lastStatus.lastSaveAt = Date.now();
          uiSet("CloudKit: saved " + resourceKey);
          uiPulse(true);

          // 寫完後回推一次到頁面
          safeApply(out, { source:"merged-local-remote", conflicts:(merged.conflicts||[]).length, reason: norm(opts.reason||"") });

          return true;
        }catch(e){
          lastStatus.lastError = (e && e.message) ? String(e.message) : String(e||"");
          lastStatus.mode = "error";
          uiSet("CloudKit: save error");
          uiPulse(false);
          console.warn("[TasunCloudKit] saveMerged error:", lastStatus.lastError);
          return false;
        }
      });
    }

    // init async
    (async function(){
      try{
        if(!resourceKey) throw new Error("mount() missing resourceKey");

        uiSet("CloudKit: mounting " + resourceKey);

        // ✅ mount 先至少套一次本機，避免空白
        try{
          var localFirst = getLocal() || {};
          safeApply(localFirst, { source:"local-initial" });
        }catch(e){}

        await pullNow();

        var sec = Number((watchCfg && watchCfg.intervalSec) || 0);
        if(Number.isFinite(sec) && sec > 0){
          timer = setInterval(function(){
            if(destroyed) return;
            pullNow();
          }, Math.max(2000, sec*1000));
        }

        lastStatus.mode = "ready";
        readyResolve(true);
      }catch(e){
        lastStatus.lastError = (e && e.message) ? String(e.message) : String(e||"");
        lastStatus.mode = "error";
        uiSet("CloudKit: mount error");
        uiPulse(false);
        console.warn("[TasunCloudKit] mount error:", lastStatus.lastError);
        try{ readyResolve(false); }catch(_e){}
      }
    })();

    // controller (minimal stable API)
    return {
      ready: ready,
      pullNow: pullNow,
      saveMerged: saveMerged,
      status: status,
      destroy: destroy
    };
  }

  // -------------------------------
  // Export global
  // -------------------------------
  window.TasunCloudKit = {
    init: init,
    mount: mount,
    _debug: {
      state: function(){ return shallowClone(_S); }
    }
  };

})();
