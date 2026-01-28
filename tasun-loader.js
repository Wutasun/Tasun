/* tasun-loader.js (Common Loader) */
(function (window, document) {
  "use strict";

  var TasunLoader = window.TasunLoader || {};
  var READY_FLAG = "__tasun_core_ready_fired__";

  function str(v) { return (v === undefined || v === null) ? "" : String(v); }

  function fireCoreReadyOnce() {
    try {
      if (window[READY_FLAG]) return;
      window[READY_FLAG] = true;
      window.dispatchEvent(new CustomEvent("tasun:core-ready"));
    } catch (e) {
      try {
        // IE fallback-ish
        var ev = document.createEvent("Event");
        ev.initEvent("tasun:core-ready", false, false);
        window.dispatchEvent(ev);
      } catch (e2) {}
    }
  }

  function coreReady() {
    return !!(window.TasunCore && typeof window.TasunCore.withV === "function");
  }

  function fallbackLoadCore(appVer, corePath, initOpts) {
    try {
      var v = str(appVer).trim() || str(Date.now());
      var src = str(corePath).trim() || "tasun-core.js";
      var s = document.createElement("script");
      s.async = false;
      s.src = src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(v);
      s.onload = function () {
        try {
          if (window.TasunCore && typeof window.TasunCore.init === "function") {
            window.TasunCore.init(initOpts || {});
          }
        } catch (e) {}
        fireCoreReadyOnce();
      };
      s.onerror = function () {
        // 就算 core 載入失敗，也觸發一次，讓頁面有機會走自己的 fallback
        fireCoreReadyOnce();
      };
      document.head.appendChild(s);
    } catch (e) {
      fireCoreReadyOnce();
    }
  }

  /**
   * TasunLoader.start({
   *   pageKey, verUrl, corePath,
   *   forceUrlV, forceVersionSync, patchResources,
   *   networkToast, appHeightVar,
   *   preloadId, zenImgId
   * })
   */
  TasunLoader.start = function (opts) {
    opts = opts || {};

    // ✅統一 APP_VER（你只要改各頁這個字串即可；Boot/version.json 仍可覆蓋同步）
    var appVer = str(window.TASUN_APP_VER || opts.appVer).trim();
    if (!appVer) appVer = str(Date.now());
    window.TASUN_APP_VER = appVer;

    var initOpts = {
      pageKey: str(opts.pageKey || "").trim(),
      forceUrlV: (opts.forceUrlV !== false),
      forceVersionSync: (opts.forceVersionSync !== false),
      patchResources: (opts.patchResources !== false),
      networkToast: !!opts.networkToast,
      appHeightVar: !!opts.appHeightVar
    };

    try {
      // ✅優先走 TasunBoot（會抓 tasun-version.json 最新 ver、鎖 URL v、載入最新版 core）
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

        // 有些版本 Boot 內已 dispatch；但為了保險，再做一次「等 core 真 ready 就補發」
        TasunLoader.ready(function(){}, 8000);
        return;
      }
    } catch (e) {}

    // ✅Boot 不在/失敗：直接 fallback 載入 core（至少保證能跑）
    fallbackLoadCore(appVer, str(opts.corePath || "tasun-core.js"), initOpts);
  };

  /**
   * TasunLoader.ready(fn, timeoutMs)
   * - 等 TasunCore 可用（或超時）才呼叫 fn
   */
  TasunLoader.ready = function (fn, timeoutMs) {
    var cb = (typeof fn === "function") ? fn : function(){};
    var tmax = Number(timeoutMs || 8000);
    if (!Number.isFinite(tmax) || tmax < 0) tmax = 8000;

    // 已就緒
    if (coreReady()) {
      try { fireCoreReadyOnce(); } catch (e) {}
      try { cb(); } catch (e2) {}
      return;
    }

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      try { cb(); } catch (e) {}
    }

    // 等事件
    window.addEventListener("tasun:core-ready", function () {
      if (coreReady()) {
        finish();
      } else {
        // event 來了但 core 還沒 ready：下一幀再判斷
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
        fireCoreReadyOnce();
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
