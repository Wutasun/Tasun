/* tasun-boot.js (Tasun Boot) */
(function (window, document) {
  "use strict";

  var Boot = window.TasunBoot || {};
  var READY = false;
  var READY_Q = [];

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

  // 強制 URL v=ver（比 TasunCore.init 更早執行）
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

  Boot.start = function(opts){
    opts = opts || {};
    var pageKey = str(opts.pageKey||"").trim();
    var verUrl  = str(opts.verUrl || "tasun-version.json").trim();
    var corePath = str(opts.corePath || "tasun-core.js").trim();

    // 1) 先抓最新版 ver（no-store）
    fetchJsonNoStore(verUrl, function(err, json){
      var ver = "";
      if(!err && json && typeof json === "object"){
        ver = str(json.ver || json.version || "").trim();
      }

      // 2) ver 抓不到時：退回用目前頁面 v / 或舊的 TASUN_APP_VER（避免整站壞掉）
      if(!ver){
        try{
          var u = new URL(location.href);
          ver = str(u.searchParams.get("v")||"").trim();
        }catch(e){}
      }
      if(!ver){
        ver = str(window.TASUN_APP_VER||"").trim();
      }
      if(!ver){
        // 最後保底：給一個當下值（至少讓資源能 cache-bust）
        ver = String(Date.now());
      }

      window.TASUN_APP_VER = ver;

      // 3) 先強制把網址 v 鎖到 ver（舊書籤也會被改掉）
      if(opts.forceUrlV !== false){
        if(forceUrlV(ver, pageKey)) return; // replace 後會重載
      }

      // 4) 再載入 tasun-core.js?v=ver（確保拿到新版 core）
      var coreSrc = corePath + (corePath.indexOf("?")>=0 ? "&" : "?") + "v=" + encodeURIComponent(ver);

      // 如果已經有 TasunCore 就不用重載
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
        flushReady();
        return;
      }

      loadScript(coreSrc, function(){
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
      });
    });
  };

  Boot.onReady = onReady;

  window.TasunBoot = Boot;
})(window, document);
