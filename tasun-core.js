/* tasun-core.js (Tasun Core) - Cloud Sync STANDARD v1 Ready */
(function (window, document) {
  "use strict";

  var TasunCore = window.TasunCore || {};
  var CORE_VER = "20260212_01"; // ←你可自行改（建議跟 APP_VER 同節奏）

  function str(v) { return (v === undefined || v === null) ? "" : String(v); }

  function jsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ✅ raf debounce（避免 resize/scroll 過度計算）
  function rafDebounce(fn) {
    var r = 0;
    return function () {
      try { window.cancelAnimationFrame(r); } catch (e) {}
      r = window.requestAnimationFrame(function () {
        try { fn(); } catch (e) {}
      });
    };
  }

  // ✅ fonts ready helper
  function onFontsReady(cb) {
    cb = cb || function () {};
    try {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(cb);
      else setTimeout(cb, 180);
    } catch (e) {
      setTimeout(cb, 180);
    }
  }

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
      var s = str(url || "");
      if (!s) return s;
      return s + (s.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }

  // ===== scope helper（版本同步用）=====
  function scopeSuffix(scope, pageKey) {
    scope = str(scope || "").trim().toLowerCase();
    if (scope === "page" && pageKey) return "_" + pageKey;
    return ""; // global
  }

  // ✅強制 URL v 必須等於 APP_VER（舊書籤也會被跳到最新）
  function forceUrlV(appVer, pageKey, scope) {
    try {
      var v = str(appVer || "").trim();
      if (!v) return false;

      var u = new URL(window.location.href);
      var cur = str(u.searchParams.get("v") || "").trim();

      // 避免無限 replace：用「目前v+目標v+scope+頁」當 guard
      var suf = scopeSuffix(scope, pageKey);
      var KEY = "tasun_force_url_guard_v1" + suf + "_" + (cur || "none") + "_to_" + v;

      if (cur !== v && !sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        u.searchParams.set("v", v);
        window.location.replace(u.toString());
        return true;
      }
    } catch (e) {}
    return false;
  }

  // 替同源資源補 v（img/link/script）
  function patchResourceUrls() {
    var vv = str(window.__CACHE_V || "").trim();
    if (!vv) return;

    function patchAttr(el, attr) {
      try {
        var val = el.getAttribute(attr);
        if (!val) return;
        if (/^(data:|blob:|mailto:|tel:)/i.test(val)) return;

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

  // ===== 版本同步（避免不同裝置顯示不同版本）=====
  // ✅STANDARD v1 建議用 global scope（整站同 APP_VER）
  function forceVersionSync(appVer, pageKey, scope) {
    var v = str(appVer || "").trim();
    if (!v) return false;

    var suf = scopeSuffix(scope, pageKey);
    var KEY = "tasun_app_ver_global_v1" + suf;
    var TAB_GUARD = "tasun_tab_replaced_once_v1" + suf;

    try {
      var last = str(localStorage.getItem(KEY) || "");
      if (last !== v) {
        localStorage.setItem(KEY, v);
        try { sessionStorage.removeItem(TAB_GUARD); } catch (e) {}
      }

      var u = new URL(window.location.href);
      var curV = str(u.searchParams.get("v") || "").trim();

      var already = false;
      try { already = (sessionStorage.getItem(TAB_GUARD) === "1"); } catch (e2) { already = false; }

      if (curV !== v && !already) {
        try { sessionStorage.setItem(TAB_GUARD, "1"); } catch (e3) {}
        u.searchParams.set("v", v);
        window.location.replace(u.toString());
        return true;
      }
    } catch (e4) {}

    return false;
  }

  // ===== 網路狀態提示 =====
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
      "box-shadow:0 18px 40px rgba(0,0,0,.30);}" +
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

  // ✅ appHeightVar：統一用 visualViewport 設定 --appH
  function setAppHeightVar() {
    var apply = rafDebounce(function () {
      try {
        var h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty("--appH", h + "px");
      } catch (e) {}
    });

    apply();
    window.addEventListener("resize", apply, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", apply, { passive: true });
      window.visualViewport.addEventListener("scroll", apply, { passive: true });
    }
  }

  /* ======================================================
     ✅ STANDARD v1 工具：pageKey / deviceId / Probe / Cloud wrapper
     ====================================================== */

  function fileName() {
    try {
      var p = new URL(window.location.href).pathname || "";
      var seg = p.split("/");
      var f = seg[seg.length - 1] || "index.html";
      return f;
    } catch (e) {
      return "index.html";
    }
  }

  function metaContent(name) {
    try {
      var el = document.querySelector('meta[name="' + name + '"]');
      return el ? str(el.getAttribute("content") || "").trim() : "";
    } catch (e) {
      return "";
    }
  }

  // ✅ pageKey 最穩：優先使用明確指定（window.TASUN_PAGE_KEY / meta / opts.pageKey）
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

  // ✅ deviceId（多設備識別，用於 requestId 組合）
  function randomUid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "u" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
  }

  function getDeviceId() {
    var KEY = "tasunDeviceId_v1";
    var did = "";
    try { did = str(localStorage.getItem(KEY) || "").trim(); } catch (e) { did = ""; }
    if (!did) {
      did = "d_" + randomUid();
      try { localStorage.setItem(KEY, did); } catch (e2) {}
    }
    return did;
  }

  // ✅ Probe：掃 local/sessionStorage 內「看起來是資料陣列」的 key
  function probeStorage(printToConsole) {
    function scanStore(store, label) {
      var keys = [];
      for (var i = 0; i < store.length; i++) keys.push(store.key(i));
      keys.sort();

      var candidates = [];
      for (var j = 0; j < keys.length; j++) {
        var k = keys[j];
        var v = "";
        try { v = store.getItem(k); } catch (e) { v = ""; }
        if (!v || v.length < 2) continue;
        if (v.length > 2000000) continue;

        var obj = jsonParse(v, null);
        if (!obj) continue;

        var arr = null;
        if (Array.isArray(obj)) arr = obj;
        else if (obj && Array.isArray(obj.items)) arr = obj.items;
        else if (obj && Array.isArray(obj.rows)) arr = obj.rows;
        else if (obj && Array.isArray(obj.db)) arr = obj.db;

        if (!arr) continue;

        var sample0 = arr[0];
        var sampleKeys = [];
        if (sample0 && typeof sample0 === "object") {
          for (var kk in sample0) if (Object.prototype.hasOwnProperty.call(sample0, kk)) sampleKeys.push(kk);
        } else {
          sampleKeys = [typeof sample0];
        }

        candidates.push({ key: k, len: arr.length, sampleKeys: sampleKeys.slice(0, 30), store: label });
      }

      candidates.sort(function (a, b) { return (b.len || 0) - (a.len || 0); });

      if (printToConsole) {
        try {
          console.log("[Probe] " + label + " keys(" + keys.length + ") =", keys);
          if (console.table) console.table(candidates.slice(0, 20));
          console.log("[Probe] " + label + " topCandidate =", (candidates[0] && candidates[0].key) ? candidates[0].key : "(none)");
        } catch (e2) {}
      }

      return candidates;
    }

    var out = {
      fileName: fileName(),
      pageKeyGuess: resolvePageKey({}),
      localStorage: [],
      sessionStorage: []
    };

    try { out.localStorage = scanStore(localStorage, "localStorage"); } catch (e3) { out.localStorage = []; }
    try { out.sessionStorage = scanStore(sessionStorage, "sessionStorage"); } catch (e4) { out.sessionStorage = []; }

    return out;
  }

  // ✅ Cloud wrapper（呼叫 tasun-cloud-kit.js STANDARD v1）
  // - pk=uid、必備欄位由 tasun-cloud-kit.js 端負責 ensure
  function cloudMountV1(cfg) {
    cfg = cfg || {};
    if (!window.TasunCloudKit || !window.TasunCloudKit.mount) {
      throw new Error("TasunCloudKit not found. Please include tasun-cloud-kit.js before mounting.");
    }

    var pageKey = resolvePageKey(cfg);
    if (!pageKey) throw new Error("cloudMountV1 missing pageKey/resourceKey");

    // user/role 預設取 Auth.current()
    var userFn = (typeof cfg.user === "function") ? cfg.user : function () {
      try {
        var u = TasunCore.Auth && TasunCore.Auth.current ? TasunCore.Auth.current() : null;
        return u && u.username ? u.username : "";
      } catch (e) { return ""; }
    };
    var roleFn = (typeof cfg.role === "function") ? cfg.role : function () {
      try {
        return TasunCore.Auth && TasunCore.Auth.role ? TasunCore.Auth.role() : "";
      } catch (e) { return ""; }
    };

    // init CloudKit（可以重複呼叫，CloudKit 本身會處理）
    try {
      window.TasunCloudKit.init({
        appVer: getAppVer(cfg.appVer),
        resourcesUrl: cfg.resourcesUrl || "tasun-resources.json",
        ui: cfg.ui || undefined
      });
    } catch (e2) {}

    // mount
    return window.TasunCloudKit.mount({
      resourcesUrl: cfg.resourcesUrl || "tasun-resources.json",
      resourcesInline: cfg.resourcesInline || null,

      resourceKey: pageKey, // ✅ pageKey=resourceKey（每頁獨立資料集最穩）

      // pk 由 CloudKit STANDARD v1 強制 uid
      // pk: "uid" (不要傳，避免干擾)

      accessTokenKey: cfg.accessTokenKey || cfg.accessKey || "tasunAccessServiceToken_v1",
      accessToken: cfg.accessToken || null,

      watch: cfg.watch || { intervalSec: 0 },
      protectEmptyRemote: (cfg.protectEmptyRemote !== undefined) ? !!cfg.protectEmptyRemote : true,
      canSeed: (typeof cfg.canSeed === "function") ? cfg.canSeed : function () { return true; },

      user: userFn,
      role: roleFn,

      getLocal: cfg.getLocal,
      apply: cfg.apply
    });
  }

  // ===== init =====
  function init(opts) {
    opts = opts || {};

    // ✅ STANDARD v1 建議：版本同步預設用 global scope（整站一致）
    var verScope = str(opts.verScope || "global").trim().toLowerCase();
    if (verScope !== "page") verScope = "global";

    var pageKey = str(opts.pageKey || "").trim();
    var appVer = getAppVer(opts.appVer);

    if (opts.appHeightVar) {
      try { setAppHeightVar(); } catch (e) {}
    }

    if (appVer) {
      ensureCacheV(appVer);

      // ✅你要求的：強制 URL v 必須等於 APP_VER（早做，避免後面多跑）
      if (opts.forceUrlV) {
        var replacedUrl = forceUrlV(appVer, pageKey, verScope);
        if (replacedUrl) return;
      }

      if (opts.forceVersionSync !== false) {
        var replaced = forceVersionSync(appVer, pageKey, verScope);
        if (replaced) return;
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

    // ✅提供給頁面：core ready 事件（給 tasun-boot / 各頁等待用）
    try { window.dispatchEvent(new CustomEvent("tasun:core-ready")); } catch (e2) {}
  }

  /* ======================================================
     ✅✅✅ TasunCore.Auth（搬進 core）
     - 使用 localStorage: tasunAuthTable_v1 / tasunCurrentUser_v1
     - 密碼變更/帳號移除：自動強制重新登入
     - 提供 ensureLoggedIn / open / close / role / canWrite / isAdmin
     ====================================================== */
  TasunCore.Auth = (function (Core) {
    var CURRENT_KEY = "tasunCurrentUser_v1";
    var AUTH_KEY = "tasunAuthTable_v1";
    var SESSION_WATCH_MS = 3000;

    var currentUser = null;
    var _watchStarted = false;
    var _onAuthed = null;
    var _onSessionChange = null;
    var _onForceRelogin = null;

    function norm(s) { return (s === undefined || s === null) ? "" : String(s).trim(); }

    function mapRole(v) {
      var s = norm(v).toLowerCase();
      if (!s) return "read";
      if (s === "admin") return "admin";
      if (s === "write" || s === "edit") return "write";
      if (s === "read" || s === "view") return "read";
      if (s === "0") return "admin";
      if (s === "1") return "write";
      if (s === "2") return "read";
      return s;
    }

    function loadAuthTable() {
      try {
        var raw = localStorage.getItem(AUTH_KEY);
        if (!raw) return [];
        var parsed = Core.jsonParse(raw, null);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.users)) return parsed.users;
        return [];
      } catch (e) { return []; }
    }

    function pickUsername(row) {
      return norm(row && (row.username != null ? row.username : (row.user != null ? row.user : (row.account != null ? row.account : row.name))));
    }
    function pickPassword(row) {
      return String((row && (row.password != null ? row.password : (row.pass != null ? row.pass : row.pwd))) != null ? (row.password != null ? row.password : (row.pass != null ? row.pass : row.pwd)) : "");
    }
    function pickRole(row) {
      return mapRole(row && (row.role != null ? row.role : (row.level != null ? row.level : (row.perm != null ? row.perm : row.permission))));
    }

    function findAuthUser(username) {
      var u = norm(username).toLowerCase();
      if (!u) return null;
      var rows = loadAuthTable();
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var ru = pickUsername(r).toLowerCase();
        if (ru && ru === u) {
          return { username: pickUsername(r), password: pickPassword(r), role: pickRole(r) || "read" };
        }
      }
      return null;
    }

    function fnv1a(s) {
      s = String(s || "");
      var h = 0x811c9dc5;
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0).toString(16).padStart(8, "0");
    }
    function authStampFromAuth(auth) {
      return fnv1a(String(auth.username || "") + "|" + String(auth.password != null ? auth.password : ""));
    }

    function loadCurrentUser() {
      try { currentUser = Core.jsonParse(localStorage.getItem(CURRENT_KEY) || "null", null); }
      catch (e) { currentUser = null; }

      if (currentUser && typeof currentUser === "object") {
        var uname = norm(currentUser.username != null ? currentUser.username : (currentUser.user != null ? currentUser.user : (currentUser.name != null ? currentUser.name : currentUser.account)));
        if (uname) currentUser.username = uname;

        var r = mapRole(currentUser.role != null ? currentUser.role : (currentUser.level != null ? currentUser.level : "read"));
        currentUser.role = r;
        currentUser.level = r;

        currentUser.authStamp = String(currentUser.authStamp != null ? currentUser.authStamp : "");
      }
    }

    function setCurrentUser(username, role, authStamp) {
      var u = {
        username: username,
        user: username,
        role: mapRole(role),
        level: mapRole(role),
        authStamp: String(authStamp || "")
      };
      try { localStorage.setItem(CURRENT_KEY, JSON.stringify(u)); } catch (e) {}
      currentUser = u;
    }

    function current() {
      loadCurrentUser();
      return currentUser;
    }

    function role() {
      loadCurrentUser();
      return mapRole(currentUser && (currentUser.role != null ? currentUser.role : (currentUser.level != null ? currentUser.level : "read")));
    }
    function canWrite() {
      var r = role();
      return (r === "admin" || r === "write");
    }
    function isAdmin() {
      return role() === "admin";
    }

    // ===== UI 綁定（由頁面提供 id；保持你現有 DOM 不變）=====
    function $(id) { return document.getElementById(id); }

    function rebuildUserDropdown(preselectUser) {
      var sel = $("loginUser");
      if (!sel) return;

      var rows = loadAuthTable();
      var users = [];
      for (var i = 0; i < rows.length; i++) {
        var u = pickUsername(rows[i]);
        if (u) users.push(u);
      }

      // uniq
      var seen = {};
      var uniq = [];
      for (var j = 0; j < users.length; j++) {
        var k = users[j].toLowerCase();
        if (seen[k]) continue;
        seen[k] = 1;
        uniq.push(users[j]);
      }

      var html = '<option value="">請選擇帳號</option>';
      for (var m = 0; m < uniq.length; m++) {
        var u2 = uniq[m];
        var s = (preselectUser && u2.toLowerCase() === preselectUser.toLowerCase()) ? "selected" : "";
        var vv = u2.replace(/"/g, "&quot;");
        html += '<option value="' + vv + '" ' + s + ">" + u2 + "</option>";
      }
      sel.innerHTML = html;
    }

    function open(msg) {
      var mask = $("loginMask");
      var err = $("loginErr");
      if (!mask) return;

      if (err) {
        err.style.display = "none";
        if (msg) {
          err.textContent = msg;
          err.style.display = "block";
        }
      }

      loadCurrentUser();
      rebuildUserDropdown(currentUser && currentUser.username ? currentUser.username : "");
      var pass = $("loginPass");
      if (pass) pass.value = "";

      mask.classList.add("show");
      mask.setAttribute("aria-hidden", "false");

      setTimeout(function () {
        var userSel = $("loginUser");
        var passEl = $("loginPass");
        if (userSel && userSel.value && passEl) passEl.focus();
        else if (userSel) userSel.focus();
      }, 0);
    }

    function close() {
      var mask = $("loginMask");
      if (!mask) return;
      mask.classList.remove("show");
      mask.setAttribute("aria-hidden", "true");
    }

    function fireSessionChange() {
      if (typeof _onSessionChange === "function") _onSessionChange(current());
    }

    function forceReLogin(msg) {
      try { localStorage.removeItem(CURRENT_KEY); } catch (e) {}
      currentUser = null;

      if (typeof _onForceRelogin === "function") _onForceRelogin(msg || "");
      open(msg || "權限表已更新，請重新登入");
      fireSessionChange();
    }

    function validateSession() {
      var mask = $("loginMask");
      if (mask && mask.classList.contains("show")) return;

      loadCurrentUser();
      if (!currentUser || !currentUser.username) return;

      var auth = findAuthUser(currentUser.username);
      if (!auth) { forceReLogin("帳號已被移除，請重新登入"); return; }

      var stampNow = authStampFromAuth(auth);

      // 第一次補 stamp
      if (!currentUser.authStamp) {
        setCurrentUser(auth.username, auth.role || "read", stampNow);
        fireSessionChange();
        return;
      }

      if (currentUser.authStamp !== stampNow) {
        forceReLogin("密碼已更新，請重新登入");
        return;
      }

      var r = auth.role || "read";
      if (mapRole(currentUser.role) !== r) {
        setCurrentUser(auth.username, r, stampNow);
        fireSessionChange();
      }
    }

    function ensureLoggedIn() {
      loadCurrentUser();
      var rows = loadAuthTable();
      if (!Array.isArray(rows) || rows.length === 0) {
        open("尚未建立權限表：請先到「權限表.html」建立帳號。");
        return false;
      }

      if (!currentUser || !currentUser.username) {
        open();
        return false;
      }

      var auth = findAuthUser(currentUser.username);
      if (!auth) { forceReLogin("帳號已被移除，請重新登入"); return false; }

      var stampNow = authStampFromAuth(auth);
      if (currentUser.authStamp && currentUser.authStamp !== stampNow) {
        forceReLogin("密碼已更新，請重新登入");
        return false;
      }

      setCurrentUser(auth.username, auth.role || "read", stampNow);
      fireSessionChange();
      return true;
    }

    function doLogin() {
      var userSel = $("loginUser");
      var passEl = $("loginPass");
      var err = $("loginErr");

      var u = norm(userSel ? userSel.value : "");
      var p = String(passEl ? passEl.value : "");
      var rows = loadAuthTable();

      function showErr(m) {
        if (!err) return;
        err.textContent = m;
        err.style.display = "block";
      }

      if (!Array.isArray(rows) || rows.length === 0) return showErr("尚未建立權限表：請先到「權限表.html」建立帳號。");
      if (!u) return showErr("請先選擇帳號。");
      if (!p) return showErr("請輸入密碼。");

      var auth = findAuthUser(u);
      if (!auth) return showErr("帳號不存在（以權限表為準）。");
      if (String(auth.password != null ? auth.password : "") !== p) return showErr("密碼錯誤（以權限表為準）。");

      var stampNow = authStampFromAuth(auth);
      setCurrentUser(auth.username, auth.role || "read", stampNow);

      close();
      fireSessionChange();
      if (typeof _onAuthed === "function") _onAuthed(current());
    }

    function bindUI() {
      var closeBtn = $("loginClose");
      var toAuth = $("loginToAuth");
      var loginBtn = $("loginBtn");
      var mask = $("loginMask");
      var userSel = $("loginUser");

      if (closeBtn) closeBtn.onclick = close;
      if (toAuth) toAuth.onclick = function () { window.location.href = Core.withV("權限表.html"); };
      if (loginBtn) loginBtn.onclick = doLogin;

      if (userSel) {
        userSel.addEventListener("change", function () {
          var pass = $("loginPass");
          if (userSel.value && pass) pass.focus();
        });
      }

      if (mask) {
        mask.addEventListener("click", function (e) {
          if (e.target === mask) close();
        });
      }

      window.addEventListener("keydown", function (e) {
        var m = $("loginMask");
        if (!m) return;
        if (e.key === "Escape" && m.classList.contains("show")) close();
        if (e.key === "Enter" && m.classList.contains("show")) doLogin();
      });
    }

    function startWatch() {
      if (_watchStarted) return;
      _watchStarted = true;

      window.addEventListener("storage", function (e) {
        if (e.key === AUTH_KEY || e.key === CURRENT_KEY) {
          validateSession();
        }
      });
      setInterval(validateSession, SESSION_WATCH_MS);
    }

    function init(opts) {
      opts = opts || {};
      _onAuthed = opts.onAuthed || null;
      _onSessionChange = opts.onSessionChange || null;
      _onForceRelogin = opts.onForceRelogin || null;

      bindUI();
      startWatch();
    }

    return {
      init: init,
      ensureLoggedIn: ensureLoggedIn,
      validateSession: validateSession,
      open: open,
      close: close,
      current: current,
      role: role,
      canWrite: canWrite,
      isAdmin: isAdmin
    };
  })(TasunCore);

  // ===== 對外 API =====
  TasunCore.coreVer = CORE_VER;
  TasunCore.jsonParse = jsonParse;
  TasunCore.clamp = clamp;
  TasunCore.lerp = lerp;

  TasunCore.rafDebounce = rafDebounce;
  TasunCore.onFontsReady = onFontsReady;
  TasunCore.setAppHeightVar = setAppHeightVar;

  TasunCore.withV = function (url) { return withV(url); };
  TasunCore.forceUrlV = function (appVer, pageKey, scope) { return forceUrlV(appVer, pageKey, scope); };
  TasunCore.forceVersionSync = function (appVer, pageKey, scope) { return forceVersionSync(appVer, pageKey, scope); };
  TasunCore.patchResourceUrls = function () { return patchResourceUrls(); };
  TasunCore.installNetToast = function () { return installNetToast(); };
  TasunCore.init = init;

  // ✅ STANDARD v1 exports
  TasunCore.Page = {
    fileName: fileName,
    resolvePageKey: resolvePageKey
  };
  TasunCore.getDeviceId = getDeviceId;
  TasunCore.probeStorage = function (printToConsole) { return probeStorage(!!printToConsole); };

  TasunCore.CloudV1 = {
    PK: "uid",
    REQUIRED_FIELDS: ["uid", "rev", "updatedAt", "deleted"],
    mount: cloudMountV1
  };

  window.__withV = window.__withV || TasunCore.withV;
  window.TasunCore = TasunCore;

})(window, document);
