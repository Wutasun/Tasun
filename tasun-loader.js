/* tasun-loader.js (Common Loader) */
(function (window, document) {
  "use strict";

  var TasunLoader = window.TasunLoader || {};
  var READY_FLAG = "__tasun_core_ready_fired__";
  var URL_LOCK_KEY = "tasun_url_lock_v1"; // 防止無限 replace

  function str(v) { return (v === undefined || v === null) ? "" : String(v); }

  function fireCoreReadyOnce() {
    try {
      if (window[READY_FLAG]) return;
      window[READY_FLAG] = true;
      window.dispatchEvent(new CustomEvent("tasun:core-ready"));
    } catch (e) {
      try {
        var ev = document.createEvent("Event");
        ev.initEvent("tasun:core-ready", false, false);
        window.dispatchEvent(ev);
      } catch (e2) {}
    }
  }

  function coreReady() {
    return !!(window.TasunCore && (typeof window.TasunCore.withV === "function" || typeof window.TasunCore.__withV === "function"));
  }

  // ✅ 提供全站可共用的 __withV（core 還沒來也能用）
  function installWithV(appVer) {
    var v = str(appVer).trim();
    if (!v) v = str(Date.now());

    window.APP_VER = window.APP_VER || v;
    window.TASUN_APP_VER = window.TASUN_APP_VER || v;

    window.__CACHE_V = v;

    window.__withV = window.__withV || function (url) {
      try {
        var u = new URL(url, document.baseURI);
        // 同源或 file: 才加 v
        var sameOrigin = (u.origin === location.origin);
        var fileMode = (location.protocol === "file:" || u.protocol === "file:");
        if (sameOrigin || fileMode) u.searchParams.set("v", v);
        return u.toString();
      } catch (e) {
        if (!url) return url;
        var hash = "";
        var p = url.indexOf("#");
        if (p >= 0) { hash = url.slice(p); url = url.slice(0, p); }
        return url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(v) + hash;
      }
    };
  }

  // ✅ Boot 不在時，仍可選擇強制 URL 帶 v（避免不同電腦快取不同）
  function ensureUrlV(appVer, enabled) {
    if (!enabled) return;
    var v = str(appVer).trim();
    if (!v) return;

    try {
      var u = new URL(location.href);
      var cur = u.searchParams.get("v") || "";
      if (cur !== v) {
        // 同一版只 replace 一次，避免無限循環
        if (sessionStorage.getItem(URL_LOCK_KEY) !== v) {
          sessionStorage.setItem(URL_LOCK_KEY, v);
          u.searchParams.set("v", v);
          location.replace(u.toString());
          return true; // 已跳轉
        }
      } else {
        sessionStorage.setItem(URL_LOCK_KEY, v);
      }
    } catch (e) {}
    return false;
  }

  // ✅ 提供 TasunCore.ready 共用（頁面只要呼叫 TasunCore.ready(fn)）
  function installCoreReadyAdapter() {
    window.TasunCore = window.TasunCore || {};
    var C = window.TasunCore;

    // queue
    if (!C.__readyQ) C.__readyQ = [];

    if (typeof C.ready !== "function") {
      C.ready = function (fn, timeoutMs) {
        if (typeof fn === "function") C.__readyQ.push(fn);
        TasunLoader.ready(function(){}, timeoutMs);
      };
    }
  }

  function drainCoreReadyQueue() {
    try {
      var C = window.TasunCore;
      if (!C || !C.__readyQ || !C.__readyQ.length) return;
      var q = C.__readyQ.slice(0);
      C.__readyQ.length = 0;
      for (var i = 0; i < q.length; i++) {
        try { q[i](); } catch (e) {}
      }
    } catch (e2) {}
  }

  function fallbackLoadCore(appVer, corePath, initOpts) {
    try {
      var v = str(appVer).trim() || str(Date.now());
      var src = str(corePath).trim() || "tasun-core.js";

      // ✅ 讓 fallback 也走同一套 __withV
      installWithV(v);

      var s = document.createElement("script");
      s.async = false;
      s.src = window.__withV(src);
      s.onload = function () {
        try {
          if (window.TasunCore && typeof window.TasunCore.init === "function") {
            window.TasunCore.init(initOpts || {});
          }
        } catch (e) {}
        // core ready
        fireCoreReadyOnce();
        drainCoreReadyQueue();
      };
      s.onerror = function () {
        // 就算 core 載入失敗，也觸發一次，讓頁面有機會走自己的 fallback
        fireCoreReadyOnce();
        drainCoreReadyQueue();
      };
      document.head.appendChild(s);
    } catch (e) {
      fireCoreReadyOnce();
      drainCoreReadyQueue();
    }
  }

  /**
   * TasunLoader.start({
   *   pageKey, verUrl, corePath,
   *   forceUrlV, forceVersionSync, patchResources,
   *   networkToast, appHeightVar,
   *   preloadId, zenImgId,
   *   appVer
   * })
   */
  TasunLoader.start = function (opts) {
    opts = opts || {};

    // ✅ 統一 APP_VER（支援 APP_VER / TASUN_APP_VER / opts.appVer）
    var appVer = str(window.APP_VER || window.TASUN_APP_VER || window.TASUN_APP_VER || window.TASUN_APP_VER || window.TASUN_APP_VER || window.TASUN_APP_VER || window.TASUN_APP_VER || window.TASUN_APP_VER).trim();
    if (!appVer) appVer = str(window.TASUN_APP_VER || opts.appVer).trim();
    if (!appVer) appVer = str(Date.now());

    window.APP_VER = appVer;
    window.TASUN_APP_VER = appVer;

    installWithV(appVer);
    installCoreReadyAdapter();

    var initOpts = {
      pageKey: str(opts.pageKey || "").trim(),
      forceUrlV: (opts.forceUrlV !== false),
      forceVersionSync: (opts.forceVersionSync !== false),
      patchResources: (opts.patchResources !== false),
      networkToast: !!opts.networkToast,
      appHeightVar: !!opts.appHeightVar
    };

    try {
      // ✅ 優先走 TasunBoot（抓 tasun-version.json 最新 ver、鎖 URL v、載入最新版 core）
      if (window.TasunBoot && typeof window.TasunBoot.start === "function") {
        window.TasunBoot.start({
          pageKey: initOpts.pageKey,
          verUrl: str(opts.verUrl || "tasun-version.json"),
          corePath: str(opts.corePath || "tasun-core.js"),
          forceUrlV: initOpts.forceUrlV,
          forceVersionSync: initOpts.forceVersionSync,
          patchResources: initOpts.patchResources,
          networkToast: initOpts.networkToast,
          appHeightVar: initOpts.appHeightVar,
          preloadId: opts.preloadId || "",
          zenImgId: opts.zenImgId || ""
        });

        // 保險：等 core 真 ready 再補發 + drain
        TasunLoader.ready(function(){}, 8000);
        return;
      }
    } catch (e) {}

    // ✅ Boot 不在/失敗：可選擇自己鎖 URL v（避免不同電腦快取分歧）
    if (ensureUrlV(appVer, initOpts.forceUrlV)) return;

    // ✅ 直接 fallback 載入 core
    fallbackLoadCore(appVer, str(opts.corePath || "tasun-core.js"), initOpts);
  };

  /**
   * TasunLoader.ready(fn, timeoutMs)
   * - 等 TasunCore 可用（或超時）才呼叫 fn
   */
  TasunLoader.ready = function (fn, timeoutMs) {
    var cb = (typeof fn === "function") ? fn : function(){};
    var tmax = Number(timeoutMs || 8000);
    if (!(tmax >= 0)) tmax = 8000;

    // 已就緒
    if (coreReady()) {
      try { fireCoreReadyOnce(); } catch (e) {}
      try { drainCoreReadyQueue(); } catch (e2) {}
      try { cb(); } catch (e3) {}
      return;
    }

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      // core 就緒時，先補 event + drain
      if (coreReady()) {
        try { fireCoreReadyOnce(); } catch (e) {}
        try { drainCoreReadyQueue(); } catch (e2) {}
      }
      try { cb(); } catch (e3) {}
    }

    // 等事件
    window.addEventListener("tasun:core-ready", function () {
      if (coreReady()) {
        finish();
      } else {
        requestAnimationFrame(function(){
          if (coreReady()) finish();
        });
      }
    }, { once: true });

    // 輪詢 + 超時
    var t0 = Date.now();
    var timer = setInterval(function () {
      if (coreReady()) {
        clearInterval(timer);
        finish();
        return;
      }
      if (Date.now() - t0 > tmax) {
        clearInterval(timer);
        // 超時也放行（讓頁面自己處理）
        finish();
      }
    }, 50);
  };

  window.TasunLoader = TasunLoader;

})(window, document);
