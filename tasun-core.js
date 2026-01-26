/*! Tasun Core - shared utilities for all pages (version sync / withV / network guard / backup ring)
 *  Put this file in the SAME folder as all html pages.
 *  Usage (in HTML head):
 *    <script>window.TASUN_APP_VER="20260126_01";</script>
 *    <script src="./tasun-core.js"></script>
 *    <script>TasunCore.forceVersionSync({ verKey:"tasun_app_ver_index_v1" });</script>
 */
(function (w) {
  "use strict";

  if (w.TasunCore && w.TasunCore.__isLoaded) return;

  const Core = {};
  Core.__isLoaded = true;
  Core.VERSION = "20260126_01_core";

  // ---------- small utils ----------
  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function getAppVer() {
    return (w.TASUN_APP_VER || w.__TASUN_APP_VER || "").toString().trim();
  }

  function setCacheV(v) {
    w.__CACHE_V = String(v || "").trim();
    if (!w.__CACHE_V) return;
    // also keep a stable alias for debugging
    w.__TASUN_APP_VER = w.__CACHE_V;
  }

  function withV(url) {
    const vv = (w.__CACHE_V || getAppVer() || "").toString().trim();
    if (!vv) return url;
    try {
      const uu = new URL(url, document.baseURI);
      if (uu.origin === location.origin) uu.searchParams.set("v", vv);
      return uu.toString();
    } catch (e) {
      const s = String(url || "");
      return s + (s.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }

  function hrefToDom(href) {
    const h = String(href || "").trim();
    if (!h) return "#";
    if (/^https?:\/\//i.test(h)) return h;
    if (/^mailto:/i.test(h)) return h;
    return withV(encodeURI(h));
  }

  function labelToFile(label) {
    let s = String(label || "").trim();
    if (!s) return "#";
    if (s.endsWith(".html")) return s;
    s = s.replace(/[\\\/:*?"<>|]/g, "").trim();
    s = s.replace(/\s+/g, "");
    return s + ".html";
  }

  Core.util = { safeJsonParse, clamp, lerp, hrefToDom, labelToFile };

  // export globally (compat)
  w.__withV = w.__withV || withV;

  Core.getAppVer = getAppVer;
  Core.setCacheV = setCacheV;
  Core.withV = withV;
  Core.hrefToDom = hrefToDom;
  Core.labelToFile = labelToFile;

  // ---------- Version Sync ----------
  Core.forceVersionSync = function (opts) {
    const o = opts || {};
    const appVer = (o.appVer ? String(o.appVer) : getAppVer()).trim();
    if (!appVer) return { ok: false, reason: "no_app_ver" };

    const verKey = o.verKey || "tasun_app_ver_global_v1";
    const tabGuardKey = o.tabGuardKey || "tasun_tab_replaced_once_v1";

    // make withV consistent first
    setCacheV(appVer);

    let u;
    try { u = new URL(location.href); } catch (e) { return { ok: false, reason: "bad_url" }; }

    // track seen version
    try {
      const last = localStorage.getItem(verKey) || "";
      if (last !== appVer) {
        localStorage.setItem(verKey, appVer);
        try { sessionStorage.removeItem(tabGuardKey); } catch (e) { }
      }
    } catch (e) { }

    const curV = (u.searchParams.get("v") || "").trim();
    const alreadyReplaced = (() => {
      try { return sessionStorage.getItem(tabGuardKey) === "1"; } catch (e) { return false; }
    })();

    if (curV !== appVer && !alreadyReplaced) {
      try { sessionStorage.setItem(tabGuardKey, "1"); } catch (e) { }
      u.searchParams.set("v", appVer);
      location.replace(u.toString());
      return { ok: true, replaced: true };
    }
    return { ok: true, replaced: false };
  };

  // ---------- Preload helpers ----------
  Core.fixPreloadLink = function (linkId) {
    try {
      const el = document.getElementById(linkId);
      if (!el) return false;
      const href = el.getAttribute("href") || el.href;
      el.href = withV(href);
      return true;
    } catch (e) { return false; }
  };

  Core.fixImgSrc = function (imgId) {
    try {
      const img = document.getElementById(imgId);
      if (!img) return false;
      const src = img.getAttribute("src") || img.src;
      img.src = withV(src);
      return true;
    } catch (e) { return false; }
  };

  // ---------- Network Guard (avoid "offline confusion" on pages) ----------
  // Note: This is for your own pages (not ChatGPT UI). It shows a small toast when offline.
  Core.netGuard = (function () {
    const NG = {};
    let inited = false;
    let node = null;
    let timer = 0;

    function ensureNode() {
      if (node) return node;
      node = document.createElement("div");
      node.id = "tasunNetToast";
      node.style.cssText = [
        "position:fixed",
        "right:14px",
        "bottom:14px",
        "z-index:2147483647",
        "padding:10px 14px",
        "border-radius:999px",
        "border:1px solid rgba(246,211,122,.55)",
        "background:rgba(0,0,0,.40)",
        "backdrop-filter:blur(10px) saturate(1.1)",
        "-webkit-backdrop-filter:blur(10px) saturate(1.1)",
        "color:rgba(255,226,160,.98)",
        "font:700 13px/1.2 system-ui, -apple-system, Segoe UI, Arial",
        "letter-spacing:.06em",
        "display:none",
        "box-shadow:0 16px 32px rgba(0,0,0,.35), 0 0 18px rgba(246,211,122,.18)"
      ].join(";");
      document.documentElement.appendChild(node);
      return node;
    }

    function show(msg, persist) {
      try {
        const el = ensureNode();
        el.textContent = msg;
        el.style.display = "block";
        clearTimeout(timer);
        if (!persist) timer = setTimeout(hide, 2500);
      } catch (e) { }
    }

    function hide() {
      try {
        if (!node) return;
        node.style.display = "none";
      } catch (e) { }
    }

    function onOnline() {
      show("網路已恢復 ✓", false);
      setTimeout(hide, 900);
    }

    function onOffline() {
      show("目前離線…請檢查網路", true);
    }

    NG.init = function () {
      if (inited) return;
      inited = true;

      // delay to DOM ready for safety
      const run = () => {
        try {
          window.addEventListener("online", onOnline, { passive: true });
          window.addEventListener("offline", onOffline, { passive: true });
          if (!navigator.onLine) onOffline();
        } catch (e) { }
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
      } else {
        run();
      }
    };

    NG.show = show;
    NG.hide = hide;
    return NG;
  })();

  // ---------- Backup Ring (auto save to localStorage, manual download only) ----------
  Core.backup = (function () {
    const BK = {};
    let inited = false;

    // internal state (shared across pages)
    const S = {
      exportTimer: 0,
      pendingReason: "",
      onceExit: false,
      patched: false,

      shouldIncludeKey: null,

      sessionKey: "tasunSessionLogin_v1",
      ringKey: "tasunBackupRing_v1",
      ringMax: 10,

      // optional: include extra session JSON from sessionStorage[sessionKey]
      includeSession: true
    };

    function defaultShouldIncludeKey(k) {
      const key = String(k || "");
      return (
        key.startsWith("tasun") ||
        key.includes("汐東") ||
        key.includes("捷運") ||
        key.includes("水環") ||
        key.includes("審查") ||
        key.includes("文件") ||
        key.includes("資料庫")
      );
    }

    function collectPayload(reason) {
      const now = new Date();
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const ok = (S.shouldIncludeKey || defaultShouldIncludeKey)(k);
        if (ok) keys.push(k);
      }
      keys.sort((a, b) => a.localeCompare(b, "zh-Hant"));

      const data = {};
      keys.forEach(k => {
        const raw = localStorage.getItem(k);
        const parsed = safeJsonParse(raw, null);
        data[k] = (parsed === null && raw !== "null" && raw !== null) ? raw : parsed;
      });

      let sess = null;
      if (S.includeSession && S.sessionKey) {
        sess = safeJsonParse(sessionStorage.getItem(S.sessionKey) || "null", null);
      }

      return {
        meta: {
          app: "Tasun Backup",
          reason: String(reason || "manual"),
          ts: now.toISOString(),
          href: location.href,
          cacheV: (w.__CACHE_V || "")
        },
        session: sess,
        data
      };
    }

    function storeRing(payload) {
      try {
        const arr = safeJsonParse(localStorage.getItem(S.ringKey) || "[]", []);
        const next = Array.isArray(arr) ? arr : [];
        next.unshift(payload);
        next.length = Math.min(next.length, S.ringMax);
        localStorage.setItem(S.ringKey, JSON.stringify(next));
      } catch (e) { }
    }

    function downloadJson(payload) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `Tasun備份_${ts}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 0);
    }

    function exportNow(reason, opts) {
      const o = opts || {};
      const payload = collectPayload(reason);
      storeRing(payload);
      if (o.download) {
        try { downloadJson(payload); } catch (e) { }
      }
      return payload;
    }

    function schedule(reason) {
      const r = String(reason || "auto");
      S.pendingReason = S.pendingReason ? (S.pendingReason + " | " + r) : r;
      clearTimeout(S.exportTimer);
      S.exportTimer = setTimeout(() => {
        const rr = S.pendingReason || "auto";
        S.pendingReason = "";
        exportNow(rr, { download: false });
      }, 350);
    }

    function tryOnExit() {
      if (S.onceExit) return;
      S.onceExit = true;
      exportNow("exit/pagehide", { download: false });
    }

    function patchLocalStorage() {
      if (S.patched) return;
      S.patched = true;

      try {
        const _set = localStorage.setItem.bind(localStorage);
        const _remove = localStorage.removeItem.bind(localStorage);

        localStorage.setItem = function (k, v) {
          _set(k, v);
          const ok = (S.shouldIncludeKey || defaultShouldIncludeKey)(k);
          if (ok) schedule("save:setItem:" + k);
        };
        localStorage.removeItem = function (k) {
          _remove(k);
          const ok = (S.shouldIncludeKey || defaultShouldIncludeKey)(k);
          if (ok) schedule("save:removeItem:" + k);
        };
      } catch (e) { }

      // cross-tab changes
      try {
        window.addEventListener("storage", (e) => {
          if (!e || !e.key) return;
          const ok = (S.shouldIncludeKey || defaultShouldIncludeKey)(e.key);
          if (ok) schedule("storage:" + e.key);
        });
      } catch (e) { }

      // exit/visibility
      try {
        window.addEventListener("pagehide", tryOnExit, { passive: true });
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "hidden") tryOnExit();
        }, { passive: true });
      } catch (e) { }
    }

    BK.init = function (opts) {
      if (inited) return;
      inited = true;

      const o = opts || {};
      S.sessionKey = o.sessionKey || S.sessionKey;
      S.ringKey = o.ringKey || S.ringKey;
      S.ringMax = Number(o.ringMax || S.ringMax) || 10;
      S.shouldIncludeKey = (typeof o.shouldIncludeKey === "function") ? o.shouldIncludeKey : null;
      S.includeSession = (o.includeSession === false) ? false : true;

      patchLocalStorage();
    };

    BK.exportNow = exportNow;
    BK.schedule = schedule;
    BK.tryOnExit = tryOnExit;
    return BK;
  })();

  // ---------- Minimal init helper ----------
  Core.init = function (opts) {
    const o = opts || {};
    if (o.forceVersionSync !== false) {
      Core.forceVersionSync({
        verKey: o.verKey || "tasun_app_ver_global_v1",
        tabGuardKey: o.tabGuardKey || "tasun_tab_replaced_once_v1",
        appVer: o.appVer
      });
    }
    if (o.networkGuard) Core.netGuard.init();
    if (o.backup) {
      Core.backup.init(o.backup === true ? {} : o.backup);
    }
  };

  w.TasunCore = Core;

})(window);
