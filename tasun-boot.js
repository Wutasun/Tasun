/* tasun-boot.js (Tasun Boot) [Cloud Auto-Mount v1] */
(function (window, document) {
  "use strict";

  var Boot = window.TasunBoot || {};
  var READY = false;
  var READY_Q = [];

  var CLOUD_READY = false;
  var CLOUD_READY_Q = [];
  var _cloudCtrl = null;
  var _autosaveTimer = null;

  function str(v){ return (v===undefined||v===null) ? "" : String(v); }

  function onReady(cb){
    if(typeof cb !== "function") return;
    if(READY) { try{ cb(window.TasunCore); }catch(e){} return; }
    READY_Q.push(cb);
  }
  function flushReady(){
    READY = true;
    var q = READY_Q.slice();
    READY_Q.length = 0;
    for(var i=0;i<q.length;i++){
      try{ q[i](window.TasunCore); }catch(e){}
    }
  }

  function onCloudReady(cb){
    if(typeof cb !== "function") return;
    if(CLOUD_READY) { try{ cb(_cloudCtrl); }catch(e){} return; }
    CLOUD_READY_Q.push(cb);
  }
  function flushCloudReady(){
    CLOUD_READY = true;
    var q = CLOUD_READY_Q.slice();
    CLOUD_READY_Q.length = 0;
    for(var i=0;i<q.length;i++){
      try{ q[i](_cloudCtrl); }catch(e){}
    }
  }

  function loadScript(src, cb){
    var s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = function(){ try{ cb && cb(); }catch(e){} };
    s.onerror = function(){ try{ cb && cb(new Error("load failed")); }catch(e){} };
    document.head.appendChild(s);
  }

  function fetchJsonNoStore(url, cb){
    try{
      var u = url + (url.indexOf("?")>=0 ? "&" : "?") + "ts=" + Date.now();
      fetch(u, { cache: "no-store" })
        .then(function(r){ return r.json(); })
        .then(function(j){ cb(null, j); })
        .catch(function(e){ cb(e, null); });
    }catch(e){
      cb(e, null);
    }
  }

  // 推導 pageKey = 檔名（含 .html）
  function inferPageKey(){
    var k = "";
    try{
      if(window.TASUN_PAGE_KEY) k = str(window.TASUN_PAGE_KEY).trim();
      if(!k){
        var p = str(location.pathname || "");
        if(p.indexOf("/") >= 0) p = p.split("/").pop();
        k = p;
      }
      k = str(k || "").split("?")[0].split("#")[0];
      try{ k = decodeURIComponent(k); }catch(e){}
    }catch(e2){}
    if(!k) k = "index.html";
    return k;
  }

  // 強制 URL v=ver（比 TasunCore.init 更早）
  function forceUrlV(ver, pageKey){
    try{
      var v = str(ver).trim();
      if(!v) return false;

      var u = new URL(location.href);
      var cur = str(u.searchParams.get("v")||"").trim();
      var guard = "tasun_boot_force_" + (pageKey||"p") + "_" + (cur||"none") + "_to_" + v;

      var already = false;
      try{ already = (sessionStorage.getItem(guard)==="1"); }catch(e){ already=false; }

      if(cur !== v && !already){
        try{ sessionStorage.setItem(guard,"1"); }catch(e){}
        u.searchParams.set("v", v);
        location.replace(u.toString());
        return true;
      }
    }catch(e){}
    return false;
  }

  function canWriteByCore(){
    try{
      var C = window.TasunCore;
      if(C && C.Auth && typeof C.Auth.canWrite === "function") return !!C.Auth.canWrite();
    }catch(e){}
    return false;
  }

  function getUserByCore(){
    try{
      var C = window.TasunCore;
      if(C && C.Auth && typeof C.Auth.current === "function"){
        var u = C.Auth.current() || {};
        return str(u.username || u.user || "");
      }
    }catch(e){}
    return "";
  }

  function getRoleByCore(){
    try{
      var C = window.TasunCore;
      if(C && C.Auth && typeof C.Auth.role === "function") return str(C.Auth.role() || "");
    }catch(e){}
    return "";
  }

  function stopAutosave(){
    if(_autosaveTimer){
      try{ clearInterval(_autosaveTimer); }catch(e){}
      _autosaveTimer = null;
    }
  }

  function startAutosave(sec){
    stopAutosave();
    sec = Number(sec || 0);
    if(!isFinite(sec) || sec <= 0) return;

    _autosaveTimer = setInterval(function(){
      if(!_cloudCtrl || !_cloudCtrl.saveMerged) return;
      if(document.hidden) return;
      if(!canWriteByCore()) return;
      try{ _cloudCtrl.saveMerged({ reason: "autosave" }); }catch(e){}
    }, Math.max(3000, sec * 1000));

    // 退到背景也做一次（盡量不漏）
    document.addEventListener("visibilitychange", function(){
      if(document.hidden){
        if(_cloudCtrl && _cloudCtrl.saveMerged && canWriteByCore()){
          try{ _cloudCtrl.saveMerged({ reason: "visibility-hidden" }); }catch(e){}
        }
      }
    }, { passive:true });
  }

  function mountCloud(ver, pageKey, opts){
    opts = opts || {};
    if(opts.cloud === false) { flushCloudReady(); return; }

    var cloudPath = str(opts.cloudPath || "tasun-cloud-kit.js").trim();
    var resourcesUrl = str(opts.resourcesUrl || "tasun-resources.json").trim();

    var cloudSrc = cloudPath + (cloudPath.indexOf("?")>=0 ? "&" : "?") + "v=" + encodeURIComponent(ver);

    function doMount(){
      if(!window.TasunCloudKit || typeof window.TasunCloudKit.mount !== "function"){
        flushCloudReady();
        return;
      }

      // 每頁只需要提供 window.TASUN_CLOUD hooks（不改 UI）
      var hooks = window.TASUN_CLOUD || (window.TASUN_PAGE && window.TASUN_PAGE.cloud) || null;

      if(!hooks || typeof hooks !== "object"){
        // 沒提供 hooks 就不 mount（避免誤寫空資料）
        flushCloudReady();
        return;
      }

      try{
        window.TasunCloudKit.init({
          appVer: ver,
          resourcesUrl: resourcesUrl,
          ui: (opts.cloudUi && typeof opts.cloudUi === "object") ? opts.cloudUi : undefined
        });
      }catch(e0){}

      var rk = str(hooks.resourceKey || pageKey).trim();

      _cloudCtrl = window.TasunCloudKit.mount({
        resourcesUrl: resourcesUrl,
        resourceKey: rk,

        // 角色/使用者 meta（預設走 Core.Auth）
        user: (typeof hooks.user === "function") ? hooks.user : function(){ return getUserByCore(); },
        role: (typeof hooks.role === "function") ? hooks.role : function(){ return getRoleByCore(); },

        // 由頁面提供（保持 UI/DOM/CSS 不變）
        getLocal: hooks.getLocal,
        apply: hooks.apply,

        watch: (hooks.watch && typeof hooks.watch === "object") ? hooks.watch : { intervalSec: 0 },
        protectEmptyRemote: (hooks.protectEmptyRemote !== undefined) ? !!hooks.protectEmptyRemote : true,
        canSeed: (typeof hooks.canSeed === "function") ? hooks.canSeed : function(){ return canWriteByCore(); }
      });

      // autosave（只對 write/admin 推）
      try{
        var as = hooks.watch && hooks.watch.autoSaveSec ? Number(hooks.watch.autoSaveSec) : 0;
        if(isFinite(as) && as > 0) startAutosave(as);
      }catch(e1){}

      flushCloudReady();
    }

    // 已載入就直接 mount
    if(window.TasunCloudKit && typeof window.TasunCloudKit.mount === "function"){
      doMount();
      return;
    }

    loadScript(cloudSrc, function(){
      doMount();
    });
  }

  Boot.start = function(opts){
    opts = opts || {};
    var pageKey = str(opts.pageKey||"").trim() || inferPageKey();

    var verUrl   = str(opts.verUrl || "tasun-version.json").trim();
    var corePath = str(opts.corePath || "tasun-core.js").trim();

    fetchJsonNoStore(verUrl, function(err, json){
      var ver = "";
      if(!err && json && typeof json === "object"){
        ver = str(json.ver || json.version || "").trim();
      }

      if(!ver){
        try{
          var u = new URL(location.href);
          ver = str(u.searchParams.get("v")||"").trim();
        }catch(e){}
      }
      if(!ver) ver = str(window.TASUN_APP_VER||"").trim();
      if(!ver) ver = String(Date.now());

      window.TASUN_APP_VER = ver;

      if(opts.forceUrlV !== false){
        if(forceUrlV(ver, pageKey)) return;
      }

      var coreSrc = corePath + (corePath.indexOf("?")>=0 ? "&" : "?") + "v=" + encodeURIComponent(ver);

      function initCoreAndGo(){
        if(window.TasunCore && typeof window.TasunCore.init === "function"){
          try{
            window.TasunCore.init({
              pageKey: pageKey,
              forceUrlV: true,
              forceVersionSync: true,
              networkToast: (opts.networkToast !== false),
              patchResources: (opts.patchResources !== false),
              appHeightVar: (opts.appHeightVar !== false)
            });
          }catch(e){}
        }
        flushReady();

        // ✅ cloud auto mount
        mountCloud(ver, pageKey, opts);
      }

      if(window.TasunCore && typeof window.TasunCore.init === "function"){
        initCoreAndGo();
        return;
      }

      loadScript(coreSrc, function(){
        initCoreAndGo();
      });
    });
  };

  Boot.onReady = onReady;
  Boot.onCloudReady = onCloudReady;

  // 讓頁面可手動呼叫
  Boot.cloudCtrl = function(){ return _cloudCtrl; };
  Boot.getPageKey = function(){ return inferPageKey(); };
  Boot.stopAutosave = stopAutosave;

  window.TasunBoot = Boot;

})(window, document);
