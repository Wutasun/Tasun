/* tasun-core.js (Tasun Core) */
(function (window, document) {
  "use strict";

  var TasunCore = window.TasunCore || {};
  var CORE_VER = "20260127_05";

  function str(v) { return (v === undefined || v === null) ? "" : String(v); }
  function jsonParse(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function rafDebounce(fn) {
    var r = 0;
    return function () {
      try { window.cancelAnimationFrame(r); } catch (e) {}
      r = window.requestAnimationFrame(function () {
        try { fn(); } catch (e) {}
      });
    };
  }

  function onFontsReady(cb) {
    cb = cb || function(){};
    try{
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(cb);
      else setTimeout(cb, 180);
    }catch(e){
      setTimeout(cb, 180);
    }
  }

  function getAppVer(optVer) {
    var v = str(optVer || window.TASUN_APP_VER || "").trim();
    return v;
  }

  function ensureCacheV(appVer) {
    window.__CACHE_V = appVer;
  }

  function withV(url) {
    var vv = str(window.__CACHE_V || "").trim();
    if (!vv) return url;

    try {
      var uu = new URL(url, document.baseURI);
      if (uu.origin === window.location.origin) uu.searchParams.set("v", vv);
      return uu.toString();
    } catch (e) {
      var s = str(url || "");
      if (!s) return s;
      return s + (s.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }

  function patchResourceUrls() {
    var vv = str(window.__CACHE_V || "").trim();
    if (!vv) return;

    function patchAttr(el, attr) {
      try {
        var val = el.getAttribute(attr);
        if (!val) return;
        if (/^(data:|blob:|mailto:)/i.test(val)) return;

        var next = withV(val);
        if (next && next !== val) el.setAttribute(attr, next);
      } catch (e) {}
    }

    var preload = document.querySelectorAll('link[rel="preload"][as="image"]');
    for (var i = 0; i < preload.length; i++) patchAttr(preload[i], "href");

    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var j = 0; j < links.length; j++) patchAttr(links[j], "href");

    var scripts = document.querySelectorAll("script[src]");
    for (var k = 0; k < scripts.length; k++) patchAttr(scripts[k], "src");

    var imgs = document.querySelectorAll("img[src]");
    for (var m = 0; m < imgs.length; m++) patchAttr(imgs[m], "src");
  }

  /* ✅✅✅ 新增：強制 URL v = appVer（舊書籤也會更新） */
  function forceUrlV(appVer, pageKey) {
    var v = str(appVer || "").trim();
    if (!v) return false;

    try {
      var u = new URL(window.location.href);
      var curV = str(u.searchParams.get("v") || "").trim();

      // guard 跟「當前v + 目標v + pageKey」綁定，避免無限 replace
      var gk = "tasun_force_url_guard_v2_" + (pageKey || "p") + "_" + (curV || "none") + "_to_" + v;
      var already = false;
      try { already = (sessionStorage.getItem(gk) === "1"); } catch (e) { already = false; }

      if (curV !== v && !already) {
        try { sessionStorage.setItem(gk, "1"); } catch (e) {}
        u.searchParams.set("v", v);
        window.location.replace(u.toString());
        return true;
      }
    } catch (e) {}

    return false;
  }

  /* ✅ 既有：版本同步（保留，但 guard 更穩） */
  function forceVersionSync(appVer, pageKey) {
    var v = str(appVer || "").trim();
    if (!v) return false;

    var KEY = "tasun_app_ver_global_v1" + (pageKey ? ("_" + pageKey) : "");

    try {
      var last = str(localStorage.getItem(KEY) || "");
      if (last !== v) {
        localStorage.setItem(KEY, v);
      }

      var u = new URL(window.location.href);
      var curV = str(u.searchParams.get("v") || "").trim();

      // guard 跟「當前v->目標v」綁定
      var TAB_GUARD = "tasun_tab_replaced_once_v2" + (pageKey ? ("_" + pageKey) : "") + "_" + (curV || "none") + "_to_" + v;

      var already = false;
      try { already = (sessionStorage.getItem(TAB_GUARD) === "1"); } catch (e) { already = false; }

      if (curV !== v && !already) {
        try { sessionStorage.setItem(TAB_GUARD, "1"); } catch (e) {}
        u.searchParams.set("v", v);
        window.location.replace(u.toString());
        return true;
      }
    } catch (e) {}

    return false;
  }

  function installNetToast() {
    if (document.getElementById("tasunNetToast")) return;

    var style = document.createElement("style");
    style.textContent =
      "#tasunNetToast{position:fixed;left:50%;top:14px;transform:translateX(-50%);" +
      "z-index:2000;padding:10px 14px;border-radius:999px;" +
      "background:rgba(0,0,0,.55);border:1px solid rgba(246,211,122,.55);" +
      "backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);" +
      "color:rgba(255,226,160,.98);font-family:system-ui, -apple-system, 'Noto Serif TC', 'Microsoft JhengHei', serif;" +
      "font-size:14px;letter-spacing:.04em;display:none;white-space:nowrap;" +
      "box-shadow:0 18px 40px rgba(0,0,0,.30);}"+
      "body.tasun-offline #tasunNetToast{display:block;}";
    document.head.appendChild(style);

    var div = document.createElement("div");
    div.id = "tasunNetToast";
    div.textContent = "Network connection lost. Attempting to reconnect…";
    document.body.appendChild(div);

    function sync() {
      var offline = !navigator.onLine;
      document.body.classList.toggle("tasun-offline", offline);
    }

    window.addEventListener("offline", sync, { passive: true });
    window.addEventListener("online", sync, { passive: true });
    sync();
  }

  function setAppHeightVar() {
    var apply = rafDebounce(function(){
      try{
        var h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty("--appH", h + "px");
      }catch(e){}
    });

    apply();
    window.addEventListener("resize", apply, { passive:true });
    if(window.visualViewport){
      window.visualViewport.addEventListener("resize", apply, { passive:true });
      window.visualViewport.addEventListener("scroll", apply, { passive:true });
    }
  }

  function init(opts) {
    opts = opts || {};
    var pageKey = str(opts.pageKey || "").trim();
    var appVer = getAppVer(opts.appVer);

    if (opts.appHeightVar) {
      try { setAppHeightVar(); } catch (e) {}
    }

    if (appVer) {
      ensureCacheV(appVer);

      // ✅先做 forceUrlV（更直覺：進站就鎖網址）
      if (opts.forceUrlV) {
        var replaced1 = forceUrlV(appVer, pageKey);
        if (replaced1) return;
      }

      // ✅再做既有 forceVersionSync（保險）
      if (opts.forceVersionSync !== false) {
        var replaced2 = forceVersionSync(appVer, pageKey);
        if (replaced2) return;
      }

      var doPatch = function () { try { patchResourceUrls(); } catch (e) {} };
      var wantPatch = (opts.patchResources !== false);

      if (wantPatch) {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", doPatch, { once: true });
        } else {
          doPatch();
        }
      }
    }

    if (opts.networkToast) {
      var mount = function () { try { installNetToast(); } catch (e) {} };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount, { once: true });
      } else {
        mount();
      }
    }
  }

  TasunCore.coreVer = CORE_VER;
  TasunCore.jsonParse = jsonParse;
  TasunCore.clamp = clamp;
  TasunCore.lerp = lerp;

  TasunCore.rafDebounce = rafDebounce;
  TasunCore.onFontsReady = onFontsReady;
  TasunCore.setAppHeightVar = setAppHeightVar;

  TasunCore.withV = function (url) { return withV(url); };
  TasunCore.forceUrlV = function (appVer, pageKey) { return forceUrlV(appVer, pageKey); };
  TasunCore.forceVersionSync = function (appVer, pageKey) { return forceVersionSync(appVer, pageKey); };
  TasunCore.patchResourceUrls = function () { return patchResourceUrls(); };
  TasunCore.installNetToast = function () { return installNetToast(); };
  TasunCore.init = init;

  window.__withV = window.__withV || TasunCore.withV;
  window.TasunCore = TasunCore;

})(window, document);
