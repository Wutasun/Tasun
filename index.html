
  (function(){
    // 建立 __TASUN_READY__/__TASUN_WAIT__（後續 run() 會 push 進來）
    var WAIT = window.__TASUN_READY__;
    if(!WAIT || typeof WAIT !== "object"){
      var _q = [], _ready = false, _resolve = null;
      var _p = new Promise(function(res){ _resolve = res; });
      WAIT = {
        get ready(){ return _ready; },
        push: function(fn){ if(typeof fn!=="function") return; _ready ? fn() : _q.push(fn); },
        then: function(a,b){ return _p.then(a,b); },
        flush: function(){
          if(_ready) return;
          _ready = true;
          try{ _resolve(true); }catch(e){}
          var list = _q.splice(0);
          for(var i=0;i<list.length;i++){ try{ list[i](); }catch(e){} }
        }
      };
      window.__TASUN_READY__ = WAIT;
    }
    window.__TASUN_WAIT__ = WAIT;

    function norm(s){ return (s===undefined||s===null) ? "" : String(s).trim(); }
    function pickVer(j){
      if(!j || typeof j!=="object") return "";
      // 兼容多種欄位命名
      return norm(j.appVer || j.APP_VER || j.TASUN_APP_VER || j.ver || j.version || j.app_version || "");
    }

    async function loadJsonNoStore(url){
      try{
        var res = await fetch(url, { cache:"no-store", credentials:"omit" });
        if(!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      }catch(e){
        return null;
      }
    }

    function addV(src, APP){
      return src + (src.indexOf("?")>=0 ? "&" : "?") + "v=" + encodeURIComponent(APP);
    }
    function hasScript(id){ return !!document.querySelector('script[data-tasun-id="'+id+'"]'); }
    function loadOnce(id, src){
      return new Promise(function(resolve){
        if(hasScript(id)) return resolve(true);
        var s = document.createElement("script");
        s.src = src; s.async = false; s.setAttribute("data-tasun-id", id);
        s.onload = function(){ resolve(true); };
        s.onerror = function(){ resolve(false); };
        document.head.appendChild(s);
      });
    }

    (async function(){
      // 1) 讀取版本（版本檔走 no-store，避免卡舊）
      var vUrl;
      try{
        vUrl = new URL("tasun-version.json", location.href);
        vUrl.searchParams.set("_", String(Date.now()));
      }catch(e){
        vUrl = "tasun-version.json?_=" + Date.now();
      }
      var j = await loadJsonNoStore(String(vUrl));
      var APP = pickVer(j);

      // 若讀不到版本，就沿用 URL 的 v（若有）
      try{
        var u0 = new URL(location.href);
        var cur0 = norm(u0.searchParams.get("v"));
        if(!APP) APP = cur0;
      }catch(e){}

      if(APP) window.TASUN_APP_VER = APP;

      // 2) 進站必鎖定最新版 ?v=APP_VER（避免不同裝置卡舊版）
      //    ✅ 另外支援「使用者手動加 ?v=時間戳」作為防快取：會自動轉成 &_=時間戳，但仍維持 v=APP_VER
      try{
        if(APP){
          var u = new URL(location.href);
          var cur = norm(u.searchParams.get("v"));

          // 若 v 看起來是時間戳（10+ 位數），視為 cache-buster，不當作版本號
          var vts = "";
          if(cur && /^\d{10,}$/.test(cur) && cur !== APP){
            vts = cur;
          }

          var curKey = vts ? ("ts_" + vts) : (cur||"none");
          var KEY = "tasun_force_v_once__sxdh_notes__" + curKey + "_to_" + APP;

          // 需要替換成 APP_VER，並補上一個 cache-buster（_）
          if((cur !== APP || vts) && !sessionStorage.getItem(KEY)){
            sessionStorage.setItem(KEY, "1");
            u.searchParams.set("v", APP);
            u.searchParams.set("_", vts || String(Date.now()));
            location.replace(u.toString());
            return;
          }
        }
      }catch(e){}

// 3) 載入 tasun-core / tasun-boot（都帶 ?v=APP_VER）
      try{
        if(APP){
          if(!window.TasunCore) await loadOnce("tasun-core", addV("tasun-core.js", APP));
          await loadOnce("tasun-boot", addV("tasun-boot.js", APP));
        }else{
          // fallback：沒有版本時仍可載入（不帶 v）
          if(!window.TasunCore) await loadOnce("tasun-core", "tasun-core.js");
          await loadOnce("tasun-boot", "tasun-boot.js");
        }
      }catch(e){}

      try{ if(!WAIT.ready) WAIT.flush(); }catch(e){}
    })();
  })();
  


(function(){
  window.DEFAULT_NETDISK_URL = "https://www.dropbox.com/home/%E6%8D%B7%E9%81%8B%E6%B1%90%E6%AD%A2%E6%9D%B1%E6%B9%96%E7%B7%9A%E7%9B%A3%E9%80%A0%E5%B0%88%E6%A1%88";
})();



// iOS visualViewport / 100vh second-layer stabilization (no UI change)
(function(){
  var ua = navigator.userAgent || "";
  var isIOS = /iP(ad|hone|od)/.test(ua) || (ua.indexOf("Mac")>-1 && ("ontouchend" in document));
  if(!isIOS || !window.visualViewport) return;

  var raf = 0;
  function update(){
    raf = 0;
    var vv = window.visualViewport;
    var ih = window.innerHeight || 0;

    // Stable viewport height + offsets (address bar / keyboard)
    var h = Math.round(vv.height || ih);
    var top = Math.round(vv.offsetTop || 0);
    var bottom = Math.round(ih - (vv.height + vv.offsetTop));
    if(bottom < 0) bottom = 0;

    var root = document.documentElement;
    root.style.setProperty('--appH', h + 'px');
    root.style.setProperty('--vv-top', top + 'px');
    root.style.setProperty('--vv-bottom', bottom + 'px');
  }
  function schedule(){
    if(raf) return;
    raf = requestAnimationFrame(update);
  }

  window.visualViewport.addEventListener('resize', schedule, {passive:true});
  window.visualViewport.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('orientationchange', schedule, {passive:true});
  window.addEventListener('pageshow', schedule, {passive:true});
  document.addEventListener('focusin', schedule, {passive:true});
  document.addEventListener('focusout', schedule, {passive:true});
  schedule();
})();



  (function(){
    "use strict";

    // ---------------------------
    // Constants / Keys
    // ---------------------------
    var PAGE_KEY = "sxdh-notes";
// ✅ B方案：提供 TasunCloudKit mount() 必要的 resourceKey（避免 MOUNT_MISSING_KEY）
window.TASUN_RESOURCE_KEY = window.TASUN_RESOURCE_KEY || PAGE_KEY;
window.TASUN_PAGE_KEY = window.TASUN_PAGE_KEY || PAGE_KEY;
window.RESOURCE_KEY = window.RESOURCE_KEY || PAGE_KEY;

    var APP_VER = (window.TASUN_APP_VER||"").toString().trim() || (function(){try{var u=new URL(location.href);return (u.searchParams.get("v")||"").trim();}catch(e){return ""}})() || "dev";
    var RESOURCES_URL = "tasun-resources.json";

    var DEFAULT_API_BASE = "https://tasun-worker.wutasun.workers.dev";
    var DEFAULT_ENDPOINTS = { health:"/api/tasun/health", read:"/api/tasun/read", merge:"/api/tasun/merge" };
    // === 前端 API Base 強制鎖定（穩定鎖定版）===
    // 目的：避免 apiBase 變成空值或被 localStorage/資源檔覆寫，導致打到 https://wutasun.github.io/api/* 造成 404
    // 只鎖定「API Base 與 endpoints」，不影響 x-api-key（token）設定。
    var FORCE_API_BASE_LOCK = true;
    var FORCE_API_BASE = "https://tasun-worker.wutasun.workers.dev";
    var FORCE_ENDPOINTS = { health:"/api/tasun/health", read:"/api/tasun/read", merge:"/api/tasun/merge" };



    // === 雲端設定視窗鎖定（只顯示、不可修改；外觀不變）===
    var LOCK_CLOUD_CFG_UI = true;

    var AUTH_KEY = "tasunAuthTable_v1";
    var CURRENT_KEY = "tasunCurrentUser_v1";
    var CLOUD_TOKEN_KEY = "tasunCloudToken_v1__" + PAGE_KEY;
    var CLOUD_TOKEN_EXP_KEY = "tasunCloudTokenExp_v1__" + PAGE_KEY;

    var DB_KEY = "tasunSxdhNotes_v1";
    var COUNTER_KEY = "tasunSxdhNotes_counter_v1";
    var READ_MODE_KEY  = "tasunSxdhNotes_readMode_v1";

    var TRADE_DICT_KEY = "tasunSxdhNotes_tradeDict_v1";
    var SYS_DICT_KEY   = "tasunSxdhNotes_sysDict_v1";
    var SOURCE_DICT_KEY = "tasunSxdhNotes_sourceDict_v1";
    var TRADE_SYS_MAP_KEY = "tasunSxdhNotes_tradeSysMap_v1";
    var DB_SNAPSHOT_KEY = "tasunSxdhNotes_cloudSnapshot_v1";
    var DB_SNAPSHOT_META_KEY = "tasunSxdhNotes_cloudSnapshotMeta_v1";
    var DB_SNAPSHOT_SESSION_KEY = "tasunSxdhNotes_cloudSnapshot_session_v1";
    var DB_SNAPSHOT_SESSION_META_KEY = "tasunSxdhNotes_cloudSnapshotMeta_session_v1";
    var LEGACY_DB_KEYS = [
      "tasunSxdhNotes_v1",
      "tasunSxdhNotes_v2",
      "tasunSxdhNotes_db_v1",
      "tasunSxdhNotes_db_v2",
      "tasunSxdhNotes_rows_v1",
      "tasunSxdhNotes_rows_v2",
      "tasunSxdhNotes_data_v1",
      "tasunSxdhNotes_data_v2",
      "tasunSxdhNotes_cloudSnapshot_v1",
      "tasunSxdhNotes_cloudSnapshot_session_v1",
      "tasunSxdhNotes",
      "sxdh-notes",
      "sxdh_notes",
      "捷運汐東線事項記錄",
      "捷運汐東線事項紀錄",
      "捷運汐東線事項記錄_backup",
      "捷運汐東線事項紀錄_backup"
    ];

    // Optional overrides
    var API_BASE_LS_KEY = "tasunApiBase_v1";
    var API_EP_LS_KEY   = "tasunApiEndpoints_v1__" + PAGE_KEY;

    // ---------------------------
    // IndexedDB (真正資料庫) v1
    // ---------------------------
    var IDB_NAME = "tasun_notes_idb_v1";
    var IDB_VER  = 1;
    var IDB_META_STORE = "meta";
    var IDB_ROWS_STORE = "rows";
    var IDB_OPS_STORE  = "ops";

    var CLIENT_ID_KEY = "tasunClientId_v1";

    // ---------------------------
    // DOM helpers
    // ---------------------------
    function $(id){ return document.getElementById(id); }
    function norm(s){ return (s===undefined||s===null) ? "" : String(s).trim(); }
    function safeJSON(raw){ try{ return JSON.parse(raw); }catch(e){ return null; } }
    function nowISO(){ return new Date().toISOString(); }
    function todayISO(){ return new Date().toISOString().slice(0,10); }
    function pad2(n){ return String(n).padStart(2,"0"); }
    function fmtClock(ts){ if(!ts) return ""; var d = new Date(ts); return pad2(d.getHours())+":"+pad2(d.getMinutes())+":"+pad2(d.getSeconds()); }
    function uuid(){ return "u" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2); }

    // ---------------------------
    // IndexedDB helpers
    // ---------------------------
    var _idb = null;

    function getClientId(){
      var cid = norm(localStorage.getItem(CLIENT_ID_KEY));
      if(!cid){
        cid = "c" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
        localStorage.setItem(CLIENT_ID_KEY, cid);
      }
      return cid;
    }

    function idbReqToPromise(req){
      return new Promise(function(resolve,reject){
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ reject(req.error || new Error("IndexedDB error")); };
      });
    }

    function idbTxDone(tx){
      return new Promise(function(resolve,reject){
        tx.oncomplete = function(){ resolve(true); };
        tx.onerror = function(){ reject(tx.error || new Error("IndexedDB tx error")); };
        tx.onabort = function(){ reject(tx.error || new Error("IndexedDB tx abort")); };
      });
    }

    async function openIDB(){
      if(_idb) return _idb;
      _idb = await new Promise(function(resolve,reject){
        var req = indexedDB.open(IDB_NAME, IDB_VER);
        req.onupgradeneeded = function(){
          var db = req.result;
          if(!db.objectStoreNames.contains(IDB_META_STORE)){
            db.createObjectStore(IDB_META_STORE, { keyPath: "pageKey" });
          }
          if(!db.objectStoreNames.contains(IDB_ROWS_STORE)){
            var rows = db.createObjectStore(IDB_ROWS_STORE, { keyPath: ["pageKey","uid"] });
            rows.createIndex("by_page", "pageKey", { unique:false });
            rows.createIndex("by_page_updatedAt", ["pageKey","updatedAt"], { unique:false });
          }
          if(!db.objectStoreNames.contains(IDB_OPS_STORE)){
            var ops = db.createObjectStore(IDB_OPS_STORE, { keyPath: "opId", autoIncrement: true });
            ops.createIndex("by_page", "pageKey", { unique:false });
            ops.createIndex("by_page_ts", ["pageKey","ts"], { unique:false });
          }
        };
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ reject(req.error || new Error("IndexedDB open error")); };
      });
      return _idb;
    }

    async function idbGetMeta(pageKey){
      var db = await openIDB();
      var tx = db.transaction([IDB_META_STORE], "readonly");
      var store = tx.objectStore(IDB_META_STORE);
      var res = await idbReqToPromise(store.get(pageKey));
      await idbTxDone(tx);
      return res || null;
    }

    async function idbPutMeta(meta){
      var db = await openIDB();
      var tx = db.transaction([IDB_META_STORE], "readwrite");
      tx.objectStore(IDB_META_STORE).put(meta);
      await idbTxDone(tx);
      return true;
    }

    async function idbGetAllRows(pageKey){
      var db = await openIDB();
      var tx = db.transaction([IDB_ROWS_STORE], "readonly");
      var idx = tx.objectStore(IDB_ROWS_STORE).index("by_page");
      var rows = await idbReqToPromise(idx.getAll(pageKey));
      await idbTxDone(tx);
      return (rows||[]).map(function(r){
        if(!r) return null;
        var out = Object.assign({}, r);
        delete out.pageKey;
        return out;
      }).filter(Boolean);
    }

    async function idbPutRows(pageKey, rows){
      var db = await openIDB();
      var tx = db.transaction([IDB_ROWS_STORE], "readwrite");
      var store = tx.objectStore(IDB_ROWS_STORE);
      (rows||[]).forEach(function(r){
        if(!r || !r.uid) return;
        store.put(Object.assign({ pageKey: pageKey, uid: r.uid }, r));
      });
      await idbTxDone(tx);
      return true;
    }

    async function idbAddOp(pageKey, uid){
      uid = norm(uid);
      if(!uid) return;
      var db = await openIDB();
      var tx = db.transaction([IDB_OPS_STORE], "readwrite");
      tx.objectStore(IDB_OPS_STORE).add({ pageKey: pageKey, uid: uid, ts: Date.now() });
      await idbTxDone(tx);
    }

    async function idbGetDirtyUids(pageKey, sinceTs){
      var db = await openIDB();
      var tx = db.transaction([IDB_OPS_STORE], "readonly");
      var idx = tx.objectStore(IDB_OPS_STORE).index("by_page_ts");
      var range = IDBKeyRange.bound([pageKey, Number(sinceTs||0)], [pageKey, Number.MAX_SAFE_INTEGER]);
      var ops = await idbReqToPromise(idx.getAll(range));
      await idbTxDone(tx);
      var set = new Set();
      (ops||[]).forEach(function(op){ if(op && op.uid) set.add(op.uid); });
      return Array.from(set);
    }

    async function idbClearOps(pageKey){
      var db = await openIDB();
      var tx = db.transaction([IDB_OPS_STORE], "readwrite");
      var store = tx.objectStore(IDB_OPS_STORE);
      var idx = store.index("by_page");
      var keys = await idbReqToPromise(idx.getAllKeys(pageKey));
      keys.forEach(function(k){ store.delete(k); });
      await idbTxDone(tx);
      return true;
    }

    function markDirty(uid){
      try{ idbAddOp(PAGE_KEY, uid); }catch(e){}
      // ✅ 企業級最佳做法：任何變更都排程自動同步（去抖 + 互斥 + 離線重試）
      try{ scheduleSync("dirty"); }catch(e){}
    }

    // ---------------------------
    // Auto Sync (enterprise best practice)
    // ---------------------------
    var AUTO_SYNC = true;
    var SYNC_DEBOUNCE_MS = 900;      // 變更後去抖
    var SYNC_MIN_GAP_MS = 1500;      // 連續同步最小間隔
    var SYNC_PERIODIC_MS = 2*60*1000;// 週期保底同步
    var _sync = { timer:null, inFlight:false, pending:false, lastRun:0, lastReason:"" };

    function scheduleSync(reason, immediate){
      if(!AUTO_SYNC) return;
      _sync.pending = true;
      _sync.lastReason = reason || _sync.lastReason || "auto";
      if(_sync.timer) clearTimeout(_sync.timer);
      var now = Date.now();
      var gap = Math.max(0, (SYNC_MIN_GAP_MS - (now - (_sync.lastRun||0))));
      var wait = immediate ? Math.min(50, gap) : Math.max(SYNC_DEBOUNCE_MS, gap);
      _sync.timer = setTimeout(function(){ _sync.timer=null; runAutoSync(); }, wait);
    }

    async function runAutoSync(){
      if(!_sync.pending) return;
      if(_sync.inFlight) { _sync.pending = true; return; }
      _sync.inFlight = true;
      _sync.pending = false;
      try{
        if(navigator && navigator.onLine===false){
          // 離線：等恢復網路再同步
          _sync.pending = true;
          return;
        }
        await syncToCloud({ silent:true, reason:_sync.lastReason||"auto" });
      }catch(e){
        // 失敗：保留 pending，下次事件/週期再試
        _sync.pending = true;
      }finally{
        _sync.lastRun = Date.now();
        _sync.inFlight = false;
        if(_sync.pending) scheduleSync("retry");
      }
    }

    function toast(msg, ms){
      var t = $("toast");
      t.textContent = msg;
      t.style.display = "block";
      clearTimeout(toast._tm);
      var dur = Number(ms);
      if(!Number.isFinite(dur) || dur<=0) dur = 2600;
      toast._tm = setTimeout(function(){ t.style.display="none"; }, dur);
    }

    function escHtml(s){
      return (s ?? "").toString()
        .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
        .replaceAll('"',"&quot;").replaceAll("'","&#39;");
    }

    function addV(url){
      if(!url) return url;
      if(url.startsWith("http://") || url.startsWith("https://")){
        try{ var u = new URL(url); u.searchParams.set("v", APP_VER); return u.toString(); }catch(e){ return url; }
      }
      return url + (url.indexOf("?")>=0 ? "&" : "?") + "v=" + encodeURIComponent(APP_VER);
    }

    // ---------------------------
    // Auth
    // ---------------------------
    function ensureAuthTable(){
      var t = safeJSON(localStorage.getItem(AUTH_KEY));
      if(!t || typeof t !== "object"){
        t = {
          users: [
            { user:"alex", pass:"alex", role:"admin", name:"alex" },
            { user:"tasun", pass:"tasun", role:"write", name:"tasun" },
            { user:"wu", pass:"wu", role:"read", name:"wu" }
          ],
          updatedAt: nowISO(),
          rev: "seed"
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(t));
      }
      if(!Array.isArray(t.users)) t.users = [];
      return t;
    }

    function getCurrentUser(){
      var cur = safeJSON(localStorage.getItem(CURRENT_KEY));
      if(cur && cur.user && cur.role) return cur;
      cur = safeJSON(sessionStorage.getItem(CURRENT_KEY));
      if(cur && cur.user && cur.role) return cur;
      return null;
    }

    function setCurrentUser(u){
      if(!u){
        localStorage.removeItem(CURRENT_KEY);
        try{ sessionStorage.removeItem(CURRENT_KEY); }catch(e){}
      }else{
        localStorage.setItem(CURRENT_KEY, JSON.stringify(u));
        try{ sessionStorage.setItem(CURRENT_KEY, JSON.stringify(u)); }catch(e){}
      }
    }

    function setCloudToken(token, exp){
      token = norm(token);
      if(!token){
        try{ localStorage.removeItem(CLOUD_TOKEN_KEY); }catch(e){}
        try{ sessionStorage.removeItem(CLOUD_TOKEN_KEY); }catch(e){}
      }else{
        try{ localStorage.setItem(CLOUD_TOKEN_KEY, token); }catch(e){}
        try{ sessionStorage.setItem(CLOUD_TOKEN_KEY, token); }catch(e){}
      }
      if(exp===undefined || exp===null || exp===""){
        try{ localStorage.removeItem(CLOUD_TOKEN_EXP_KEY); }catch(e){}
        try{ sessionStorage.removeItem(CLOUD_TOKEN_EXP_KEY); }catch(e){}
      }else{
        var expStr = String(exp);
        try{ localStorage.setItem(CLOUD_TOKEN_EXP_KEY, expStr); }catch(e){}
        try{ sessionStorage.setItem(CLOUD_TOKEN_EXP_KEY, expStr); }catch(e){}
      }
    }

    function getCloudToken(){
      var t = "";
      try{ t = norm(localStorage.getItem(CLOUD_TOKEN_KEY)); }catch(e){ t = ""; }
      if(t) return t;
      try{ t = norm(sessionStorage.getItem(CLOUD_TOKEN_KEY)); }catch(e){ t = ""; }
      return t;
    }

    function getCloudTokenExp(){
      var v = "";
      try{ v = norm(localStorage.getItem(CLOUD_TOKEN_EXP_KEY)); }catch(e){ v = ""; }
      if(!v){ try{ v = norm(sessionStorage.getItem(CLOUD_TOKEN_EXP_KEY)); }catch(e){ v = ""; } }
      var n = Number(v||0);
      return Number.isFinite(n) ? n : 0;
    }

    function clearCloudToken(){
      setCloudToken("", "");
    }

    function hasUsableCloudToken(){
      var t = getCloudToken();
      if(!t) return false;
      var exp = getCloudTokenExp();
      if(exp && Date.now() > exp) return false;
      return true;
    }

    function handleCloudUnauth(message){
      clearCloudToken();
      setCurrentUser(null);
      try{ applyUser({ user:"—", role:"read", name:"—" }); }catch(e){}
      try{ openLogin(); }catch(e){}
      if(message) toast(message);
    }

    function roleRank(role){
      if(role==="admin") return 3;
      if(role==="write") return 2;
      return 1;
    }

    // ---------------------------
    // Cloud config
    // ---------------------------
    function parseJsonLenient(raw){
      raw = (raw===undefined||raw===null) ? "" : String(raw);
      try{ return JSON.parse(raw); }catch(e){}
      try{
        var cleaned = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(cleaned);
      }catch(e2){}
      return null;
    }

    function normalizeEndpoints(ep){
      ep = (ep && typeof ep==="object") ? ep : {};
      return {
        health: norm(ep.health || "/api/tasun/health") || "/api/tasun/health",
        read:   norm(ep.read   || "/api/tasun/read") || "/api/tasun/read",
        merge:  norm(ep.merge  || "/api/tasun/merge") || "/api/tasun/merge"
      };
    }

    function joinApiBase(base, path){
      base = norm(base).replace(/\/+$/,"");
      path = norm(path);
      if(!path) return base;
      if(/^https?:\/\//i.test(path)) return path;
      if(path.charAt(0)!="/") path = "/" + path;
      return base + path;
    }

    function isValidApiBase(v){
      v = norm(v);
      if(!v) return false;
      if(!/^https?:\/\//i.test(v)) return false;
      if(/YOUR-WORKER-DOMAIN/i.test(v)) return false;
      return true;
    }

    function getFileName(){
      try{
        var p = location.pathname || "";
        var fn = p.split("/").pop() || "";
        return decodeURIComponent(fn) || fn;
      }catch(e){ return (location.pathname||"").split("/").pop() || ""; }
    }

    var _cloudCfgCache = null;

    async function loadCloudCfg(){
      if(_cloudCfgCache) return _cloudCfgCache;

      // Start with defaults
      var cfg = { apiBase: DEFAULT_API_BASE, endpoints: Object.assign({}, DEFAULT_ENDPOINTS), netDiskUrl: "https://www.dropbox.com/home/%E6%8D%B7%E9%81%8B%E6%B1%90%E6%AD%A2%E6%9D%B1%E6%B9%96%E7%B7%9A%E7%9B%A3%E9%80%A0%E5%B0%88%E6%A1%88" };

      // 1) resources.json (best)
      try{
        var res = await fetch(addV(RESOURCES_URL), { cache:"no-store" });
        if(res && res.ok){
          var text = await res.text();
          var json = parseJsonLenient(text);
          if(json && json.resources && typeof json.resources==="object"){
            var fn = getFileName();
            var r = json.resources;
            var pick = r[fn] || r[PAGE_KEY] || r["*"] || null;
            if(pick){
              if(isValidApiBase(pick.apiBase)) cfg.apiBase = pick.apiBase;
              if(pick.endpoints) cfg.endpoints = normalizeEndpoints(pick.endpoints);
              if(pick.netDiskUrl) cfg.netDiskUrl = String(pick.netDiskUrl);
              else if(pick.links && pick.links.netDiskUrl) cfg.netDiskUrl = String(pick.links.netDiskUrl);

            }else{
              if(isValidApiBase(json.apiBase)) cfg.apiBase = json.apiBase;
              if(json.endpoints) cfg.endpoints = normalizeEndpoints(json.endpoints);
              if(json.netDiskUrl) cfg.netDiskUrl = String(json.netDiskUrl);
              else if(json.links && json.links.netDiskUrl) cfg.netDiskUrl = String(json.links.netDiskUrl);

            }
          }
        }
      }catch(e){ /* ignore */ }

      // 2) local overrides (optional)
      // ⚠️ 本版已啟用「前端 API Base 強制鎖定」：避免 apiBase/endpoint 被覆寫成空值或指向 GitHub Pages。
      if(!FORCE_API_BASE_LOCK){
        var ob = norm(localStorage.getItem(API_BASE_LS_KEY));
        if(isValidApiBase(ob)) cfg.apiBase = ob;

        var oe = safeJSON(localStorage.getItem(API_EP_LS_KEY));
        if(oe) cfg.endpoints = normalizeEndpoints(Object.assign({}, cfg.endpoints, oe));
      }

      // ✅ 最終強制覆寫（穩定鎖定）
      if(FORCE_API_BASE_LOCK){
        cfg.apiBase = FORCE_API_BASE;
        cfg.endpoints = Object.assign({}, cfg.endpoints, FORCE_ENDPOINTS);
      }

      _cloudCfgCache = cfg;

      // ✅ 同步雲端設定狀態到提示列（不改 UI）
      try{
        state.cloud.apiBase = cfg.apiBase || "";
        state.cloud.endpoints = cfg.endpoints || null;
        state.cloud.cfgOk = !!(cfg && isValidApiBase(cfg.apiBase));
      }catch(e){}

      return cfg;
    }

    // ---------------------------
    // Local data + dicts
    // ---------------------------
        async function loadDb(){
      function tryArray(raw){
        var parsed = safeJSON(raw);
        return Array.isArray(parsed) ? parsed : [];
      }

      function tryPayloadRows(raw){
        var parsed = safeJSON(raw);
        if(!parsed) return [];
        var payload = unwrap(parsed);
        if(Array.isArray(payload)) return payload;
        if(payload && typeof payload==="object"){
          if(Array.isArray(payload.db)) return payload.db;
          if(Array.isArray(payload.rows)) return payload.rows;
          if(Array.isArray(payload.items)) return payload.items;
          if(Array.isArray(payload.records)) return payload.records;
          if(Array.isArray(payload.data)) return payload.data;
        }
        return [];
      }

      function pickLegacyDbArr(){
        var best = [];
        var stores = [localStorage, sessionStorage];
        var keys = [DB_KEY, DB_SNAPSHOT_KEY, DB_SNAPSHOT_SESSION_KEY].concat(LEGACY_DB_KEYS);
        for(var s=0;s<stores.length;s++){
          var storage = stores[s];
          for(var i=0;i<keys.length;i++){
            var k = keys[i];
            var arr = [];
            try{
              arr = tryArray(storage.getItem(k));
              if(!arr.length) arr = tryPayloadRows(storage.getItem(k));
            }catch(e){ arr = []; }
            if(arr.length > best.length) best = arr;
          }
        }
        return best;
      }

      var meta = null, rows = [];
      try{
        meta = await idbGetMeta(PAGE_KEY);
        rows = await idbGetAllRows(PAGE_KEY);
      }catch(e){ meta=null; rows=[]; }

      var snapshotRows = [];
      try{ snapshotRows = tryArray(localStorage.getItem(DB_SNAPSHOT_KEY)); }catch(e){ snapshotRows = []; }
      if(!snapshotRows.length){ try{ snapshotRows = tryArray(sessionStorage.getItem(DB_SNAPSHOT_SESSION_KEY)); }catch(e){ snapshotRows = []; } }
      if(!snapshotRows.length){ try{ snapshotRows = tryPayloadRows(localStorage.getItem(DB_SNAPSHOT_KEY)); }catch(e){ snapshotRows = []; } }
      if(!snapshotRows.length){ try{ snapshotRows = tryPayloadRows(sessionStorage.getItem(DB_SNAPSHOT_SESSION_KEY)); }catch(e){ snapshotRows = []; } }

      var legacyRows = [];
      try{ legacyRows = pickLegacyDbArr(); }catch(e){ legacyRows = []; }

      var mergedRows = [];
      try{
        mergedRows = mergePayload(
          { db: rows || [], counter: Number(meta && meta.counter || 0) || 0 },
          { db: (snapshotRows || []).concat(legacyRows || []), counter: 0 }
        ).db || [];
      }catch(e){
        mergedRows = (rows && rows.length) ? rows : ((snapshotRows && snapshotRows.length) ? snapshotRows : legacyRows);
      }

      if(meta || (mergedRows && mergedRows.length)){
        var counter = Number(meta && meta.counter || 0) || 0;
        if(!counter) counter = Number(localStorage.getItem(COUNTER_KEY)||"0") || 0;
        state.lastSyncAt = Number(meta && meta.lastSyncAt || 0) || 0;
        state.clientId = norm(meta && meta.clientId) || getClientId();
        try{
          if((mergedRows && mergedRows.length) && JSON.stringify(mergedRows)!==JSON.stringify(rows||[])){
            await idbPutRows(PAGE_KEY, mergedRows);
          }
        }catch(e){}
        return { db: mergedRows||[], counter: counter };
      }

      var arr = pickLegacyDbArr();
      if(!Array.isArray(arr) || !arr.length) arr = snapshotRows;
      if(!Array.isArray(arr)) arr = [];
      var c = Number(localStorage.getItem(COUNTER_KEY)||"0");
      if(!Number.isFinite(c) || c<0) c = 0;

      state.lastSyncAt = 0;
      state.clientId = getClientId();

      try{
        await idbPutRows(PAGE_KEY, arr);
        await idbPutMeta({ pageKey: PAGE_KEY, counter: c, lastSyncAt: 0, clientId: state.clientId, updatedAt: nowISO() });
      }catch(e){}

      return { db: arr, counter: c };
    }


    // 嘗試復原舊版本本機資料（不同 key / 舊備份格式），並合併回目前 db
    function recoverLegacyLocal(){
      // 以「內容特徵」找舊資料：任何 storage key 只要能解析出 {db:[{uid/text/trade/sys/...}], counter} 或直接是陣列，都納入合併
      function tryParsePayload(parsed){
        if(Array.isArray(parsed)){
          // 直接是資料列陣列
          return { db: parsed, counter: 0 };
        }
        if(parsed && typeof parsed==="object"){
          // 可能包在 payload/data/result
          var un = unwrap(parsed);
          if(Array.isArray(un.db) && un.db.length) return { db: un.db, counter: un.counter||0 };
          // 也可能就是 {records:[...]} 或 {rows:[...]} 等
          if(Array.isArray(parsed.records) && parsed.records.length) return { db: parsed.records, counter: Number(parsed.counter||0)||0 };
          if(Array.isArray(parsed.rows) && parsed.rows.length) return { db: parsed.rows, counter: Number(parsed.counter||0)||0 };
          if(Array.isArray(parsed.items) && parsed.items.length) return { db: parsed.items, counter: Number(parsed.counter||0)||0 };
        }
        return null;
      }

      function looksLikeRow(x){
        if(!x || typeof x!=="object") return false;
        // 允許舊欄名：content/note/body 也視作 text
        var hasUid = !!norm(x.uid || x.pk || x.key || x.uuid || "");
        var hasText = !!norm(x.text || x.content || x.note || x.body || x.msg || "");
        var hasMeta = !!norm(x.trade || x.kind || x.work || "") || !!norm(x.sys || x.system || "") || !!norm(x.date || x.createdAt || "");
        return (hasUid && hasText) || (hasText && hasMeta);
      }

      function normalizeLegacyRows(arr){
        var out = [];
        for(var i=0;i<(arr||[]).length;i++){
          var x = arr[i];
          if(!x || typeof x!=="object") continue;
          // map legacy fields
          var uid = norm(x.uid || x.pk || x.key || x.uuid || "");
          if(!uid) uid = uuid(); // fallback
          out.push({
            uid: uid,
            id: Number(x.id||x.no||0)||0,
            text: norm(x.text || x.content || x.note || x.body || x.msg || ""),
            trade: norm(x.trade || x.kind || x.work || ""),
            sys: norm(x.sys || x.system || ""),
            source: norm(x.source || x.from || x.origin || ""),
            attach: norm(x.attach || x.link || x.url || ""),
            remark: norm(x.remark || x.memo || ""),
            date: norm(x.date || (x.createdAt? String(x.createdAt).slice(0,10):"") || ""),
            updatedAt: norm(x.updatedAt || x.updated || x.modifiedAt || x.ts || ""),
            rev: norm(x.rev || x.version || ""),
            deleted: !!(x.deleted || x.isDeleted)
          });
        }
        return out;
      }

      function scanStorage(storage, storageName){
        var keys = [];
        try{
          for(var i=0;i<storage.length;i++){
            var k = storage.key(i);
            if(k) keys.push(k);
          }
        }catch(e){}
        var mergedAny = false;
        var localNow = { db: state.db, counter: state.counter };
        var matched = [];
        for(var j=0;j<keys.length;j++){
          var key = keys[j];
          if(key===DB_KEY || key===COUNTER_KEY || key===READ_MODE_KEY) continue;
          var raw = null;
          try{ raw = storage.getItem(key); }catch(e){ raw=null; }
          if(!raw || raw.length<2) continue;

          var parsed = safeJSON(raw);
          if(!parsed) continue;

          var pay = tryParsePayload(parsed);
          if(!pay || !Array.isArray(pay.db) || !pay.db.length) continue;

          // 檢查是否像是我們的資料列（至少 1 筆符合）
          var arr = pay.db;
          var ok = false;
          for(var k=0;k<Math.min(arr.length, 10);k++){
            if(looksLikeRow(arr[k])) { ok = true; break; }
          }
          if(!ok) continue;

          // normalize legacy
          var normed = normalizeLegacyRows(arr);
          if(!normed.length) continue;

          var merged = mergePayload({ db: normed, counter: pay.counter||0 }, localNow);
          localNow = { db: merged.db, counter: merged.counter };
          mergedAny = true;
          matched.push({ storage: storageName, key: key, rows: normed.length, bytes: raw.length });
        }

        if(mergedAny){
          state.db = localNow.db;
          state.counter = localNow.counter;
          saveLocal({ db: state.db, counter: state.counter });
          buildDictsFromDb();
        }
        return { mergedAny: mergedAny, matched: matched };
      }

      var res1 = scanStorage(localStorage, "localStorage");
      var res2 = scanStorage(sessionStorage, "sessionStorage");

      // expose last scan result for debugging
      state._legacyScan = { local: res1, session: res2, at: nowISO() };

      return !!(res1.mergedAny || res2.mergedAny);
    }


        async function saveLocal(payload){
      var dbArr = payload.db||[];
      var counter = Number(payload.counter||0)||0;

      // IDB primary
      try{
        await idbPutRows(PAGE_KEY, dbArr);
        await idbPutMeta({
          pageKey: PAGE_KEY,
          counter: counter,
          lastSyncAt: Number(state.lastSyncAt||0)||0,
          clientId: state.clientId || getClientId(),
          updatedAt: nowISO()
        });
      }catch(e){}

      // localStorage fallback
      try{
        localStorage.setItem(DB_KEY, JSON.stringify(dbArr));
        localStorage.setItem(COUNTER_KEY, String(counter));
      }catch(e){}
      try{
        saveSnapshot(dbArr, { source:"saveLocal", counter: counter });
      }catch(e){}
    }

    function normalizeRow(x){
      if(!x || typeof x!=="object") return null;
      var r = Object.assign({}, x);

      // 兼容舊欄位命名：system/系統、trade/工種、text/記事內容... 等
      var pick = function(obj, keys){
        for(var i=0;i<keys.length;i++){
          var k = keys[i];
          if(obj && obj[k]!==undefined && obj[k]!==null && String(obj[k]).trim()!=="") return obj[k];
        }
        return "";
      };

      // uid / pk
      r.uid = norm(pick(r, ["uid","pk","_pk","uuid","_uid","user"])) || "";
      if(!r.uid) return null;

      // 顯示用 id（允許舊資料用「項次/序號」）
      var rawId = pick(r, ["id","_id","no","項次","序號"]);
      r.id = Number(rawId || 0);

      r.text = norm(pick(r, ["text","content","記事內容","事項內容","內容","記事"])) || "";
      r.trade = norm(pick(r, ["trade","工種","類別","工程","工別"])) || "";
      r.sys = norm(pick(r, ["sys","system","系統","系統項目","系統別"])) || "";
      r.source = norm(pick(r, ["source","src","出處","來源"])) || "";
      r.attach = norm(pick(r, ["attach","附件","file","files","附件連結"])) || "";
      r.remark = norm(pick(r, ["remark","備註","note","註記"])) || "";

      // 日期欄位兼容（仍以字串顯示）
      r.date = norm(pick(r, ["date","登錄日期","日期","createdAt","created_at"])) || "";
      r.updatedAt = norm(pick(r, ["updatedAt","updated_at","updateAt","ts","time"])) || "";
      r.rev = norm(pick(r, ["rev","_rev","version"])) || "";

      r.deleted = !!(r.deleted || r._deleted);
      return r;
    }

    // ---------------------------
    // Legacy UID migration (deterministic)
    // ---------------------------
    // Some older localStorage rows may not contain uid/pk.
    // To keep multi-device merge stable, we derive a deterministic uid from row content,
    // then persist it back into DB_KEY once per device.
    function fnv1a32(str){
      str = (str===undefined||str===null) ? "" : String(str);
      var h = 0x811c9dc5;
      for(var i=0;i<str.length;i++){
        h ^= str.charCodeAt(i);
        // h *= 16777619 (with 32-bit overflow)
        h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0;
      }
      return ("00000000" + h.toString(16)).slice(-8);
    }

    function deriveLegacyUid(rawRow){
      if(!rawRow || typeof rawRow!=="object") return "";
      // Use the same pick logic as normalizeRow, but allow missing uid
      var pick = function(obj, keys){
        for(var i=0;i<keys.length;i++){
          var k = keys[i];
          if(obj && obj[k]!==undefined && obj[k]!==null && String(obj[k]).trim()!=="") return obj[k];
        }
        return "";
      };
      var id = String(pick(rawRow, ["id","_id","no","項次","序號"]) || "");
      var text = norm(pick(rawRow, ["text","content","記事內容","事項內容","內容","記事"]) || "");
      var trade = norm(pick(rawRow, ["trade","工種","類別","工程","工別"]) || "");
      var sys = norm(pick(rawRow, ["sys","system","系統","系統項目","系統別"]) || "");
      var source = norm(pick(rawRow, ["source","src","出處","來源"]) || "");
      var attach = norm(pick(rawRow, ["attach","附件","file","files","附件連結"]) || "");
      var remark = norm(pick(rawRow, ["remark","備註","note","註記"]) || "");
      var date = norm(pick(rawRow, ["date","登錄日期","日期","createdAt","created_at"]) || "");
      // If we still have nothing meaningful, skip
      if(!text && !trade && !sys && !source && !attach && !remark && !id && !date) return "";
      var key = [PAGE_KEY, id, date, trade, sys, source, attach, remark, text].join("|");
      return "l" + fnv1a32(key);
    }

    function migrateEnsureUidInPlace(){
      var changed = false;
      for(var i=0;i<(state.db||[]).length;i++){
        var x = state.db[i];
        if(!x || typeof x!=="object") continue;
        var uid = norm(x.uid || x.pk || x._pk || x.uuid || x._uid || "");
        if(!uid){
          uid = deriveLegacyUid(x);
          if(uid){
            x.uid = uid;
            x.pk = uid;
            changed = true;
          }
        }else{
          // normalize pk convenience
          if(!x.pk) { x.pk = uid; changed = true; }
          if(!x.uid) { x.uid = uid; changed = true; }
        }
        // normalize minimal fields so normalizeRow can work
        if(x.deleted===undefined && x._deleted!==undefined){ x.deleted = !!x._deleted; changed = true; }
        if(x.deleted===undefined) x.deleted = !!x.deleted;
        if(!x.rev){ x.rev = "r" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2,6); changed = true; }
        if(!x.updatedAt){ x.updatedAt = nowISO(); changed = true; }
      }
      if(changed){
        saveLocal({ db: state.db, counter: state.counter });
      }
      return changed;
    }

function getVisibleRows(){
      var q = norm($("qText").value).toLowerCase();
      var ft = norm($("fTrade").value);
      var fs = norm($("fSys").value);
      var rows = state.db
        .map(normalizeRow)
        .filter(Boolean)
        .filter(function(r){ return !r.deleted; });

      // sort by id asc
      rows.sort(function(a,b){ return (Number(a.id||0)-Number(b.id||0)) || (tsOf(a)-tsOf(b)); });

      if(q){
        rows = rows.filter(function(r){ return (r.text||"").toLowerCase().includes(q); });
      }
      if(ft){
        rows = rows.filter(function(r){ return r.trade===ft; });
      }
      if(fs){
        rows = rows.filter(function(r){ return r.sys===fs; });
      }
      return rows;
    }

    function displayNoOf(uid){
      uid = norm(uid);
      if(!uid) return 0;
      var rows = getVisibleRows();
      for(var i=0;i<rows.length;i++){
        if(rows[i] && rows[i].uid===uid) return i+1;
      }
      return 0;
    }


    function buildDictsFromDb(){
      var rows = state.db.map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; });
      var trades = new Set(loadDict(TRADE_DICT_KEY));
      var syss = new Set(loadDict(SYS_DICT_KEY));
      var sources = new Set(loadDict(SOURCE_DICT_KEY));

      var map = loadMap(); // trade -> [sys]
      for(var i=0;i<rows.length;i++){
        var r = rows[i];
        if(r.trade) trades.add(r.trade);
        if(r.sys) syss.add(r.sys);
        if(r.source) sources.add(r.source);
        if(r.trade && r.sys){
          map[r.trade] = map[r.trade] || [];
          if(!map[r.trade].includes(r.sys)) map[r.trade].push(r.sys);
        }
      }
      saveDict(TRADE_DICT_KEY, Array.from(trades).sort());
      saveDict(SYS_DICT_KEY, Array.from(syss).sort());
      saveDict(SOURCE_DICT_KEY, Array.from(sources).sort());
      saveMap(map);
    }

    // 修訂2：依工種取得系統清單（來源：工種-系統綁定表 + 本頁資料），並去重排序
    function collectSysForTrade(trade, dbArr){
      trade = norm(trade);
      var set = new Set();

      // 來源1：工種-系統綁定表（指定工種）
      var bound = (TRADE_SYS_MAP && trade && TRADE_SYS_MAP[trade]) ? TRADE_SYS_MAP[trade] : [];
      for(var i=0;i<bound.length;i++){ if(bound[i]) set.add(String(bound[i])); }

      // 來源2：本頁資料庫中該工種實際出現過的系統（補強：避免綁定表漏掉）
      var rows = (dbArr||[]).map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; });
      for(var j=0;j<rows.length;j++){
        if(rows[j].trade===trade && rows[j].sys) set.add(rows[j].sys);
      }

      return Array.from(set).sort();
    }







    // ---------------------------
    // Dict / Map helpers
    // ---------------------------
    function loadDict(key){
      var a = safeJSON(localStorage.getItem(key));
      return Array.isArray(a) ? a.filter(Boolean).map(function(x){return norm(x);}).filter(Boolean) : [];
    }
    function saveDict(key, arr){
      arr = Array.isArray(arr) ? arr.filter(Boolean).map(function(x){return norm(x);}).filter(Boolean) : [];
      // unique + sort
      var set = new Set(arr);
      localStorage.setItem(key, JSON.stringify(Array.from(set).sort()));
    }
    function loadMap(){
      var m = safeJSON(localStorage.getItem(TRADE_SYS_MAP_KEY));
      return (m && typeof m==="object") ? m : {};
    }
    function saveMap(m){
      if(!m || typeof m!=="object") m = {};
      // normalize arrays
      Object.keys(m).forEach(function(k){
        var a = m[k];
        if(!Array.isArray(a)) a = [];
        var set = new Set(a.map(function(x){return norm(x);}).filter(Boolean));
        m[k] = Array.from(set).sort();
      });
      localStorage.setItem(TRADE_SYS_MAP_KEY, JSON.stringify(m));
    }

    function saveSnapshot(rows, meta){
      var arr = Array.isArray(rows) ? rows : [];
      try{ localStorage.setItem(DB_SNAPSHOT_KEY, JSON.stringify(arr)); }catch(e){}
      try{ sessionStorage.setItem(DB_SNAPSHOT_SESSION_KEY, JSON.stringify(arr)); }catch(e){}
      var metaObj = Object.assign({ at: nowISO(), appVer: APP_VER, pageKey: PAGE_KEY }, meta||{});
      try{ localStorage.setItem(DB_SNAPSHOT_META_KEY, JSON.stringify(metaObj)); }catch(e){}
      try{ sessionStorage.setItem(DB_SNAPSHOT_SESSION_META_KEY, JSON.stringify(metaObj)); }catch(e){}
    }

    function loadSnapshotRows(){
      var arr = safeJSON(localStorage.getItem(DB_SNAPSHOT_KEY));
      if(Array.isArray(arr) && arr.length) return arr;
      arr = safeJSON(sessionStorage.getItem(DB_SNAPSHOT_SESSION_KEY));
      return Array.isArray(arr) ? arr : [];
    }

    function normalizeCloudDbPayload(payload){
      var p = unwrap(payload);
      if(Array.isArray(p)) return p;
      if(!p || typeof p!=="object") return [];
      if(Array.isArray(p.db)) return p.db;
      if(Array.isArray(p.rows)) return p.rows;
      if(Array.isArray(p.items)) return p.items;
      if(Array.isArray(p.records)) return p.records;
      if(Array.isArray(p.data)) return p.data;
      if(p.payload && typeof p.payload==="object") return normalizeCloudDbPayload(p.payload);
      return [];
    }

    function unwrap(obj){
      if(!obj || typeof obj!=="object") return obj;
      return obj.payload ?? obj.data ?? obj.result ?? obj;
    }

    function tsOf(r){
      var raw = r && (r.updatedAt!==undefined ? r.updatedAt : (r.ts!==undefined ? r.ts : (r.time!==undefined ? r.time : "")));
      var n = Number(raw||0);
      if(Number.isFinite(n) && n>0) return n;
      var t = norm(raw);
      if(!t) return 0;
      n = Date.parse(t);
      return Number.isFinite(n) ? n : 0;
    }

    // ---------------------------
    // State
    // ---------------------------
    var state = {
      lastSyncAt:0,
      clientId:'',
      db: [],
      counter: 0,
      user: null,
      role: "read",
      selectedUid: "",
      mode: "view",
      readMode: false,
      cloud: { ok:false, cfgOk:false, apiBase:"", endpoints:null, lastSyncAt:"", lastOkAt:"" },
      _legacyScan: null
    };

    // load map once (kept in memory + persisted on change)
    var TRADE_SYS_MAP = loadMap();

    // ---------------------------
    // Merge logic (cloud/local)
    // ---------------------------
    function ensureRowV1(r){
      r = normalizeRow(r);
      if(!r) return null;

      // mandatory fields per v1
      r.uid = norm(r.uid);
      if(!r.uid) return null;
      r.pk = r.uid; // internal convenience
      var ts = Number(r.updatedAt||0);
      if(!Number.isFinite(ts) || ts<=0){
        var parsed = Date.parse(r.updatedAt || "");
        ts = Number.isFinite(parsed) ? parsed : Date.now();
      }
      r.updatedAt = ts;
      var rv = Number(r.rev||0);
      if(!Number.isFinite(rv) || rv<=0) rv = ts;
      r.rev = rv;
      r.deleted = !!r.deleted;

      // id is display only; keep numeric but not required
      if(!Number.isFinite(Number(r.id))) r.id = 0;

      // normalize date value (YYYY-MM-DD preferred)
      if(r.date && /^\d{4}-\d{2}-\d{2}/.test(r.date)===false){
        // accept ISO -> slice
        if(/^\d{4}-\d{2}-\d{2}T/.test(r.date)) r.date = r.date.slice(0,10);
      }
      return r;
    }

    function mergeTwo(a, b){
      // choose newer by updatedAt; tie -> keep non-empty fields of either
      var ta = tsOf(a), tb = tsOf(b);
      var newer = (tb>ta) ? b : a;
      var older = (newer===a) ? b : a;
      var out = Object.assign({}, older, newer);
      // ✅ 修訂：避免「系統 sys」在雲端合併時被空字串覆蓋（曾造成表格顯示異常）
// 但其他欄位（例如附件 attach）必須允許使用者清空，所以只保護 sys。
(["sys"]).forEach(function(k){
  var touched = !!(newer && newer._touch && newer._touch[k]);
  // 若非刻意清空，且新值為空、舊值不空，則保留舊值
  if(!touched && !norm(newer && newer[k]) && norm(older && older[k])) out[k] = older[k];
});

// if either says deleted true and it's newer, keep deleted true
      out.deleted = !!newer.deleted;

      // keep essential fields
      out.uid = norm(out.uid || newer.uid || older.uid);
      var outTs = Number(out.updatedAt||0);
      if(!Number.isFinite(outTs) || outTs<=0){
        var parsedTs = Date.parse(out.updatedAt || "");
        outTs = Number.isFinite(parsedTs) ? parsedTs : Date.now();
      }
      out.updatedAt = outTs;
      var outRev = Number(out.rev||0);
      if(!Number.isFinite(outRev) || outRev<=0) outRev = outTs;
      out.rev = outRev;
      out.pk = out.uid;
      return out;
    }

    function mergePayload(remote, local){
      // payload: {db:[rows], counter}
      var ldb = (local && Array.isArray(local.db)) ? local.db : [];
      var rdb = (remote && Array.isArray(remote.db)) ? remote.db : [];

      var map = new Map();
      function put(x){
        var r = ensureRowV1(x);
        if(!r) return;
        var key = r.uid;
        if(!map.has(key)) map.set(key, r);
        else map.set(key, mergeTwo(map.get(key), r));
      }
      ldb.forEach(put);
      rdb.forEach(put);

      var outDb = Array.from(map.values());
      // keep stable order: by date desc then updatedAt desc, else uid
      outDb.sort(function(a,b){
        var da = norm(a.date), db = norm(b.date);
        if(da && db && da!==db) return db.localeCompare(da);
        var ta = tsOf(a), tb = tsOf(b);
        if(tb!==ta) return tb-ta;
        return norm(a.uid).localeCompare(norm(b.uid));
      });

      var lc = Number(local && local.counter || 0) || 0;
      var rc = Number(remote && remote.counter || 0) || 0;
      return { db: outDb, counter: Math.max(lc, rc) };
    }

    // ---------------------------
    // UI: filters and selects
    // ---------------------------
    function setOptions(el, arr, keepValue, opt){
      opt = opt || {};
      if(!el) return;
      var cur = keepValue ? norm(el.value) : "";
      var tag = (el.tagName||"").toUpperCase();

      // SELECT: rebuild <option>
      if(tag==="SELECT"){
        el.innerHTML = "";
        if(opt.includeAll){
          var op0 = document.createElement("option");
          op0.value = ""; op0.textContent = "全部";
          el.appendChild(op0);
        }
        (arr||[]).forEach(function(v){
          v = norm(v);
          if(!v) return;
          var op = document.createElement("option");
          op.value = v; op.textContent = v;
          el.appendChild(op);
        });
        if(opt.forceValue!==undefined) el.value = String(opt.forceValue);
        if(keepValue && cur && Array.from(el.options).some(function(o){return o.value===cur;})){
          el.value = cur;
        }
        return;
      }

      // INPUT + datalist: rebuild datalist options (keep input value as-is)
      var listId = el.getAttribute("list");
      var dl = listId ? $(listId) : null;
      if(dl){
        dl.innerHTML = "";
        (arr||[]).forEach(function(v){
          v = norm(v);
          if(!v) return;
          var op = document.createElement("option");
          op.value = v;
          dl.appendChild(op);
        });
      }
      if(keepValue && cur) el.value = cur;
    }

    function uniqueOf(arr){
      var set = new Set();
      (arr||[]).forEach(function(x){ x = norm(x); if(x) set.add(x); });
      return Array.from(set).sort();
    }

    // ✅ 系統篩選清單：需與「目前搜尋/工種」顯示結果一致（不含系統本身的篩選）
    function getBaseRowsForSysFilter(){
      var q = norm($("qText").value).toLowerCase();
      var ft = norm($("fTrade").value);
      var rows = state.db
        .map(normalizeRow)
        .filter(Boolean)
        .filter(function(r){ return !r.deleted; });

      if(ft){
        rows = rows.filter(function(r){ return r.trade===ft; });
      }
      if(q){
        rows = rows.filter(function(r){ return (r.text||"").toLowerCase().includes(q); });
      }
      return rows;
    }


    function rebuildFilterOptions(){
      // build dicts first
      buildDictsFromDb();

      var rows = state.db.map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; });

      // ✅ 主頁「工種」篩選：只顯示目前資料表工種不重複
      var tradesTable = uniqueOf(rows.map(function(r){return r.trade;}));
      setOptions($("fTrade"), tradesTable, true, { includeAll:true });

      // ✅ 主頁「系統」篩選：需與「目前搜尋/工種」顯示結果一致（避免下拉選單與列表不一致）
      var sysList;
      var ft = norm($("fTrade").value);
      if(ft){
        var baseRows = getBaseRowsForSysFilter(); // 已套用 工種 + 搜尋（不含系統篩選）
        sysList = uniqueOf(baseRows.map(function(r){ return r.sys; }));
        // 若目前搜尋結果剛好 0 筆，仍保留「工種所屬系統」作為備援（避免空選單）
        if(!sysList.length){
          sysList = collectSysForTrade(ft, state.db);
        }
      }else{
        var q = norm($("qText").value).toLowerCase();
        var baseRows2 = rows.slice();
        if(q){
          baseRows2 = baseRows2.filter(function(r){ return (r.text||"").toLowerCase().includes(q); });
        }
        sysList = uniqueOf(baseRows2.map(function(r){ return r.sys; }));
        if(!sysList.length){
          // 備援：字典 + 本頁資料
          sysList = uniqueOf(rows.map(function(r){return r.sys;})).concat(loadDict(SYS_DICT_KEY));
          sysList = uniqueOf(sysList);
        }
      }
      setOptions($("fSys"), sysList, true, { includeAll:true });

      // ✅「新增/編輯」視窗  工種：依字典不重複（若字典空，回退用表格不重複）
      var tradeDict = uniqueOf(loadDict(TRADE_DICT_KEY));
      if(!tradeDict.length) tradeDict = tradesTable.slice();
      setOptions($("mTradeSel"), tradeDict, true, { includeBlank:true });

      // ✅「新增/編輯」視窗  系統：依字典工種所屬不重複系統（工種-系統綁定表 + 本頁資料）
      var mTrade = norm($("mTradeSel").value);
      var mSysList = mTrade ? collectSysForTrade(mTrade, state.db) : uniqueOf(loadDict(SYS_DICT_KEY));
      setOptions($("mSysSel"), mSysList, true, { includeBlank:true });

      // ✅ 出處：字典 + 本頁資料去重；輸入框的 datalist 由 mSourceSel 來填
      var sources = uniqueOf(rows.map(function(r){return r.source;})).concat(loadDict(SOURCE_DICT_KEY));
      sources = uniqueOf(sources);
      setOptions($("mSourceSel"), sources, true, { includeBlank:true });
    }

    // when trade filter changes, system filter must be recomputed (修訂2), system filter must be recomputed (修訂2)
    function onTradeFilterChanged(){
      var ft = norm($("fTrade").value);
      var fsOld = norm($("fSys").value);

      // ✅ 系統下拉需跟著「工種 + 目前搜尋」同步（不含系統本身）
      var sysList;
      if(ft){
        var baseRows = getBaseRowsForSysFilter();
        sysList = uniqueOf(baseRows.map(function(r){ return r.sys; }));
        if(!sysList.length){
          sysList = collectSysForTrade(ft, state.db);
        }
      }else{
        var q = norm($("qText").value).toLowerCase();
        var rows = state.db.map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; });
        if(q){
          rows = rows.filter(function(r){ return (r.text||"").toLowerCase().includes(q); });
        }
        sysList = uniqueOf(rows.map(function(r){return r.sys;}));
        if(!sysList.length){
          sysList = uniqueOf(state.db.map(normalizeRow).filter(Boolean).filter(function(r){return !r.deleted;}).map(function(r){return r.sys;})).concat(loadDict(SYS_DICT_KEY));
          sysList = uniqueOf(sysList);
        }
      }

      setOptions($("fSys"), sysList, false, { includeAll:true, forceValue:"" });
      if(fsOld && sysList.includes(fsOld)) $("fSys").value = fsOld;
      refresh();
    }

    // modal trade changed => update modal system options (修訂2)
    function onModalTradeChanged(){
      var t = norm($("mTradeSel").value);
      var curSys = norm($("mSysSel").value);
      var list = t ? collectSysForTrade(t, state.db) : uniqueOf(loadDict(SYS_DICT_KEY));
      setOptions($("mSysSel"), list, false, { includeBlank:true });
      if(curSys && list.includes(curSys)) $("mSysSel").value = curSys;
    }

    // ---------------------------
    // Render: table + cards
    // ---------------------------
    function attachCell(attach){
      attach = norm(attach);
      if(!attach) return document.createTextNode("—");
      var a = document.createElement("a");
      a.href = addV(attach);
      a.target="_blank";
      a.rel="noopener";
      a.textContent = "開啟";
      a.style.fontWeight="900";
      a.style.color="rgba(120,64,6,.96)";
      return a;
    }

    function mkBtn(text, onClick){
      var b = document.createElement("button");
      b.className="attBtn";
      b.type="button";
      var span = document.createElement("span");
      span.className="t";
      span.textContent = text;
      b.appendChild(span);
      b.addEventListener("click", onClick);
      return b;
    }

    function renderTable(rows){
      var tb = $("tbody");
      tb.innerHTML = "";
      if(!rows || !rows.length){
        var tr0 = document.createElement("tr");
        var td0 = document.createElement("td");
        td0.colSpan = 9;
        td0.style.textAlign = "center";
        td0.style.padding = "24px 12px";
        td0.style.color = "rgba(90,60,20,.72)";
        td0.style.fontWeight = "800";
        td0.textContent = "目前沒有可顯示資料；系統會自動嘗試雲端同步。";
        tr0.appendChild(td0);
        tb.appendChild(tr0);
        return;
      }
      for(var i=0;i<rows.length;i++){
        var r = rows[i];
        var tr = document.createElement("tr");
        if(r.uid===state.selectedUid) tr.classList.add("sel");

        var tdNo = document.createElement("td");
        tdNo.style.textAlign="center";
        tdNo.textContent = String(i+1); // 修訂3：依顯示列排序顯示項次
        tr.appendChild(tdNo);

        var tdText = document.createElement("td");
        tdText.textContent = r.text || "";
        tr.appendChild(tdText);

        var tdTrade = document.createElement("td");
        tdTrade.style.textAlign="center";
        tdTrade.textContent = r.trade || "";
        tr.appendChild(tdTrade);

        var tdSys = document.createElement("td");
        tdSys.style.textAlign="center";
        tdSys.textContent = r.sys || "";
        tr.appendChild(tdSys);

        var tdSrc = document.createElement("td");
        tdSrc.style.textAlign="center";
        tdSrc.textContent = r.source || "";
        tr.appendChild(tdSrc);

        var tdAtt = document.createElement("td");
        tdAtt.style.textAlign="center";
        tdAtt.appendChild(attachCell(r.attach));
        tr.appendChild(tdAtt);

        var tdRem = document.createElement("td");
        tdRem.textContent = r.remark || "";
        tr.appendChild(tdRem);

        var tdDate = document.createElement("td");
        tdDate.style.textAlign="center";
        tdDate.textContent = r.date || "";
        tr.appendChild(tdDate);

        var tdAct = document.createElement("td");
        tdAct.style.textAlign="center";
        tdAct.appendChild(mkBtn("選取", (function(uid){ return function(e){
          e.stopPropagation();
          selectRow(uid);
        };})(r.uid)));
        tr.appendChild(tdAct);

        tr.addEventListener("click", (function(uid){ return function(){
          selectRow(uid);
        };})(r.uid));

        tb.appendChild(tr);
      }
    }

    function renderCards(rows){
      var box = $("cards");
      box.innerHTML = "";
      if(!rows || !rows.length){
        var empty = document.createElement("div");
        empty.className = "noteCard";
        empty.innerHTML = '<div class="noteBody" style="text-align:center;">目前沒有可顯示資料；系統會自動嘗試雲端同步。</div>';
        box.appendChild(empty);
        return;
      }
      for(var i=0;i<rows.length;i++){
        var r = rows[i];
        var card = document.createElement("div");
        card.className = "noteCard" + (r.uid===state.selectedUid ? " sel": "");
        card.dataset.uid = r.uid;

        var head = document.createElement("div");
        head.className = "noteHead";
        var meta = document.createElement("div");
        meta.className = "noteMeta";

        function tag(txt){
          var s=document.createElement("span");
          s.className="noteTag";
          s.textContent=txt;
          return s;
        }
        meta.appendChild(tag("項次 " + (i+1)));
        if(r.trade) meta.appendChild(tag(r.trade));
        if(r.sys) meta.appendChild(tag(r.sys));
        if(r.source) meta.appendChild(tag(r.source));
        if(r.date) meta.appendChild(tag(r.date));

        head.appendChild(meta);

        var btn = mkBtn("選取", (function(uid){ return function(e){ e.stopPropagation(); selectRow(uid); };})(r.uid));
        head.appendChild(btn);

        var body = document.createElement("div");
        body.className="noteBody";
        body.textContent = r.text || "";

        var more = document.createElement("div");
        more.className="noteMore miniHint";
        more.textContent = "點一下展開/收合內容";

        card.appendChild(head);
        card.appendChild(body);
        card.appendChild(more);

        card.addEventListener("click", function(){
          var uid = this.dataset.uid;
          selectRow(uid);
          this.classList.toggle("open");
        });

        box.appendChild(card);
      }
    }

    function refresh(){
      rebuildFilterOptions();
      var rows = getVisibleRows();

      renderTable(rows);
      renderCards(rows);

      // hint
      var cloudTxt = state.cloud.ok ? "已同步" : (state.cloud.cfgOk ? "待同步" : "未設定");
      var lastTxt = state.cloud.lastOkAt ? fmtClock(state.cloud.lastOkAt) : "—";
      var roleTxt = state.role==="admin" ? "admin" : (state.role==="write"?"可編輯":"唯讀");

      $("hint").innerHTML = "";
      function hb(k,v,bad){
        var s=document.createElement("span");
        s.className="hb"+(bad?" bad":"");
        s.innerHTML = '<span class="k">'+escHtml(k)+'</span><span class="v">'+escHtml(v)+'</span>';
        return s;
      }
      $("hint").appendChild(hb("版本", APP_VER));
      $("hint").appendChild(hb("筆數", String(rows.length) + " / " + String(state.db.map(normalizeRow).filter(Boolean).filter(function(r){return !r.deleted;}).length)));
      $("hint").appendChild(hb("選取", state.selectedUid ? "已選取" : "未選取", !state.selectedUid));
      $("hint").appendChild(hb("雲端", cloudTxt, !state.cloud.ok));
      $("hint").appendChild(hb("最後", lastTxt));
      }

    function selectRow(uid){
      uid = norm(uid);
      state.selectedUid = uid;
      refresh();
    }

    // ---------------------------
    // Modal logic
    // ---------------------------
    function openMask(mode){
      state.mode = mode;
      // (v12) prevent background scroll while modal is open
      if(state._prevBodyOverflow===undefined){ state._prevBodyOverflow = document.body.style.overflow || ""; }
      document.body.style.overflow = "hidden";
      $("mask").style.display = "flex";
      $("mTitle").textContent = (mode==="add") ? "新增" : (mode==="edit" ? "編輯" : "查看");
      var canEdit = (state.role==="admin" || state.role==="write") && (mode!=="view");
      $("btnSave").style.display = canEdit ? "" : "none";
      $("btnDelete").style.display = (canEdit && mode!=="add") ? "" : "none";
      // lock inputs in view mode
      var ro = (mode==="view");
      ["mText","mAttach","mRemark","mDate"].forEach(function(id){ $(id).disabled = ro; });
      ["mTradeSel","mSysSel","mSourceSel"].forEach(function(id){ $(id).disabled = ro; });
      ["btnAddTrade","btnAddSys","btnAddSource","btnNetDisk"].forEach(function(id){ $(id).disabled = ro; });
    }

    function closeMask(){
      $("mask").style.display = "none";
      // (v12) restore page scroll
      try{ document.body.style.overflow = (state._prevBodyOverflow===undefined) ? "" : state._prevBodyOverflow; }catch(e){}
    }

    function fillModal(row){
      row = row || {};
      $("mText").value = norm(row.text);
      $("mTradeSel").value = norm(row.trade);
      onModalTradeChanged();
      $("mSysSel").value = norm(row.sys);
      $("mSourceSel").value = norm(row.source);
      $("mAttach").value = norm(row.attach);
      $("mRemark").value = norm(row.remark);
      $("mDate").value = norm(row.date) || todayISO();
      $("mNo").value = row.uid ? String(displayNoOf(row.uid) || "") : "";
    }

    function currentRowByUid(uid){
      uid = norm(uid);
      if(!uid) return null;
      for(var i=0;i<state.db.length;i++){
        var r = ensureRowV1(state.db[i]);
        if(r && r.uid===uid) return r;
      }
      return null;
    }

    function openView(){
      if(!state.selectedUid){ toast("請先選取一筆"); return; }
      var r = currentRowByUid(state.selectedUid);
      if(!r){ toast("找不到資料"); return; }
      fillModal(r);
      openMask("view");
    }

    function openEdit(){
      if(!state.selectedUid){ toast("請先選取一筆"); return; }
      if(!(state.role==="admin" || state.role==="write")){ toast("目前權限不可編輯"); return; }
      var r = currentRowByUid(state.selectedUid);
      if(!r){ toast("找不到資料"); return; }
      fillModal(r);
      openMask("edit");
    }

    function openAdd(){
      if(!(state.role==="admin" || state.role==="write")){ toast("目前權限不可新增"); return; }
      state.selectedUid = "";
      fillModal({ date: todayISO() });
      openMask("add");
    }

    function modalToRow(existingUid){
      var uid = existingUid ? norm(existingUid) : uuid();
      // ✅ _touch：標記本次「表單有改動/有填寫」的欄位，讓 mergeTwo 判斷「刻意清空」也要生效
      var touch = { text:1, trade:1, sys:1, source:1, attach:1, remark:1, date:1 };
      var r = {
        uid: uid,
        id: 0, // display only
        text: norm($("mText").value),
        trade: norm($("mTradeSel").value),
        sys: norm($("mSysSel").value),
        source: norm($("mSourceSel").value),
        attach: norm($("mAttach").value),
        remark: norm($("mRemark").value),
        date: norm($("mDate").value) || todayISO(),
        updatedAt: Date.now(),
        rev: Date.now(),
        deleted: false,
        _touch: touch
      };
      return ensureRowV1(r);
    }

    function upsertRow(row){
      var found = false;
      for(var i=0;i<state.db.length;i++){
        var r = ensureRowV1(state.db[i]);
        if(r && r.uid===row.uid){
          state.db[i] = mergeTwo(r, row);
          found = true;
          break;
        }
      }
      if(!found) state.db.push(row);
      markDirty(row.uid);
      saveLocal({ db: state.db, counter: state.counter });
      buildDictsFromDb();
      refresh();
    }

    function deleteRow(uid){
      uid = norm(uid);
      if(!uid) return;
      for(var i=0;i<state.db.length;i++){
        var r = ensureRowV1(state.db[i]);
        if(r && r.uid===uid){
          r.deleted = true;
          r.updatedAt = Date.now();
          r.rev = Date.now();
          state.db[i] = r;
          break;
        }
      }
      markDirty(uid);
      saveLocal({ db: state.db, counter: state.counter });
      refresh();
    }

    // ---------------------------
    // Prompt modal (add trade/sys/source)
    // ---------------------------
    var promptMode = "";

