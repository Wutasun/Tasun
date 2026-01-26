/* ============================================================
 * tasun-core.js  (Tasun 全站共用核心模組)
 * - 版本同步 / withV
 * - Network Guard: offline/online + ping
 * - fetch timeout / retry
 * - utils: safeJsonParse, clamp, lerp, rafThrottle, $
 * - backup(可選): ring + patchLocalStorage（需手動 enable）
 *
 * 用法（每頁 head）：
 *   <script>window.TASUN_APP_VER="20260126_01";</script>
 *   <script src="./tasun-core.js?v=20260126_01"></script>
 *   <script>TasunCore.init({ forceVersionSync:true, networkGuard:true });</script>
 * ============================================================ */
(function (global) {
  "use strict";

  const TasunCore = {};
  const DEF = {
    appName: "Tasun",
    // version sync
    forceVersionSync: true,
    versionStorageKey: "tasun_app_ver_global_v1",
    tabGuardKey: "tasun_tab_replaced_once_v1",

    // network guard
    networkGuard: true,
    toast: true,
    pingIntervalMs: 15000,
    pingTimeoutMs: 4500,
    pingUrl: "/favicon.ico", // 同源測試用

    // behavior
    autoInitToastMount: true
  };

  // ---------------- utils ----------------
  TasunCore.utils = {};

  TasunCore.utils.$ = function (sel, root) {
    return (root || document).querySelector(sel);
  };

  TasunCore.utils.safeJsonParse = function (s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  };

  TasunCore.utils.clamp = function (n, a, b) {
    return Math.max(a, Math.min(b, n));
  };

  TasunCore.utils.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  TasunCore.utils.rafThrottle = function (fn) {
    let raf = 0;
    return function (...args) {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        fn.apply(this, args);
      });
    };
  };

  function safeGetAppVer() {
    const v1 = (global.TASUN_APP_VER || "").toString().trim();
    if (v1) return v1;

    const m = document.querySelector('meta[name="tasun-app-ver"]');
    const v2 = (m && (m.getAttribute("content") || "").trim()) || "";
    if (v2) return v2;

    try {
      const u = new URL(location.href);
      const v3 = (u.searchParams.get("v") || "").trim();
      if (v3) return v3;
    } catch (e) {}

    return "";
  }

  // ---------------- withV ----------------
  function setWithV(ver) {
    global.__CACHE_V = ver || "";
    global.__withV = function (url) {
      const vv = (global.__CACHE_V || "").trim();
      if (!vv) return url;
      try {
        const uu = new URL(url, document.baseURI);
        if (uu.origin === location.origin) uu.searchParams.set("v", vv);
        return uu.toString();
      } catch (e) {
        const s = String(url || "");
        return s + (s.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(vv);
      }
    };
    TasunCore.withV = global.__withV;
    return TasunCore.withV;
  }

  // ---------------- toast ----------------
  let _toastEl = null;
  let _toastTimer = 0;

  function ensureToastEl() {
    if (_toastEl) return _toastEl;
    const el = document.createElement("div");
    el.id = "tasunToast_v1";
    el.style.cssText = `
      position:fixed; right:14px; bottom:14px; z-index:99999;
      padding:10px 12px; border-radius:12px;
      font: 14px/1.2 system-ui, -apple-system, "Noto Sans TC", sans-serif;
      background: rgba(18,18,18,.78); color:#fff;
      border:1px solid rgba(255,255,255,.12);
      box-shadow: 0 10px 28px rgba(0,0,0,.35);
      display:none; backdrop-filter: blur(8px);
      max-width:min(360px, calc(100vw - 28px));
      word-break:break-word; pointer-events:none;
    `;
    const mount = () => {
      if (document.body && !document.body.contains(el)) document.body.appendChild(el);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
      mount();
    }
    _toastEl = el;
    return el;
  }

  function toastShow(msg, autoHideMs) {
    clearTimeout(_toastTimer);
    const el = ensureToastEl();
    el.textContent = msg;
    el.style.display = "block";
    if (autoHideMs && autoHideMs > 0) _toastTimer = setTimeout(toastHide, autoHideMs);
  }

  function toastHide() {
    clearTimeout(_toastTimer);
    const el = ensureToastEl();
    el.style.display = "none";
  }

  TasunCore.toast = { show: toastShow, hide: toastHide };

  // ---------------- version sync ----------------
  function ensureVersionSync(cfg) {
    const APP_VER = safeGetAppVer();
    setWithV(APP_VER || "");

    if (!APP_VER) return { appVer: "", redirected: false };

    if (!cfg.forceVersionSync) return { appVer: APP_VER, redirected: false };

    try {
      const VER_KEY = cfg.versionStorageKey;
      const TAB_GUARD = cfg.tabGuardKey;

      const last = localStorage.getItem(VER_KEY) || "";
      if (last !== APP_VER) {
        localStorage.setItem(VER_KEY, APP_VER);
        try { sessionStorage.removeItem(TAB_GUARD); } catch (e) {}
      }

      const u = new URL(location.href);
      const curV = (u.searchParams.get("v") || "").trim();

      const already = (() => {
        try { return sessionStorage.getItem(TAB_GUARD) === "1"; } catch (e) { return false; }
      })();

      if (curV !== APP_VER && !already) {
        try { sessionStorage.setItem(TAB_GUARD, "1"); } catch (e) {}
        u.searchParams.set("v", APP_VER);
        location.replace(u.toString());
        return { appVer: APP_VER, redirected: true };
      }
    } catch (e) {
      // storage 被阻擋就略過
    }

    return { appVer: APP_VER, redirected: false };
  }

  // ---------------- network guard ----------------
  let _pingTimer = 0;

  async function pingOnce(cfg) {
    const v = encodeURIComponent((global.__CACHE_V || Date.now()).toString());
    const url = location.origin + (cfg.pingUrl || "/favicon.ico") + "?v=" + v + "&t=" + Date.now();

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), cfg.pingTimeoutMs);

    try {
      await fetch(url, { cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
      if (navigator.onLine && cfg.toast) toastHide();
      return true;
    } catch (e) {
      clearTimeout(t);
      if (navigator.onLine && cfg.toast) toastShow("連線不穩：Network connection lost. Attempting to reconnect…", 0);
      return false;
    }
  }

  function startNetworkGuard(cfg) {
    if (!cfg.networkGuard) return;

    window.addEventListener("offline", () => {
      if (cfg.toast) toastShow("網路中斷：Network connection lost. Attempting to reconnect…", 0);
    }, { passive: true });

    window.addEventListener("online", () => {
      if (cfg.toast) toastShow("網路已恢復：已重新連線 ✅", 1200);
      try { global.onTasunOnline && global.onTasunOnline(); } catch (e) {}
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") pingOnce(cfg);
    }, { passive: true });

    clearInterval(_pingTimer);
    _pingTimer = setInterval(() => pingOnce(cfg), cfg.pingIntervalMs);
    setTimeout(() => pingOnce(cfg), 1200);
  }

  TasunCore.net = { pingOnce: () => pingOnce(TasunCore._cfg || DEF) };

  // ---------------- fetch tools ----------------
  TasunCore.fetchWithTimeout = async function (url, ms = 8000, opt = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...opt, cache: "no-store", signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  };

  TasunCore.fetchRetry = async function (url, { tries = 3, timeoutMs = 8000, delayMs = 600, opt = {} } = {}) {
    let lastErr;
    for (let i = 1; i <= tries; i++) {
      try {
        return await TasunCore.fetchWithTimeout(url, timeoutMs, opt);
      } catch (e) {
        lastErr = e;
        if (i === tries) break;
        await new Promise(res => setTimeout(res, delayMs * i));
      }
    }
    throw lastErr;
  };

  // ---------------- backup (opt-in) ----------------
  TasunCore.backup = (function () {
    const api = {};

    api.collectKeys = function (includeKeyFn) {
      const keys = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (!includeKeyFn || includeKeyFn(k)) keys.push(k);
        }
      } catch (e) {}
      keys.sort((a, b) => a.localeCompare(b, "zh-Hant"));
      return keys;
    };

    api.snapshot = function ({ reason = "manual", includeKeyFn, sessionStorageKey, app = "Tasun" } = {}) {
      const now = new Date();
      const keys = api.collectKeys(includeKeyFn);
      const data = {};
      keys.forEach(k => {
        const raw = localStorage.getItem(k);
        const parsed = TasunCore.utils.safeJsonParse(raw, null);
        data[k] = (parsed === null && raw !== "null" && raw !== null) ? raw : parsed;
      });

      const sess = sessionStorageKey
        ? TasunCore.utils.safeJsonParse(sessionStorage.getItem(sessionStorageKey) || "null", null)
        : null;

      return {
        meta: {
          app,
          reason: String(reason || "manual"),
          ts: now.toISOString(),
          href: location.href,
          cacheV: (global.__CACHE_V || "")
        },
        session: sess,
        data
      };
    };

    api.ringStore = function ({ ringKey, max = 10, payload }) {
      try {
        const arr = TasunCore.utils.safeJsonParse(localStorage.getItem(ringKey) || "[]", []);
        const next = Array.isArray(arr) ? arr : [];
        next.unshift(payload);
        next.length = Math.min(next.length, max);
        localStorage.setItem(ringKey, JSON.stringify(next));
      } catch (e) {}
    };

    api.patchLocalStorage = function ({ includeKeyFn, onChange } = {}) {
      try {
        const _set = localStorage.setItem.bind(localStorage);
        const _remove = localStorage.removeItem.bind(localStorage);

        if (localStorage.__tasun_patched) return;
        localStorage.__tasun_patched = true;

        localStorage.setItem = function (k, v) {
          _set(k, v);
          try {
            if (!includeKeyFn || includeKeyFn(k)) onChange && onChange("setItem", k);
          } catch (e) {}
        };

        localStorage.removeItem = function (k) {
          _remove(k);
          try {
            if (!includeKeyFn || includeKeyFn(k)) onChange && onChange("removeItem", k);
          } catch (e) {}
        };
      } catch (e) {}
    };

    api.enable = function ({
      ringKey,
      ringMax = 10,
      sessionStorageKey,
      includeKeyFn,
      debounceMs = 350,
      app = "Tasun",
      enableStorageListener = true,
      enableExitSnapshot = true
    } = {}) {
      let timer = 0;
      let pending = "";
      let onceExit = false;

      function schedule(reason) {
        const r = String(reason || "auto");
        pending = pending ? (pending + " | " + r) : r;
        clearTimeout(timer);
        timer = setTimeout(() => {
          const rr = pending || "auto";
          pending = "";
          const payload = api.snapshot({ reason: rr, includeKeyFn, sessionStorageKey, app });
          api.ringStore({ ringKey, max: ringMax, payload });
        }, debounceMs);
      }

      function onExit() {
        if (!enableExitSnapshot) return;
        if (onceExit) return;
        onceExit = true;
        const payload = api.snapshot({ reason: "exit/pagehide", includeKeyFn, sessionStorageKey, app });
        api.ringStore({ ringKey, max: ringMax, payload });
      }

      api.patchLocalStorage({
        includeKeyFn,
        onChange: (op, k) => schedule("save:" + op + ":" + k)
      });

      if (enableStorageListener) {
        window.addEventListener("storage", (e) => {
          if (!e || !e.key) return;
          if (!includeKeyFn || includeKeyFn(e.key)) schedule("storage:" + e.key);
        });
      }

      if (enableExitSnapshot) {
        window.addEventListener("pagehide", onExit, { passive: true });
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "hidden") onExit();
        }, { passive: true });
      }

      return { schedule };
    };

    return api;
  })();

  // ---------------- init ----------------
  TasunCore.init = function (options) {
    const cfg = { ...DEF, ...(options || {}) };
    TasunCore._cfg = cfg;

    const sync = ensureVersionSync(cfg);
    if (sync.redirected) return sync;

    if (cfg.autoInitToastMount && cfg.toast) ensureToastEl();
    startNetworkGuard(cfg);

    return sync;
  };

  // export
  global.TasunCore = TasunCore;

})(window);
