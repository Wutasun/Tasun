/* tasun-core.js (Tasun Core) */
(function (window, document) {
  "use strict";

  var TasunCore = window.TasunCore || {};
  var CORE_VER = "20260126_01"; // core 自己的版本（不等於 APP_VER，可不改）

  function str(v) { return (v === undefined || v === null) ? "" : String(v); }

  function jsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ===== 版本 withV =====
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
      // fallback for odd strings
      var s = str(url || "");
      if (!s) return s;
      return s + (s.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }

  // 替同源資源補 v（img/link/script），避免不同電腦吃到不同快取
  function patchResourceUrls() {
    var vv = str(window.__CACHE_V || "").trim();
    if (!vv) return;

    function patchAttr(el, attr) {
      try {
        var val = el.getAttribute(attr);
        if (!val) return;
        // 不動 data:, blob:, mailto:
        if (/^(data:|blob:|mailto:)/i.test(val)) return;

        var next = withV(val);
        if (next && next !== val) el.setAttribute(attr, next);
      } catch (e) {}
    }

    // preload image
    var preload = document.querySelectorAll('link[rel="preload"][as="image"]');
    for (var i = 0; i < preload.length; i++) patchAttr(preload[i], "href");

    // stylesheet/script/img
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var j = 0; j < links.length; j++) patchAttr(links[j], "href");

    var scripts = document.querySelectorAll("script[src]");
    for (var k = 0; k < scripts.length; k++) patchAttr(scripts[k], "src");

    var imgs = document.querySelectorAll("img[src]");
    for (var m = 0; m < imgs.length; m++) patchAttr(imgs[m], "src");
  }

  // ===== 版本同步（避免不同裝置顯示不同版本）=====
  function forceVersionSync(appVer, pageKey) {
    var v = str(appVer || "").trim();
    if (!v) return;

    var KEY = "tasun_app_ver_global_v1" + (pageKey ? ("_" + pageKey) : "");
    var TAB_GUARD = "tasun_tab_replaced_once_v1" + (pageKey ? ("_" + pageKey) : "");

    try {
      var last = str(localStorage.getItem(KEY) || "");
      if (last !== v) {
        localStorage.setItem(KEY, v);
        try { sessionStorage.removeItem(TAB_GUARD); } catch (e) {}
      }

      var u = new URL(window.location.href);
      var curV = str(u.searchParams.get("v") || "").trim();

      var already = false;
      try { already = (sessionStorage.getItem(TAB_GUARD) === "1"); } catch (e) { already = false; }

      // 若網址 v 不等於 APP_VER → replace 一次，避免無限迴圈
      if (curV !== v && !already) {
        try { sessionStorage.setItem(TAB_GUARD, "1"); } catch (e) {}
        u.searchParams.set("v", v);
        window.location.replace(u.toString());
        return true; // replaced
      }
    } catch (e) {}

    return false;
  }

  // ===== 網路狀態提示（你看到的 "Network connection lost..." 無法「完全避免」，
  // 但可以用更穩定的提示 + 避免離線時做重操作）=====
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

  // ===== init =====
  function init(opts) {
    opts = opts || {};
    var pageKey = str(opts.pageKey || "").trim(); // e.g. "index"
    var appVer = getAppVer(opts.appVer);

    if (appVer) {
      ensureCacheV(appVer);

      // 越早越好：若這裡 replace 了，就停止後續 init（避免多跑）
      if (opts.forceVersionSync !== false) {
        var replaced = forceVersionSync(appVer, pageKey);
        if (replaced) return;
      }

      // 等 DOM 可用再 patch 資源
      var doPatch = function () { try { patchResourceUrls(); } catch (e) {} };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", doPatch, { once: true });
      } else {
        doPatch();
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

  // ===== 對外 API =====
  TasunCore.coreVer = CORE_VER;
  TasunCore.jsonParse = jsonParse;
  TasunCore.clamp = clamp;
  TasunCore.lerp = lerp;

  TasunCore.withV = function (url) { return withV(url); };
  TasunCore.forceVersionSync = function (appVer, pageKey) { return forceVersionSync(appVer, pageKey); };
  TasunCore.patchResourceUrls = function () { return patchResourceUrls(); };
  TasunCore.installNetToast = function () { return installNetToast(); };
  TasunCore.init = init;

  // 向下相容：保留你原本 index.html 會用到的全域
  window.__withV = window.__withV || TasunCore.withV;

  window.TasunCore = TasunCore;

})(window, document);
