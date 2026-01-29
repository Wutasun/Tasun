/* tasun-version-loader.js (Unified Entry)
   全站唯一入口：抓 tasun-version.json → 鎖 URL ?v=latest → 安裝 __withV → 載入 tasun-core.js?v
   並提供 TasunBoot / TasunLoader / TasunCore.ready 相容介面
*/
(function (window, document) {
  "use strict";

  var Loader = window.TasunVersionLoader || {};
  var VERSION_URL = "tasun-version.json";
  var STORE_KEY = "tasun_latest_ver_v1";

  var READY_FLAG = "__tasun_core_ready_fired__";
  var URL_LOCK_PREFIX = "tasun_force_v_once__";
  var CORE_DEFAULT = "tasun-core.js";

  function str(v) { return (v === undefined || v === null) ? "" : String(v); }
  function trim(v) { return str(v).trim(); }

  function safeGet(store, k) {
    try { return store.getItem(k); } catch (e) { return null; }
  }
  function safeSet(store, k, v) {
    try { store.setItem(k, v); } catch (e) {}
  }

  function parseVer(j) {
    if (!j || typeof j !== "object") return "";
    return trim(j.ver || j.version || j.appVer || j.latest || "");
  }

  function withV(url, v) {
    v = trim(v);
    if (!v) return url;

    try {
      var u = new URL(url, document.baseURI);
      var sameOrigin = (u.origin === location.origin);
      var fileMode = (location.protocol === "file:" || u.protocol === "file:");
      if (sameOrigin || fileMode) {
        u.searchParams.set("v", v);
        return u.toString();
      }
    } catch (e) {}

    var s = str(url);
    if (!s) return s;
    var hash = "";
    var p = s.indexOf("#");
    if (p >= 0) { hash = s.slice(p); s = s.slice(0, p); }
    return s + (s.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(v) + hash;
  }

  function installGlobals(ver) {
    var v = trim(ver) || String(Date.now());
    window.APP_VER = v;
    window.TASUN_APP_VER = v;
    window.__CACHE_V = v;

    // 永遠以「最新 ver」覆蓋 __withV（避免不同套混用造成分歧）
    window.__withV = function (u) { return withV(u, v); };

    Loader.ver = v;
    Loader.withV = function (u) { return withV(u, v); };
  }

  function fetchLatestVer(url) {
    // file:// 模式通常 fetch 會受限，直接略過
    if (location.protocol === "file:") return Promise.resolve("");

    var u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    return fetch(u, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) { return parseVer(j); })
      .catch(function () { return ""; });
  }

  function forceUrlV(ver) {
    var v = trim(ver);
    if (!v) return false;

    try {
      var url = new URL(location.href);
      var cur = trim(url.searchParams.get("v") || "");

      // 同版：也寫入鎖，避免下次又 replace
      if (cur === v) {
        safeSet(sessionStorage, URL_LOCK_PREFIX + location.pathname, v);
        return false;
      }

      var guard = URL_LOCK_PREFIX + location.pathname + "__" + (cur || "none") + "_to_" + v;
      if (safeGet(sessionStorage, guard) === "1") return false;

      safeSet(sessionStorage, guard, "1");
      url.searchParams.set("v", v);
      location.replace(url.toString());
      return true;
    } catch (e) {}
    return false;
  }

  function addScript(src, id) {
    return new Promise(function (resolve) {
      try {
        if (id && document.getElementById(id)) return resolve(true);

        var s = document.createElement("script");
        if (id) s.id = id;
        s.async = false;
        s.src = src;
        s.onload = function () { resolve(true); };
        s.onerror = function () { resolve(false); };
        document.head.appendChild(s);
      } catch (e) {
        resolve(false);
      }
    });
  }

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
    var C = window.TasunCore;
    return !!(C && (typeof C.withV === "function" || typeof C.__withV === "function" || typeof C.init === "function"));
  }

  function installReadyAdapter() {
    window.TasunCore = window.TasunCore || {};
    var C = window.TasunCore;

    if (!C.__readyQ) C.__readyQ = [];

    if (typeof C.ready !== "function") {
      C.ready = function (fn, timeoutMs) {
        if (typeof fn === "function") C.__readyQ.push(fn);
        Loader.ready(function(){}, timeoutMs);
      };
    }
  }

  function drainReadyQueue() {
    try {
      var C = window.TasunCore;
      if (!C || !C.__readyQ || !C.__readyQ.length) return;
      var q = C.__readyQ.slice(0);
      C.__readyQ.length = 0;
      for (var i = 0; i < q.length; i++) {
        try { q[i](window.TasunCore); } catch (e) {}
      }
    } catch (e2) {}
  }

  function loadExtras(ver) {
    var extra = window.TASUN_PAGE_SCRIPTS;
    if (!Array.isArray(extra) || !extra.length) return Promise.resolve(true);

    var seq = Promise.resolve(true);
    for (var i = 0; i < extra.length; i++) {
      (function (p) {
        seq = seq.then(function () {
          p = trim(p);
          if (!p) return true;
          return addScript(withV(p, ver));
        });
      })(extra[i]);
    }
    return seq;
  }

  function runPageMain() {
    try {
      var fn = window.TASUN_PAGE_MAIN;
      if (typeof fn === "function") fn(window.TasunCore);
    } catch (e) {}
  }

  function buildInitOpts(opts) {
    opts = opts || {};
    var pageKey = trim(opts.pageKey || window.TASUN_PAGE_KEY || "");
    return {
      pageKey: pageKey,
      forceUrlV: true,
      forceVersionSync: (opts.forceVersionSync !== false),
      patchResources: (opts.patchResources !== false),
      networkToast: (opts.networkToast !== false),
      appHeightVar: (opts.appHeightVar !== false)
    };
  }

  function pickCurUrlV() {
    try {
      var u = new URL(location.href);
      return trim(u.searchParams.get("v") || "");
    } catch (e) {}
    return "";
  }

  function startInternal(opts) {
    opts = opts || {};

    var verUrl = trim(opts.verUrl || VERSION_URL);
    var corePath = trim(opts.corePath || CORE_DEFAULT);
    var forceV = (opts.forceUrlV !== false);

    var curV = pickCurUrlV();
    var stored = trim(safeGet(localStorage, STORE_KEY) || "");
    var preset = trim(opts.appVer || window.TASUN_APP_VER || window.APP_VER || "");

    var initOpts = buildInitOpts(opts);

    return fetchLatestVer(verUrl).then(function (latest) {
      var v = trim(latest) || stored || curV || preset || String(Date.now());
      safeSet(localStorage, STORE_KEY, v);

      installGlobals(v);
      installReadyAdapter();

      if (forceV) {
        if (forceUrlV(v)) return { redirected: true, ver: v };
      }

      // core 已存在：直接 init
      if (window.TasunCore && typeof window.TasunCore.init === "function") {
        try { window.TasunCore.init(initOpts); } catch (e) {}
        fireCoreReadyOnce();
        drainReadyQueue();
        return loadExtras(v).then(function () {
          runPageMain();
          return { ok: true, ver: v };
        });
      }

      // 載入 core?v
      return addScript(withV(corePath, v), "__tasun_core__").then(function (ok) {
        if (window.TasunCore && typeof window.TasunCore.init === "function") {
          try { window.TasunCore.init(initOpts); } catch (e) {}
        }
        fireCoreReadyOnce();
        drainReadyQueue();
        return loadExtras(v).then(function () {
          runPageMain();
          return { ok: ok, ver: v };
        });
      });
    }).catch(function () {
      // fetch 失敗：用 stored/cur/preset 保底
      var v2 = stored || curV || preset || String(Date.now());
      safeSet(localStorage, STORE_KEY, v2);

      installGlobals(v2);
      installReadyAdapter();

      if (forceV) {
        if (forceUrlV(v2)) return { redirected: true, ver: v2 };
      }

      if (window.TasunCore && typeof window.TasunCore.init === "function") {
        try { window.TasunCore.init(initOpts); } catch (e) {}
        fireCoreReadyOnce();
        drainReadyQueue();
        return loadExtras(v2).then(function () {
          runPageMain();
          return { ok: true, ver: v2 };
        });
      }

      return addScript(withV(corePath, v2), "__tasun_core__").then(function (ok2) {
        if (window.TasunCore && typeof window.TasunCore.init === "function") {
          try { window.TasunCore.init(initOpts); } catch (e) {}
        }
        fireCoreReadyOnce();
        drainReadyQueue();
        return loadExtras(v2).then(function () {
          runPageMain();
          return { ok: ok2, ver: v2 };
        });
      });
    });
  }

  // ===== public: ready =====
  Loader.ready = function (fn, timeoutMs) {
    var cb = (typeof fn === "function") ? fn : function(){};
    var tmax = Number(timeoutMs || 8000);
    if (!(tmax >= 0)) tmax = 8000;

    if (coreReady()) {
      fireCoreReadyOnce();
      drainReadyQueue();
      try { cb(); } catch (e) {}
      return;
    }

    var done = false;
    function finish() {
      if (done) return;
      done = true;

      if (coreReady()) {
        fireCoreReadyOnce();
        drainReadyQueue();
      }
      try { cb(); } catch (e2) {}
    }

    window.addEventListener("tasun:core-ready", function () {
      if (coreReady()) finish();
      else requestAnimationFrame(function () { finish(); });
    }, { once: true });

    var t0 = Date.now();
    var timer = setInterval(function () {
      if (coreReady()) { clearInterval(timer); finish(); return; }
      if (Date.now() - t0 > tmax) { clearInterval(timer); finish(); }
    }, 50);
  };

  // ===== public: start (single-run) =====
  Loader._startPromise = Loader._startPromise || null;
  Loader.start = function (opts) {
    if (Loader._startPromise) return Loader._startPromise;
    Loader._startPromise = startInternal(opts || {});
    return Loader._startPromise;
  };

  Loader.getVersion = function () {
    return trim(Loader.ver || window.TASUN_APP_VER || window.APP_VER || "");
  };

  window.TasunVersionLoader = Loader;

  // ===== Compatibility: TasunBoot / TasunLoader =====
  window.TasunBoot = window.TasunBoot || {};
  window.TasunBoot.start = function (opts) { Loader.start(opts || {}); };
  window.TasunBoot.onReady = function (cb) {
    Loader.ready(function () { try { cb && cb(window.TasunCore); } catch (e) {} }, 8000);
  };

  window.TasunLoader = window.TasunLoader || {};
  window.TasunLoader.start = function (opts) { Loader.start(opts || {}); };
  window.TasunLoader.ready = function (fn, t) { Loader.ready(fn, t); };

  // ===== Auto start (default ON) =====
  if (!window.__TASUN_AUTO_START_DISABLED__) {
    window.__TASUN_READY__ = Loader.start({
      pageKey: window.TASUN_PAGE_KEY || "",
      verUrl: VERSION_URL,
      corePath: CORE_DEFAULT,
      forceUrlV: true,
      forceVersionSync: true,
      patchResources: true,
      networkToast: true,
      appHeightVar: true
    });
  }

})(window, document);
