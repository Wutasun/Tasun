/* tasun-boot.js (Tasun Boot) - Cloud Sync STANDARD v1 */
(function (window, document) {
  "use strict";

  var Boot = window.TasunBoot || {};
  var READY = false;
  var READY_Q = [];
  var CLOUD_READY = false;
  var CLOUD_Q = [];
  var CLOUD_CTRL = null;

  function str(v) { return (v === undefined || v === null) ? "" : String(v); }

  function onReady(cb) {
    if (typeof cb !== "function") return;
    if (READY) { try { cb(window.TasunCore); } catch (e) {} return; }
    READY_Q.push(cb);
  }

  function onCloudReady(cb){
    if(typeof cb !== "function") return;
    if(CLOUD_READY) { try{ cb(CLOUD_CTRL); }catch(e){} return; }
    CLOUD_Q.push(cb);
  }

  function flushReady() {
    READY = true;
    var q = READY_Q.slice();
    READY_Q.length = 0;
    for (var i = 0; i < q.length; i++) {
      try { q[i](window.TasunCore); } catch (e) {}
    }
  }

  function flushCloudReady(){
    CLOUD_READY = true;
    var q = CLOUD_Q.slice();
    CLOUD_Q.length = 0;
    for(var i=0;i<q.length;i++){
      try{ q[i](CLOUD_CTRL); }catch(e){}
    }
  }

  function loadScript(src, cb) {
    var s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = function () { try { cb && cb(null); } catch (e) {} };
    s.onerror = function () { try { cb && cb(new Error("load failed: " + src)); } catch (e) {} };
    document.head.appendChild(s);
  }

  function safeJSONParse(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function fetchTextNoStore(url, cb) {
    try {
      var u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "ts=" + Date.now();
      fetch(u, { cache: "no-store" })
        .then(function (r) { return r.text(); })
        .then(function (t) { cb(null, t); })
        .catch(function (e) { cb(e, ""); });
    } catch (e2) {
      cb(e2, "");
    }
  }

  // ===== STANDARD v1: pageKey resolve =====
  function metaContent(name) {
    try {
      var el = document.querySelector('meta[name="' + name + '"]');
      return el ? str(el.getAttribute("content") || "").trim() : "";
    } catch (e) { return ""; }
  }

  function fileName() {
    try {
      var p = new URL(location.href).pathname || "";
      var seg = p.split("/");
      var f = seg[seg.length - 1] || "index.html";
      return f;
    } catch (e) {
      return "index.html";
    }
  }

  function resolvePageKey(opts) {
    opts = opts || {};
    return str(
      opts.pageKey ||
      opts.resourceKey ||
      window.TASUN_PAGE_KEY ||
      metaContent("tasun:pageKey") ||
      fileName()
    ).trim();
  }

  // ===== STANDARD v1: version read =====
  function readVerFromVersionJsonText(t) {
    var j = safeJSONParse(t);
    if (j && typeof j === "object") {
      var v = str(j.ver || j.version || j.appVer || j.APP_VER || "").trim();
      if (v) return v;
    }
    try {
      var m = String(t || "").match(/"ver"\s*:\s*"([^"]+)"/i) || String(t || "").match(/"version"\s*:\s*"([^"]+)"/i);
      if (m && m[1]) return str(m[1]).trim();
    } catch (e) {}
    return "";
  }

  // ===== STANDARD v1: global scope url lock =====
  function forceUrlV(ver, pageKey) {
    try {
      var v = str(ver).trim();
      if (!v) return false;

      var u = new URL(location.href);
      var cur = str(u.searchParams.get("v") || "").trim();

      var guard = "tasun_boot_force_v1_global_" + (pageKey || "p") + "_" + (cur || "none") + "_to_" + v;

      var already = false;
      try { already = (sessionStorage.getItem(guard) === "1"); } catch (e2) { already = false; }

      if (cur !== v && !already) {
        try { sessionStorage.setItem(guard, "1"); } catch (e3) {}
        u.searchParams.set("v", v);
        location.replace(u.toString());
        return true;
      }
    } catch (e4) {}
    return false;
  }

  function loadCloudKit(ver, cloudPath, cb){
    cloudPath = str(cloudPath || "tasun-cloud-kit.js").trim();
    var src = cloudPath + (cloudPath.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(ver);
    if(window.TasunCloudKit && typeof window.TasunCloudKit.mount === "function") return cb && cb(null);
    loadScript(src, cb);
  }

  function getAuthUserRole(){
    try{
      var C = window.TasunCore;
      if(C && C.Auth){
        var u = C.Auth.current && C.Auth.current();
        var role = C.Auth.role && C.Auth.role();
        return { user: (u && (u.username || u.user)) ? String(u.username || u.user) : "", role: String(role || "") };
      }
    }catch(e){}
    return { user:"", role:"" };
  }

  function maybeAutoMountCloud(ver, pageKey, opts){
    opts = opts || {};
    if(opts.cloud === false) return;

    var hooks = window.TASUN_CLOUD_HOOKS || opts.cloudHooks || null;
    if(!hooks || typeof hooks !== "object") return;

    // 必須至少提供 getLocal/apply
    if(typeof hooks.getLocal !== "function" || typeof hooks.apply !== "function") return;

    var cloudPath = str((opts.cloud && opts.cloud.path) || opts.cloudPath || "tasun-cloud-kit.js").trim();
    var resourcesUrl = str((opts.cloud && opts.cloud.resourcesUrl) || opts.resourcesUrl || "tasun-resources.json").trim();

    loadCloudKit(ver, cloudPath, function(){
      try{
        if(!window.TasunCloudKit || typeof window.TasunCloudKit.mount !== "function") return;

        // init（可關掉 CloudKit 浮動 UI：opts.cloud.ui.enabled=false）
        var uiCfg = (opts.cloud && opts.cloud.ui) ? opts.cloud.ui : undefined;
        window.TasunCloudKit.init({ appVer: ver, resourcesUrl: resourcesUrl, ui: uiCfg });

        // mount cfg：resourceKey 預設用 pageKey（=檔名）→ 每頁獨立資料表最穩
        var ar = getAuthUserRole();
        var cfg = {};
        for(var k in hooks) if(Object.prototype.hasOwnProperty.call(hooks,k)) cfg[k] = hooks[k];

        if(!cfg.resourceKey) cfg.resourceKey = pageKey;
        if(cfg.resourcesUrl === undefined) cfg.resourcesUrl = resourcesUrl;

        // 避免 read 使用者 seed 空雲端
        if(typeof cfg.canSeed !== "function"){
          cfg.canSeed = function(){ return !!(window.TasunCore && window.TasunCore.Auth && window.TasunCore.Auth.canWrite && window.TasunCore.Auth.canWrite()); };
        }

        // meta user/role（一次性讀取，夠用；要更動可在你頁面 hooks 自己塞）
        if(cfg.user === undefined) cfg.user = ar.user || "";
        if(cfg.role === undefined) cfg.role = ar.role || "";

        // watch（只 pull，不會自動寫；寫入由你頁面呼叫 ctrl.saveMerged()）
        if(cfg.watch === undefined) cfg.watch = { intervalSec: 15 };

        CLOUD_CTRL = window.TasunCloudKit.mount(cfg);
        window.__TASUN_CLOUD_CTRL = CLOUD_CTRL; // 給頁面/console 用
        flushCloudReady();
      }catch(e){}
    });
  }

  Boot.start = function (opts) {
    opts = opts || {};

    var pageKey = resolvePageKey(opts);
    if (pageKey) window.TASUN_PAGE_KEY = pageKey;

    var verUrl = str(opts.verUrl || "tasun-version.json").trim();
    var corePath = str(opts.corePath || "tasun-core.js").trim();

    fetchTextNoStore(verUrl, function (err, text) {
      var ver = "";
      if (!err) ver = readVerFromVersionJsonText(text);

      if (!ver) {
        try {
          var u = new URL(location.href);
          ver = str(u.searchParams.get("v") || "").trim();
        } catch (e) {}
      }
      if (!ver) ver = str(window.TASUN_APP_VER || "").trim();
      if (!ver) ver = String(Date.now());

      window.TASUN_APP_VER = ver;
      window.__CACHE_V = ver;

      if (opts.forceUrlV !== false) {
        if (forceUrlV(ver, pageKey)) return;
      }

      var coreSrc = corePath + (corePath.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(ver);

      function afterCore(){
        // ✅ core ready event queue
        flushReady();

        // ✅ CloudKit auto mount (if hooks provided)
        maybeAutoMountCloud(ver, pageKey, opts);
      }

      if (window.TasunCore && typeof window.TasunCore.init === "function") {
        try {
          window.TasunCore.init({
            pageKey: pageKey,
            appVer: ver,
            forceUrlV: true,
            forceVersionSync: true,
            networkToast: (opts.networkToast !== false),
            patchResources: (opts.patchResources !== false),
            appHeightVar: (opts.appHeightVar !== false)
          });
        } catch (e2) {}
        afterCore();
        return;
      }

      loadScript(coreSrc, function () {
        if (window.TasunCore && typeof window.TasunCore.init === "function") {
          try {
            window.TasunCore.init({
              pageKey: pageKey,
              appVer: ver,
              forceUrlV: true,
              forceVersionSync: true,
              networkToast: (opts.networkToast !== false),
              patchResources: (opts.patchResources !== false),
              appHeightVar: (opts.appHeightVar !== false)
            });
          } catch (e3) {}
        }
        afterCore();
      });
    });
  };

  Boot.onReady = onReady;
  Boot.onCloudReady = onCloudReady;
  Boot.resolvePageKey = resolvePageKey;
  Boot.cloudCtrl = function(){ return CLOUD_CTRL; };

  window.TasunBoot = Boot;
})(window, document);