function setPromptListOptions(arr){
  var dl = $("pList");
  if(!dl) return;
  dl.innerHTML = "";
  (arr||[]).forEach(function(v){
    v = norm(v);
    if(!v) return;
    var op = document.createElement("option");
    op.value = v;
    dl.appendChild(op);
  });
}

function getPromptOptions(mode){
  var rows = state.db.map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; });
  if(mode==="trade"){
    return uniqueOf(rows.map(function(r){return r.trade;})).concat(loadDict(TRADE_DICT_KEY)).filter(Boolean);
  }
  if(mode==="sys"){
    var t = norm($("mTradeSel").value);
    if(t) return collectSysForTrade(t, state.db);
    return uniqueOf(rows.map(function(r){return r.sys;})).concat(loadDict(SYS_DICT_KEY)).filter(Boolean);
  }
  if(mode==="source"){
    return uniqueOf(rows.map(function(r){return r.source;})).concat(loadDict(SOURCE_DICT_KEY)).filter(Boolean);
  }
  return [];
}

 // "trade" | "sys" | "source"
    function openPrompt(mode){
      promptMode = mode;
      $("pMask").style.display="flex";
      $("pInput").value="";
      if(mode==="trade"){
        $("pTitle").textContent="新增工種";
        $("pLabel").textContent="請輸入工種";
        $("pHint").textContent="新增後會加入「工種字典」。";
      }else if(mode==="sys"){
        $("pTitle").textContent="新增系統";
        $("pLabel").textContent="請輸入系統";
        $("pHint").textContent="新增後會加入「系統字典」，並綁定到目前工種。";
      }else{
        $("pTitle").textContent="新增出處";
        $("pLabel").textContent="請輸入出處";
        $("pHint").textContent="新增後會加入「出處字典」。";
      }
      // ✅ 讓「新增」視窗也能用下拉建議（不改 UI；用 datalist）
      setPromptListOptions(uniqueOf(getPromptOptions(mode)));
      setTimeout(function(){ $("pInput").focus(); }, 50);
    }
    function closePrompt(){ $("pMask").style.display="none"; promptMode=""; }

    function commitPrompt(){
      var val = norm($("pInput").value);
      if(!val){ toast("請輸入內容"); return; }

      if(promptMode==="trade"){
        var trades = uniqueOf(loadDict(TRADE_DICT_KEY).concat([val]));
        saveDict(TRADE_DICT_KEY, trades);
        rebuildFilterOptions();
        $("mTradeSel").value = val;
        onModalTradeChanged();
        toast("已新增工種");
      }else if(promptMode==="sys"){
        var syss = uniqueOf(loadDict(SYS_DICT_KEY).concat([val]));
        saveDict(SYS_DICT_KEY, syss);

        var t = norm($("mTradeSel").value);
        if(t){
          TRADE_SYS_MAP[t] = TRADE_SYS_MAP[t] || [];
          if(!TRADE_SYS_MAP[t].includes(val)) TRADE_SYS_MAP[t].push(val);
          saveMap(TRADE_SYS_MAP);
        }
        rebuildFilterOptions();
        $("mSysSel").value = val;
        toast("已新增系統並綁定");
      }else if(promptMode==="source"){
        var srcs = uniqueOf(loadDict(SOURCE_DICT_KEY).concat([val]));
        saveDict(SOURCE_DICT_KEY, srcs);
        rebuildFilterOptions();
        $("mSourceSel").value = val;
        toast("已新增出處");
      }
      closePrompt();
    }

    // ---------------------------
    // Cloud API
    // ---------------------------
      // --- Cloud API (Worker pull/merge compatible) ---
      // Worker supports:
      //   GET  /api/tasun/pull?key=PAGE_KEY   (or GET /api/read?key=PAGE_KEY)
      //   POST /api/tasun/merge              (or POST /api/merge) body: { key, payload:{db,counter}, client:{user,...} }
      // Response payload shape: { ok:true, payload:{db,counter}, ... }

      function _joinUrl(base, path){
        base = (base || "").replace(/\/+$/,"");
        path = (path || "").trim();
        if(!path) return base;
        if(path.startsWith("http://") || path.startsWith("https://")) return path;
        if(!path.startsWith("/")) path = "/" + path;
        return base + path;
      }

      async function cloudHealth(cfg){
        try{
          cfg = cfg || await loadCloudCfg();
          const apiBase = (cfg && cfg.apiBase) ? String(cfg.apiBase) : "";
          const eps = (cfg && cfg.endpoints) ? cfg.endpoints : {};

          try{
            state.cloud.apiBase = apiBase || "";
            state.cloud.endpoints = eps || null;
            state.cloud.cfgOk = !!(cfg && isValidApiBase(apiBase));
          }catch(e){}

          const candidates = [];
          if(eps && eps.health) candidates.push(_joinUrl(apiBase, eps.health));
          // common fallbacks
          candidates.push(_joinUrl(apiBase, "/api/ping"));
          candidates.push(_joinUrl(apiBase, "/api/tasun/ping"));
          candidates.push(_joinUrl(apiBase, "/api/ping"));

          for(const url of candidates){
            try{
              const r = await fetch(url, { method:"GET", credentials: (cfg && cfg.credentials) ? "include" : "omit", cache:"no-store" });
              if(r.ok){
                try{
                  state.cloud.ok = true;
                  state.cloud.lastOkAt = Date.now();
                  state.cloud.lastSyncAt = Date.now();
                  refresh();
                }catch(e){}
                return true;
              }
            }catch(_e){}
          }
          try{
            state.cloud.ok = false;
            refresh();
          }catch(e){}
          return false;
        }catch(_e){
          try{
            state.cloud.ok = false;
            state.cloud.cfgOk = false;
            refresh();
          }catch(e){}
          return false;
        }
      }

      function buildCloudEnvelope(pageKey, payload){
        // Backward compatible wrapper; cloudMerge/cloudRead no longer require this shape,
        // but keep it to avoid touching other code paths.
        return { key: pageKey, payload: payload || { db:[], counter:0 } };
      }

      function _normalizePullResponse(json){
        // Accept {ok,payload:{db}} / {data:{rows}} / raw {items} / Worker variants.
        const j = (json && typeof json==="object") ? json : {};
        const payload = (j.payload && typeof j.payload==="object") ? j.payload : (j.data && typeof j.data==="object") ? j.data : j;
        const db = normalizeCloudDbPayload(payload);
        const counter = Number.isFinite(Number((payload && payload.counter) || j.counter)) ? Number((payload && payload.counter) || j.counter) : (Array.isArray(db) ? db.length : 0);
        return { db, counter };
      }

      async function cloudRead(cfg, pageKey){
        cfg = cfg || await loadCloudCfg();
        const apiBase = (cfg && cfg.apiBase) ? String(cfg.apiBase) : "";
        const eps = (cfg && cfg.endpoints) ? cfg.endpoints : {};
        const token = getCloudToken();
        if(!token) throw new Error("UNAUTH:NO_TOKEN");

        const readPaths = [];
        function pushPath(p){
          p = norm(p);
          if(!p) return;
          if(readPaths.indexOf(p) < 0) readPaths.push(p);
        }
        pushPath((eps && eps.read) ? String(eps.read) : "/api/tasun/read");
        pushPath("/api/tasun/read");

        var lastErr = null;
        for(var i=0;i<readPaths.length;i++){
          const readPath = readPaths[i];
          const url = _joinUrl(apiBase, readPath);
          try{
            const r = await fetch(url, {
              method: "POST",
              cache: "no-store",
              credentials: (cfg && cfg.credentials) ? "include" : "omit",
              headers: {
                "content-type":"application/json",
                "accept":"application/json",
                "Authorization":"Bearer " + token
              },
              body: JSON.stringify({ resourceKey: pageKey })
            });
            if(r.status===401){
              lastErr = new Error("UNAUTH");
              continue;
            }
            if(!r.ok){
              const t = await r.text().catch(()=> "");
              lastErr = new Error("cloud read failed: " + r.status + " " + t.slice(0,200));
              continue;
            }
            const j = await r.json();
            const db = Array.isArray(j.rows) ? j.rows : normalizeCloudDbPayload(j);
            return { db: Array.isArray(db) ? db : [], counter: Array.isArray(db) ? db.length : 0 };
          }catch(err){
            lastErr = err;
          }
        }
        throw (lastErr || new Error("cloud read failed"));
      }

            async function cloudMerge(cfg, pageKey, payloadLike, clientInfo){
        cfg = cfg || await loadCloudCfg();
        const apiBase = (cfg && cfg.apiBase) ? String(cfg.apiBase) : "";
        const eps = (cfg && cfg.endpoints) ? cfg.endpoints : {};
        const token = getCloudToken();
        if(!token) throw new Error("UNAUTH:NO_TOKEN");

        let payload = payloadLike;
        if(payload && typeof payload === "object"){
          if(payload.payload && typeof payload.payload==="object") payload = payload.payload;
          if(payload.data && typeof payload.data==="object") payload = payload.data;
        }
        payload = payload || { db:[], counter:0 };

        const body = {
          resourceKey: pageKey,
          payload: { db: Array.isArray(payload.db)? payload.db.map(ensureRowV1).filter(Boolean) : [], counter: Number(payload.counter)||0 },
          client: clientInfo && typeof clientInfo==="object" ? clientInfo : {}
        };

        const mergePaths = [];
        function pushPath(p){
          p = norm(p);
          if(!p) return;
          if(mergePaths.indexOf(p) < 0) mergePaths.push(p);
        }
        pushPath((eps && eps.merge) ? String(eps.merge) : "/api/tasun/merge");
        pushPath("/api/tasun/merge");

        var lastErr = null;
        for(var i=0;i<mergePaths.length;i++){
          const url = _joinUrl(apiBase, mergePaths[i]);
          try{
            const r = await fetch(url, {
              method: "POST",
              cache: "no-store",
              credentials: (cfg && cfg.credentials) ? "include" : "omit",
              headers: {
                "content-type":"application/json",
                "accept":"application/json",
                "Authorization":"Bearer " + token
              },
              body: JSON.stringify(body)
            });
            if(r.status===401){
              lastErr = new Error("UNAUTH");
              continue;
            }
            if(!r.ok){
              const t = await r.text().catch(()=> "");
              lastErr = new Error("cloud merge failed: " + r.status + " " + t.slice(0,200));
              continue;
            }
            const j = await r.json();
            if(Array.isArray(j.rows)) return { db:j.rows, counter:j.rows.length };
            if(Array.isArray(j.db)) return { db:j.db, counter:Number(j.counter)||j.db.length };
            return { db:[], counter:Number(payload.counter)||0, raw:j };
          }catch(err){
            lastErr = err;
          }
        }
        throw (lastErr || new Error("cloud merge failed"));
      }

    async function syncFromCloud(opts){
      opts = (opts && typeof opts==="object") ? opts : {};
      var silent = !!opts.silent;
      var aggressive = !!opts.aggressive;

      var cfg = await loadCloudCfg();
      if(!cfg || !isValidApiBase(cfg.apiBase)){
        if(!silent) toast("雲端未設定/無效"); 
        return false;
      }
      if(!hasUsableCloudToken()){
        if(!silent) handleCloudUnauth("雲端授權不足，請重新登入");
        return false;
      }

      try{
        var remote = await cloudRead(cfg, PAGE_KEY);
        var remoteDb = normalizeCloudDbPayload(remote);
        var localDb = (state.db || []).map(ensureRowV1).filter(Boolean);
        var bootKey = "tasunCloudBooted_" + PAGE_KEY;
        var autoFillKey = "tasunCloudAutoFill_" + PAGE_KEY;

        function _uid(x){
          if(!x) return "";
          return String(x.uid || x.pk || x.Uid || x.ID || x.id || "");
        }

        if(remoteDb && remoteDb.length){
          saveSnapshot(remoteDb, { source:"cloud-read", counter: remote.counter||remoteDb.length });
        }

        var rSet = new Set((remoteDb||[]).map(_uid).filter(Boolean));
        var missing = localDb.filter(function(it){
          var u = _uid(it);
          return u && !rSet.has(u);
        });

        var remoteEmpty = (!remoteDb || remoteDb.length === 0);
        var localHas = (localDb.length > 0);

        // 桌機/新裝置若雲端有資料，直接以下拉為主；若雲端空白但本機有資料，才回填雲端
        if(localHas && (remoteEmpty || missing.length > 0) && !sessionStorage.getItem(autoFillKey)){
          sessionStorage.setItem(autoFillKey, "1");
          try{
            var reason = remoteEmpty ? "auto-bootstrap-cloud-empty" : "auto-fill-cloud-missing";
            var merged = await cloudMerge(cfg, PAGE_KEY, { db: localDb, counter: state.counter }, {
              user: state.user || "",
              role: state.role || "",
              appVer: APP_VER,
              clientId: state.clientId || getClientId(),
              at: nowISO(),
              reason: reason
            });
            var mergedDb = normalizeCloudDbPayload(merged);
            if(mergedDb && mergedDb.length){
              remote = merged;
              remoteDb = mergedDb;
              saveSnapshot(remoteDb, { source:reason, counter: merged.counter||remoteDb.length });
              if(remoteEmpty) localStorage.setItem(bootKey, "1");
              if(!silent){
                toast(remoteEmpty
                  ? ("雲端空白，已自動倒入本機資料：" + localDb.length + " 筆")
                  : ("已自動補齊雲端缺少資料：" + missing.length + " 筆"));
              }
            }
          }catch(e){
            if(!silent) toast("雲端自動補齊失敗：" + (e && (e.message||e) ? (e.message||e) : e));
          }
        }

        // 若雲端仍空，但本機有 snapshot，至少先用 snapshot 恢復桌機畫面，避免桌機/手機不同步觀感
        if((!remoteDb || !remoteDb.length) && aggressive){
          var snap = loadSnapshotRows();
          if(snap && snap.length){
            remote = { db: snap, counter: snap.length };
            remoteDb = snap;
          }
        }

        var out = mergePayload({ db: remoteDb || [], counter: remote.counter || (remoteDb ? remoteDb.length : 0) }, { db: state.db, counter: state.counter });
        state.db = out.db;
        state.counter = out.counter;

        state.lastSyncAt = Date.now();
        try{
          state.cloud.cfgOk = true;
          state.cloud.ok = true;
          state.cloud.lastOkAt = Date.now();
          state.cloud.lastSyncAt = Date.now();
        }catch(e){}
        await idbClearOps(PAGE_KEY);
        await saveLocal({ db: state.db, counter: state.counter });
        saveSnapshot(state.db, { source:"merged-local-cloud", counter: state.counter });

        buildDictsFromDb();
        refresh();
        if(!silent) toast("已從雲端更新");
        return true;
      }catch(e){
        try{ state.cloud.ok = false; }catch(_e){}
        if(/UNAUTH|401|NO_TOKEN/i.test(String((e&&e.message)||e||""))){
          if(!silent) handleCloudUnauth("雲端授權已失效，請重新登入");
          return false;
        }

        // 回退：嘗試 snapshot，避免桌機空白但手機有資料
        try{
          var snap2 = loadSnapshotRows();
          if(snap2 && snap2.length){
            var out2 = mergePayload({ db: snap2, counter: snap2.length }, { db: state.db, counter: state.counter });
            state.db = out2.db;
            state.counter = out2.counter;
            await saveLocal({ db: state.db, counter: state.counter });
            buildDictsFromDb();
            refresh();
            if(!silent) toast("雲端暫時不可用，已先載入本機快照資料");
            return true;
          }
        }catch(_snapErr){}

        if(!silent) toast("雲端讀取失敗：" + (e && e.message ? e.message : String(e)));
        try{ refresh(); }catch(_e){}
        return false;
      }
    }

    async function syncToCloud(opts){
      opts = (opts && typeof opts==="object") ? opts : {};
      var silent = !!opts.silent;
      var reason = opts.reason || "";
      var fullUpload = !!opts.fullUpload;

      var cfg = await loadCloudCfg();
      if(!cfg || !isValidApiBase(cfg.apiBase)){
        if(!silent) toast("雲端未設定/無效"); 
        return;
      }
      if(!hasUsableCloudToken()){
        if(!silent) handleCloudUnauth("雲端授權不足，請重新登入");
        return;
      }

      var meta = null;
      try{ meta = await idbGetMeta(PAGE_KEY); }catch(e){ meta=null; }
      var lastSyncAt = Number(state.lastSyncAt || (meta && meta.lastSyncAt) || 0) || 0;

      var sendRows = [];
      if(fullUpload){
        sendRows = (state.db||[]).map(ensureRowV1).filter(Boolean);
      }else{
        var dirtyUids = [];
        try{ dirtyUids = await idbGetDirtyUids(PAGE_KEY, lastSyncAt); }catch(e){ dirtyUids = []; }

        if(!dirtyUids.length){
          if(!silent) toast("沒有需要上傳的本機變更");
          return;
        }

        var dirtySet = new Set(dirtyUids.map(norm));
        sendRows = (state.db||[])
          .map(ensureRowV1)
          .filter(Boolean)
          .filter(function(r){ return dirtySet.has(norm(r.uid)); });
      }

      try{
        var merged = await cloudMerge(cfg, PAGE_KEY, { db: sendRows, counter: state.counter }, {
          user: state.user || "",
          role: state.role || "",
          appVer: APP_VER,
          clientId: state.clientId || getClientId(),
          at: nowISO(),
          reason: reason || (fullUpload ? "fullUpload" : "incremental")
        });

        var out = mergePayload(merged, { db: state.db, counter: state.counter });
        state.db = out.db;
        state.counter = out.counter;

        state.lastSyncAt = Date.now();
        try{
          state.cloud.cfgOk = true;
          state.cloud.ok = true;
          state.cloud.lastOkAt = Date.now();
          state.cloud.lastSyncAt = Date.now();
        }catch(e){}
        await idbClearOps(PAGE_KEY);
        await saveLocal({ db: state.db, counter: state.counter });
        saveSnapshot(state.db, { source:"cloud-merge", counter: state.counter });

        buildDictsFromDb();
        refresh();
        if(!silent) toast(fullUpload ? "雲端同步完成（全量）" : "雲端同步完成（增量）");
      }catch(e){
        try{ state.cloud.ok = false; }catch(_e){}
        if(/UNAUTH|401|NO_TOKEN/i.test(String((e&&e.message)||e||""))){
          if(!silent) handleCloudUnauth("雲端授權已失效，請重新登入");
          return;
        }
        if(!silent) toast("雲端同步失敗：" + (e && e.message ? e.message : String(e)));
        try{ refresh(); }catch(_e){}
      }
    }

    // ---------------------------
    // Export / Import helpers (backup)
    // ---------------------------
    function downloadText(filename, text){
      var blob = new Blob([text], {type:"application/json;charset=utf-8"});
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 0);
    }

    function exportBackup(){
      var pack = {
        meta: { app:"Tasun sxdh-notes", ver: APP_VER, exportedAt: nowISO(), pageKey: PAGE_KEY },
        db: state.db.map(ensureRowV1).filter(Boolean),
        counter: state.counter,
        dicts: {
          trades: loadDict(TRADE_DICT_KEY),
          syss: loadDict(SYS_DICT_KEY),
          sources: loadDict(SOURCE_DICT_KEY),
          tradeSysMap: loadMap()
        }
      };
      downloadText("捷運汐東線事項記錄_backup_"+APP_VER+".json", JSON.stringify(pack, null, 2));
      toast("已匯出備份");
    }

    // ---------------------------
    // Read mode
    // ---------------------------
    function applyReadMode(on){
      state.readMode = !!on;
      document.body.classList.toggle("readMode", state.readMode);
      $("btnRead").querySelector(".t").textContent = "閱讀模式：" + (state.readMode ? "開" : "關");
      localStorage.setItem(READ_MODE_KEY, state.readMode ? "1" : "0");
      refresh();
    }

    // ---------------------------
    // Nav / menus
    // ---------------------------
    function navTo(href){
      href = norm(href);
      if(!href) return;
      location.href = addV(href);
    }

    function setupMobileMenu(){
      var btn = $("mMoreBtn");
      var menu = $("mMoreMenu");
      if(!btn || !menu) return;

      btn.addEventListener("click", function(e){
        e.stopPropagation();
        menu.style.display = (menu.style.display==="none" || !menu.style.display) ? "block" : "none";
      });
      document.addEventListener("click", function(){ menu.style.display="none"; });
      menu.querySelectorAll(".menuItem").forEach(function(it){
        it.addEventListener("click", function(){
          navTo(this.dataset.href);
        });
      });
    }

    // ---------------------------
    // Login
    // ---------------------------
    function openLogin(){
      $("loginMask").style.display="flex";
      $("loginErr").style.display="none";
      $("loginPass").value="";
      var auth = ensureAuthTable();
      var sel = $("loginUser");
      sel.innerHTML = '<option value="">請選擇帳號</option>';
      auth.users.forEach(function(u){
        var op = document.createElement("option");
        op.value = u.user;
        op.textContent = (u.name||u.user) + " ("+(u.role||"read")+")";
        sel.appendChild(op);
      });
    }
    function closeLogin(){ $("loginMask").style.display="none"; }

    function applyUser(u){
      state.user = u;
      state.role = u && u.role ? u.role : "read";
      $("uName").textContent = u && (u.name||u.user) ? (u.name||u.user) : "—";
      $("uRole").textContent = state.role || "—";

      var canWrite = (state.role==="admin" || state.role==="write");
      $("btnAdd").style.display = canWrite ? "" : "none";
      $("btnEdit").style.display = canWrite ? "" : "none";
      $("btnToken").style.display = (state.role==="admin") ? "" : "none";
      refresh();
    }

    async function doLogin(){
      var user = norm($("loginUser").value);
      var pass = norm($("loginPass").value);
      if(!user || !pass){
        $("loginErr").style.display="block";
        $("loginErr").textContent="請選擇帳號並輸入密碼";
        return;
      }
      var auth = ensureAuthTable();
      var hit = auth.users.find(function(u){ return u.user===user && u.pass===pass; });
      if(!hit){
        $("loginErr").style.display="block";
        $("loginErr").textContent="帳號或密碼錯誤";
        return;
      }

      try{
        var cfg = await loadCloudCfg();
        var loginUrl = _joinUrl(String(cfg.apiBase||""), "/api/tasun/login");
        var lr = await fetch(loginUrl, {
          method:"POST",
          cache:"no-store",
          headers:{ "content-type":"application/json", "accept":"application/json" },
          body: JSON.stringify({ username:user, password:pass })
        });
        var lj = await lr.json().catch(function(){ return {}; });
        if(!lr.ok || !lj || !lj.ok || !lj.token){
          $("loginErr").style.display="block";
          $("loginErr").textContent="雲端登入失敗：" + String((lj && (lj.error||lj.detail)) || lr.status || "UNKNOWN");
          return;
        }
        setCloudToken(lj.token, Number(lj.exp||0)||0);
      }catch(e){
        $("loginErr").style.display="block";
        $("loginErr").textContent="雲端登入失敗：" + String(e && e.message ? e.message : e);
        return;
      }

      var cur = { user: hit.user, role: hit.role||"read", name: hit.name||hit.user, at: nowISO() };
      setCurrentUser(cur);
      applyUser(cur);
      closeLogin();
      toast("登入成功");
      try{ await syncFromCloud({ silent:false, aggressive:true }); }catch(e){}
    }

    // ---------------------------
    // Cloud setting modal
    // ---------------------------
    function openToken(){
      $("tokenMask").style.display="flex";
      $("tokenErr").style.display="none";

      // ✅ 鎖定模式：只顯示，不可修改（外觀不變：仍使用同一個 input + 按鈕）
      $("tokenInput").value = "";
      try{ $("tokenInput").readOnly = !!LOCK_CLOUD_CFG_UI; }catch(e){}
      updateTokenHint(true);
    }
    function closeToken(){ $("tokenMask").style.display="none"; }

    async function updateTokenHint(fillInput){
      var cfg = await loadCloudCfg();
      var txt = (cfg && cfg.apiBase) ? cfg.apiBase : "—";
      $("tokenHint").textContent = "目前狀態：" + txt;

      // 鎖定模式：自動把目前 apiBase 放進輸入框（只讀；可用「顯示/隱藏」看內容）
      if(fillInput && LOCK_CLOUD_CFG_UI){
        try{ $("tokenInput").value = txt || ""; }catch(e){}
      }
    }

    function saveToken(){
      if(LOCK_CLOUD_CFG_UI){ toast("雲端設定已鎖定（只顯示）"); return; }
      var raw = norm($("tokenInput").value);
      if(!raw){
        $("tokenErr").style.display="block";
        $("tokenErr").textContent="請貼上 apiBase 或 JSON";
        return;
      }
      var js = parseJsonLenient(raw);
      if(js && typeof js==="object" && (js.apiBase || js.endpoints)){
        if(js.apiBase){
          if(!isValidApiBase(js.apiBase)){
            $("tokenErr").style.display="block";
            $("tokenErr").textContent="apiBase 格式不正確";
            return;
          }
          localStorage.setItem(API_BASE_LS_KEY, norm(js.apiBase));
        }
        if(js.endpoints){
          localStorage.setItem(API_EP_LS_KEY, JSON.stringify(normalizeEndpoints(js.endpoints)));
        }
      }else{
        if(!isValidApiBase(raw)){
          $("tokenErr").style.display="block";
          $("tokenErr").textContent="apiBase 格式不正確";
          return;
        }
        localStorage.setItem(API_BASE_LS_KEY, raw);
      }
      _cloudCfgCache = null;
      toast("已儲存雲端設定");
      updateTokenHint();
      cloudHealth();
    }

    function clearToken(){
      if(LOCK_CLOUD_CFG_UI){ toast("雲端設定已鎖定（只顯示）"); return; }
      localStorage.removeItem(API_BASE_LS_KEY);
      localStorage.removeItem(API_EP_LS_KEY);
      _cloudCfgCache = null;
      toast("已清除雲端設定");
      updateTokenHint();
      cloudHealth();
    }

    function toggleTokenVis(){
      var inp = $("tokenInput");
      inp.type = (inp.type==="password") ? "text" : "password";
    }

    // ---------------------------
    // Wire events
    // ---------------------------
    function wire(){
      $("navBack").addEventListener("click", function(){ navTo("汐東工程管理表.html"); });
      $("mBack").addEventListener("click", function(){ navTo("汐東工程管理表.html"); });
      setupMobileMenu();

      $("btnView").addEventListener("click", openView);
      $("btnEdit").addEventListener("click", openEdit);
      $("btnAdd").addEventListener("click", openAdd);

      $("btnCloud").addEventListener("click", async function(){
        try{
          await syncFromCloud({ silent:false });
          await syncToCloud({ silent:true, reason:"manual-cloud", fullUpload:false });
        }catch(e){
          try{ scheduleSync("manual-cloud-retry", true); }catch(_e){}
        }
      });
      $("btnExport").addEventListener("click", exportBackup);
      $("btnClear").addEventListener("click", function(){
        $("qText").value="";
        $("fTrade").value="";
        $("fSys").value="";
        refresh();
      });

      $("qText").addEventListener("input", function(){ refresh(); });
      $("fTrade").addEventListener("change", onTradeFilterChanged);
      $("fSys").addEventListener("change", function(){ refresh(); });

      $("btnRead").addEventListener("click", function(){ applyReadMode(!state.readMode); });

      // modal buttons
      $("btnClose").addEventListener("click", closeMask);
      $("btnCancel").addEventListener("click", closeMask);

      $("mTradeSel").addEventListener("change", onModalTradeChanged);

      $("btnAddTrade").addEventListener("click", function(){ openPrompt("trade"); });
      $("btnAddSys").addEventListener("click", function(){ openPrompt("sys"); });
      $("btnAddSource").addEventListener("click", function(){ openPrompt("source"); });

      $("btnNetDisk").addEventListener("click", async function(){
  // ✅ 行為修正：附件欄位為空時，「網路硬碟」仍可打開預設網路硬碟（不影響 UI）
  var v = norm($("mAttach").value);
  if(v){
    window.open(addV(v), "_blank", "noopener");
    return;
  }
  try{
    var cfg = await loadCloudCfg();
    var url = (cfg && cfg.netDiskUrl) ? String(cfg.netDiskUrl) : "https://www.dropbox.com/home/%E6%8D%B7%E9%81%8B%E6%B1%90%E6%AD%A2%E6%9D%B1%E6%B9%96%E7%B7%9A%E7%9B%A3%E9%80%A0%E5%B0%88%E6%A1%88";
    window.open(addV(url), "_blank", "noopener");
  }catch(e){
    window.open("https://www.dropbox.com/home/%E6%8D%B7%E9%81%8B%E6%B1%90%E6%AD%A2%E6%9D%B1%E6%B9%96%E7%B7%9A%E7%9B%A3%E9%80%A0%E5%B0%88%E6%A1%88", "_blank", "noopener");
  }
});

$("btnSave").addEventListener("click", async function(){
        if(state.mode==="view"){ closeMask(); return; }
        var existing = (state.mode==="edit") ? state.selectedUid : "";
        var row = modalToRow(existing);
        if(!row.text){ toast("請輸入記事內容"); return; }
        if(!row.trade){ toast("請選擇工種"); return; }
        // record trade-sys binding if both set
        if(row.trade && row.sys){
          TRADE_SYS_MAP[row.trade] = TRADE_SYS_MAP[row.trade] || [];
          if(!TRADE_SYS_MAP[row.trade].includes(row.sys)) TRADE_SYS_MAP[row.trade].push(row.sys);
          saveMap(TRADE_SYS_MAP);
        }
        upsertRow(row);
        state.selectedUid = row.uid;
        closeMask();
        // ✅ 自動同步：不阻塞 UI（離線會自動重試）
        scheduleSync("save", true);
      });

      $("btnDelete").addEventListener("click", async function(){
        if(!(state.role==="admin" || state.role==="write")){ toast("目前權限不可刪除"); return; }
        if(!state.selectedUid){ toast("請先選取一筆"); return; }
        if(!confirm("確定刪除？（可在雲端同步後仍保留刪除狀態）")) return;
        deleteRow(state.selectedUid);
        closeMask();
        // ✅ 自動同步：不阻塞 UI（離線會自動重試）
        scheduleSync("delete", true);
      });

      // prompt
      $("pClose").addEventListener("click", closePrompt);
      $("pCancel").addEventListener("click", closePrompt);
      $("pOk").addEventListener("click", commitPrompt);
      $("pInput").addEventListener("keydown", function(e){
        if(e.key==="Enter"){ e.preventDefault(); commitPrompt(); }
      });

      // token modal
      $("btnToken").addEventListener("click", openToken);
      $("tokenClose").addEventListener("click", closeToken);
      $("tokenSave").addEventListener("click", saveToken);
      $("tokenClear").addEventListener("click", clearToken);
      $("tokenToggle").addEventListener("click", toggleTokenVis);

      // login modal
      $("loginClose").addEventListener("click", closeLogin);
      $("loginBtn").addEventListener("click", doLogin);
      $("loginPass").addEventListener("keydown", function(e){ if(e.key==="Enter") doLogin(); });
      $("loginToAuth").addEventListener("click", function(){ navTo("權限表.html"); });
      // ---------------------------
      // ✅ Auto sync triggers
      // ---------------------------
      window.addEventListener("online", function(){ scheduleSync("online", true); });
      window.addEventListener("focus", function(){ scheduleSync("focus"); });
      document.addEventListener("visibilitychange", function(){
        if(!document.hidden) scheduleSync("visible");
      });
      // 週期保底同步（避免長時間開著頁面但沒互動）
      setInterval(function(){ scheduleSync("periodic"); }, SYNC_PERIODIC_MS);

    }

    // ---------------------------
    // Boot
    // ---------------------------
        async function boot(){
      // ✅ 目的：無論雲端/IndexedDB 是否異常，都要先畫出版本/筆數/選取/雲端/最後。
      // ✅ 強化：桌機首進頁面若本機空白，會主動雲端下拉 + 快照回復 + 延遲重試，避免手機有資料、桌機沒資料。
      var cur = null;
      try{
        try{ await openIDB(); }catch(e){}

        try{
          var p = await loadDb();
          state.db = p.db;
          state.counter = p.counter;
        }catch(e){
          state.db = Array.isArray(state.db) ? state.db : [];
          state.counter = Number(state.counter||0)||0;
        }

        try{ state.clientId = state.clientId || getClientId(); }catch(e){}

        try{ recoverLegacyLocal(); }catch(e){}
        try{ migrateEnsureUidInPlace(); }catch(e){}

        try{
          state.readMode = localStorage.getItem(READ_MODE_KEY)==="1";
          applyReadMode(state.readMode);
        }catch(e){ state.readMode = false; }

        try{ ensureAuthTable(); }catch(e){}
        try{ cur = getCurrentUser(); }catch(e){ cur = null; }
        try{
          if(cur && !hasUsableCloudToken()) cur = null;
          if(cur) applyUser(cur);
          else applyUser({ user:"—", role:"read", name:"—" });
        }catch(e){}

        try{ wire(); }catch(e){}
        try{ refresh(); }catch(e){}
        try{ await cloudHealth(); }catch(e){}

        var localCount = 0;
        try{ localCount = state.db.map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; }).length; }catch(e){ localCount = 0; }

        try{ await syncFromCloud({ silent:true, aggressive:(localCount===0) }); }catch(e){}

        try{
          var visibleCount = state.db.map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; }).length;
          if(!visibleCount){
            var snap = loadSnapshotRows();
            if(snap && snap.length){
              state.db = mergePayload({ db: snap, counter: snap.length }, { db: state.db, counter: state.counter }).db;
              state.counter = Math.max(Number(state.counter||0)||0, snap.length);
              await saveLocal({ db: state.db, counter: state.counter });
            }
          }
        }catch(e){}

        try{ refresh(); }catch(e){}
        try{ if(!cur) openLogin(); }catch(e){}

        try{
          await idbPutMeta({
            pageKey: PAGE_KEY,
            counter: state.counter,
            lastSyncAt: Number(state.lastSyncAt||0)||0,
            clientId: state.clientId,
            updatedAt: nowISO()
          });
        }catch(e){}

        setTimeout(function(){
          try{
            var n = state.db.map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; }).length;
            if(!n) syncFromCloud({ silent:true, aggressive:true }).catch(function(){});
          }catch(_e){}
        }, 1200);

        setTimeout(function(){
          try{
            var n = state.db.map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; }).length;
            if(!n) syncFromCloud({ silent:true, aggressive:true }).catch(function(){});
          }catch(_e){}
        }, 4200);
      }catch(e){
        try{ wire(); }catch(_e){}
        try{ refresh(); }catch(_e){}
        try{ if(!cur) openLogin(); }catch(_e){}
        console.error(e);
      }
    }


    window.addEventListener("storage", async function(e){
      var k = String((e && e.key) || "");
      if(k && [DB_KEY, COUNTER_KEY, READ_MODE_KEY, AUTH_KEY, CURRENT_KEY, CLOUD_TOKEN_KEY, CLOUD_TOKEN_EXP_KEY, DB_SNAPSHOT_KEY, DB_SNAPSHOT_META_KEY, DB_SNAPSHOT_SESSION_KEY, DB_SNAPSHOT_SESSION_META_KEY].indexOf(k)===-1) return;
      try{
        var p2 = await loadDb();
        state.db = p2.db;
        state.counter = p2.counter;
        var cur2 = getCurrentUser();
        if(cur2) applyUser(cur2);
        state.readMode = localStorage.getItem(READ_MODE_KEY)==="1";
        applyReadMode(state.readMode);
        if((k===DB_SNAPSHOT_KEY || k===DB_SNAPSHOT_META_KEY) && (!state.db || !state.db.length)){
          var snapRows = loadSnapshotRows();
          if(snapRows && snapRows.length){
            state.db = snapRows;
            state.counter = Math.max(Number(state.counter||0)||0, snapRows.length);
            await saveLocal({ db: state.db, counter: state.counter });
          }
        }
        refresh();
        try{
          var n2 = state.db.map(normalizeRow).filter(Boolean).filter(function(r){ return !r.deleted; }).length;
          if(!n2) syncFromCloud({ silent:true, aggressive:true }).catch(function(){});
        }catch(_e){}
      }catch(err){}
    });

    boot().catch(function(e){ console.error(e); });
  })();
  

window.TasunGuardV4 && window.TasunGuardV4.boot({ pageKey: "捷運汐東線事項記錄.html" });