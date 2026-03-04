
/* =========================================================
 * Tasun V6.5 Global Auth (Enterprise) [forceAll]
 * - 全站強制驗證（同一組雲端密碼）
 * - Worker-first：自動偵測 apiBase（from tasun-resources.json / window.TASUN_API_BASE）
 * - SHA-256：只比對 hash，不存明碼（session/localStorage 都不存明碼）
 * - 防爆破：錯誤次數/鎖定（exponential backoff）
 * - 自動登出：閒置逾時 + 強制 TTL
 * - Cache-bust：支援 TASUN_APP_VER
 *
 * 依賴：無（純原生）。建議放在 <head> 最前面。
 *
 * 雲端資料來源（自動嘗試多個 key）：
 *   1) auth-table
 *   2) tasun-auth
 *   3) tasunGlobalAuth_v1
 *   4) fallback：localStorage(tasunAuthTable_v1)
 *
 * 期望的雲端 payload（任一格式即可）：
 *   A) { globalPassHash:"<sha256hex>", users:[{username, role, ...}] }
 *   B) { items:[{username, role, passHash:"<sha256hex>", ...}] }  // 若無 globalPassHash，會使用第一個有 passHash 的當全站密碼
 *   C) 直接 array：[{username, role, passHash, ...}]
 * ========================================================= */
(function () {
  "use strict";

  // ---------- Config (can override before script loads) ----------
  var CFG = window.TASUN_AUTH_CFG || {};
  var APP_VER = String(CFG.appVer || window.TASUN_APP_VER || "").trim();

  // 全站強制驗證（Enterprise：每頁皆強制，忽略 page override）
  var FORCE_AUTH = true; // ✅ 全站強制（忽略每頁 override）
// Idle timeout / TTL (ms)
  var IDLE_MS = Number(CFG.idleMs || (30 * 60 * 1000));     // 30 min
  var TTL_MS  = Number(CFG.ttlMs  || (8  * 60 * 60 * 1000)); // 8 hr

  // Lockout policy
  var MAX_FAIL_BEFORE_LOCK = Number(CFG.maxFail || 5);
  var LOCK_BASE_MS = Number(CFG.lockBaseMs || (30 * 1000)); // 30s base (expo)

  // Storage keys
  var S_SESSION = "tasunAuthSession_v65";
  var S_FAILMAP = "tasunAuthFailMap_v65";
  var S_AUTH_LS = "tasunAuthTable_v1";          // legacy local auth cache
  var S_CUR_LS  = "tasunCurrentUser_v1";        // legacy current user
  var S_LASTACT = "tasunAuthLastAct_v65";

  // Cloud auth keys to try (Worker read key=...)
  var AUTH_KEYS = (CFG.authKeys && CFG.authKeys.slice) ? CFG.authKeys.slice() : [
    "auth-table", "tasun-auth", "tasunGlobalAuth_v1"
  ];

  // Resources json
  var RES_URL = String(CFG.resourcesUrl || "tasun-resources.json");
  var RES_CACHE = null;

  // UI labels
  var TITLE = String(CFG.title || "Tasun 系統登入");
  var SUBTITLE = String(CFG.subtitle || "請輸入帳號與全站密碼");
  var BRAND = String(CFG.brand || "Tasun");

  // ---------- Utilities ----------
  function norm(s){ return (s===undefined||s===null) ? "" : String(s).trim(); }
  function now(){ return Date.now(); }
  function addV(url){
    url = norm(url);
    if(!url) return url;
    if(!APP_VER) return url;
    try{
      var u = new URL(url, location.href);
      if(!u.searchParams.get("v")) u.searchParams.set("v", APP_VER);
      return u.toString();
    }catch(e){
      return url + (url.indexOf("?")>=0 ? "&" : "?") + "v=" + encodeURIComponent(APP_VER);
    }
  }
  function safeJsonParse(t){ try{ return JSON.parse(t); }catch(e){ return null; } }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  function getLS(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function setLS(k,v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function delLS(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function getSS(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
  function setSS(k,v){ try{ sessionStorage.setItem(k, v); }catch(e){} }
  function delSS(k){ try{ sessionStorage.removeItem(k); }catch(e){} }

  function b64urlToBytes(b64url){
    b64url = b64url.replace(/-/g,"+").replace(/_/g,"/");
    while(b64url.length % 4) b64url += "=";
    var str = atob(b64url);
    var arr = new Uint8Array(str.length);
    for(var i=0;i<str.length;i++) arr[i] = str.charCodeAt(i);
    return arr;
  }

  // SHA-256 hex (WebCrypto)
  async function sha256Hex(str){
    str = String(str||"");
    if(!(window.crypto && crypto.subtle)) return ""; // old browser
    var enc = new TextEncoder();
    var buf = enc.encode(str);
    var digest = await crypto.subtle.digest("SHA-256", buf);
    var a = new Uint8Array(digest);
    var hex = "";
    for(var i=0;i<a.length;i++){
      var h = a[i].toString(16);
      if(h.length<2) h = "0"+h;
      hex += h;
    }
    return hex;
  }

  function uniq(arr){
    var out=[], seen={};
    for(var i=0;i<arr.length;i++){
      var v = norm(arr[i]);
      if(!v) continue;
      if(seen[v]) continue;
      seen[v]=1; out.push(v);
    }
    return out;
  }

  // ---------- Brute-force / lockout ----------
  function loadFailMap(){
    var raw = getLS(S_FAILMAP);
    var j = safeJsonParse(raw);
    if(!j || typeof j!=="object") j = {};
    return j;
  }
  function saveFailMap(m){
    try{ setLS(S_FAILMAP, JSON.stringify(m)); }catch(e){}
  }
  function keyUser(u){ return norm(u).toLowerCase() || "_"; }

  function getLockInfo(u){
    var m = loadFailMap();
    var ku = keyUser(u);
    var it = m[ku] || null;
    if(!it) return {fails:0, lockUntil:0};
    return {
      fails: Number(it.fails||0) || 0,
      lockUntil: Number(it.lockUntil||0) || 0
    };
  }
  function recordFail(u){
    var m = loadFailMap();
    var ku = keyUser(u);
    var it = m[ku] || {fails:0, lockUntil:0};
    it.fails = Number(it.fails||0)+1;

    if(it.fails >= MAX_FAIL_BEFORE_LOCK){
      var pow = Math.min(10, it.fails - MAX_FAIL_BEFORE_LOCK); // cap
      var dur = LOCK_BASE_MS * Math.pow(2, pow);
      it.lockUntil = now() + dur;
    }

    m[ku]=it;
    saveFailMap(m);
    return it;
  }
  function clearFail(u){
    var m = loadFailMap();
    var ku = keyUser(u);
    if(m[ku]){ delete m[ku]; saveFailMap(m); }
  }

  // ---------- API base resolve (Worker-first) ----------
  async function fetchText(url){
    var r = await fetch(addV(url), {cache:"no-store"});
    var t = "";
    try{ t = await r.text(); }catch(e){ t=""; }
    return {ok:r.ok, status:r.status, text:t};
  }

  async function loadResources(){
    if(RES_CACHE) return RES_CACHE;
    // allow inline override
    if(CFG.resourcesInline && typeof CFG.resourcesInline==="object"){
      RES_CACHE = CFG.resourcesInline;
      return RES_CACHE;
    }
    var out = await fetchText(RES_URL);
    var j = safeJsonParse(out.text);
    if(j && j.resources && typeof j.resources==="object") j = j.resources;
    if(!j || typeof j!=="object") j = {};
    RES_CACHE = j;
    return RES_CACHE;
  }

  function pickApiBase(resources){
    // highest priority: window override
    var w = norm(window.TASUN_API_BASE || window.__TASUN_API_BASE || CFG.apiBase);
    if(w) return w.replace(/\/+$/,"");

    // try pageKey match (file name)
    var page = norm(CFG.pageKey);
    if(!page){
      try{
        var p = location.pathname.split("/").pop() || "";
        page = p || "index.html";
      }catch(e){ page=""; }
    }

    function getEntry(k){
      var e = resources && resources[k];
      return (e && typeof e==="object") ? e : null;
    }

    var e1 = getEntry(page);
    var e2 = getEntry("__default") || getEntry("*") || getEntry("default");
    var e = e1 || e2;
    var b = e && e.apiBase ? norm(e.apiBase) : "";
    return b.replace(/\/+$/,"");
  }

  function pickEndpoints(resources){
    // same rule as apiBase
    var page = norm(CFG.pageKey);
    if(!page){
      try{ page = location.pathname.split("/").pop() || "index.html"; }catch(e){ page="index.html"; }
    }
    function getEntry(k){ var e=resources&&resources[k]; return (e&&typeof e==="object")?e:null; }
    var e = getEntry(page) || getEntry("__default") || getEntry("*") || getEntry("default") || {};
    var ep = (e.endpoints && typeof e.endpoints==="object") ? e.endpoints : {};
    return {
      read: norm(ep.read || "/api/read"),
      merge: norm(ep.merge || "/api/merge"),
      health: norm(ep.health || "/health")
    };
  }

  function joinUrl(base, path){
    base = norm(base).replace(/\/+$/,"");
    path = norm(path);
    if(!path) return base;
    if(path.charAt(0) !== "/") path = "/"+path;
    return base + path;
  }

  async function workerReadAuth(apiBase, epRead, key){
    // GET {apiBase}{epRead}?key=...
    var url = joinUrl(apiBase, epRead);
    try{
      var u = new URL(url, location.href);
      if(!u.searchParams.get("key")) u.searchParams.set("key", key);
      if(APP_VER && !u.searchParams.get("v")) u.searchParams.set("v", APP_VER);
      url = u.toString();
    }catch(e){
      url = url + (url.indexOf("?")>=0?"&":"?") + "key=" + encodeURIComponent(key) + (APP_VER?("&v="+encodeURIComponent(APP_VER)):"");
    }

    var r = await fetch(url, {method:"GET", cache:"no-store", mode:"cors", credentials:"include"});
    var t = "";
    try{ t = await r.text(); }catch(_e){ t=""; }
    var j = safeJsonParse(t);

    // detect Access HTML
    var low = (t||"").slice(0, 900).toLowerCase();
    var looksHtml = low.indexOf("<html")>=0 || low.indexOf("<!doctype")>=0;
    if(looksHtml && (low.indexOf("cloudflare access")>=0 || low.indexOf("cf-access")>=0 || low.indexOf("access")>=0)){
      throw new Error("ACCESS_LOGIN_REQUIRED");
    }

    if(!r.ok) throw new Error("READ_FAIL_" + r.status);
    return j || null;
  }

  // ---------- Auth payload normalize ----------
  function extractUsers(any){
    if(!any) return [];
    if(Array.isArray(any)) return any;
    if(any && typeof any==="object"){
      if(Array.isArray(any.users)) return any.users;
      if(Array.isArray(any.items)) return any.items;
      if(Array.isArray(any.db)) return any.db;
      if(Array.isArray(any.rows)) return any.rows;
      if(any.payload && typeof any.payload==="object") return extractUsers(any.payload);
      if(any.data && typeof any.data==="object") return extractUsers(any.data);
      if(any.result && typeof any.result==="object") return extractUsers(any.result);
    }
    return [];
  }

  function normalizeAuthPayload(raw){
    var out = { globalPassHash:"", users:[], source:"" };
    if(!raw) return out;

    var users = extractUsers(raw) || [];
    var g = "";
    if(raw && typeof raw==="object"){
      g = norm(raw.globalPassHash || raw.global_pass_hash || raw.passHash || raw.pass_hash || "");
    }

    // if no global hash, derive from first user with passHash
    if(!g){
      for(var i=0;i<users.length;i++){
        var ph = norm(users[i] && (users[i].passHash || users[i].pass_hash || users[i].passwordHash || users[i].password_hash || users[i].pwdHash || ""));
        if(ph){ g = ph; break; }
      }
    }

    // clean users
    var cleaned = [];
    for(var j=0;j<users.length;j++){
      var u = users[j] || {};
      if(typeof u!=="object") continue;
      var name = norm(u.username || u.user || u.name || u.account || "");
      if(!name) continue;
      cleaned.push({
        username: name,
        role: norm(u.role || u.perm || u.permission || "") || "read",
        // per-user hash is optional; we validate against global unless global missing
        passHash: norm(u.passHash || u.pass_hash || u.passwordHash || u.password_hash || u.pwdHash || ""),
        // carry through button settings if present
        btns: u.btns || u.buttons || u.entryButtons || u.entryButtonsMap || null
      });
    }

    out.globalPassHash = g;
    out.users = cleaned;
    return out;
  }

  // ---------- Session ----------
  function readSession(){
    var raw = getSS(S_SESSION);
    var j = safeJsonParse(raw);
    if(!j || typeof j!=="object") return null;
    // basic validation
    if(!j.user || !j.issuedAt || !j.expiresAt) return null;
    return j;
  }
  function writeSession(user, role){
    var t = now();
    var sess = {
      ver: "6.5",
      user: user,
      role: role || "read",
      issuedAt: t,
      expiresAt: t + TTL_MS
    };
    setSS(S_SESSION, JSON.stringify(sess));
    setSS(S_LASTACT, String(t));
    // legacy current user (for existing UI)
    try{ setLS(S_CUR_LS, JSON.stringify({user:user, role:role||"read", at:t})); }catch(e){}
  }
  function clearSession(){
    delSS(S_SESSION);
    delSS(S_LASTACT);
  }
  function touchActivity(){
    try{ setSS(S_LASTACT, String(now())); }catch(e){}
  }
  function isSessionValid(sess){
    if(!sess) return false;
    if(now() > Number(sess.expiresAt||0)) return false;
    // idle
    var la = Number(getSS(S_LASTACT) || "0") || 0;
    if(la && (now() - la > IDLE_MS)) return false;
    return true;
  }

  // ---------- UI (overlay, no page layout changes) ----------
  var _ui = { mounted:false, root:null, msg:null, sel:null, pwd:null, btn:null, hint:null, logout:null };

  function injectStyleEarly(){
    try{
      var css = ""
        + "html.tasun-auth-lock body{overflow:hidden !important;}"
        + "html.tasun-auth-lock body>*:not(#tasunAuthOverlay){filter: blur(10px) saturate(0.85); pointer-events:none; user-select:none;}"
        + "#tasunAuthOverlay{position:fixed; inset:0; z-index:2147483647; display:flex; align-items:center; justify-content:center;}"
        + "#tasunAuthOverlay .bg{position:absolute; inset:0; background:rgba(0,0,0,.55); backdrop-filter: blur(10px);}"
        + "#tasunAuthOverlay .card{position:relative; width:min(520px, calc(100vw - 40px));"
        + " background: rgba(16,14,10,.72); border:1px solid rgba(246,214,150,.22); border-radius:18px;"
        + " box-shadow: 0 26px 70px rgba(0,0,0,.45); color: rgba(246,214,150,.96); padding: 22px 22px 18px;}"
        + "#tasunAuthOverlay .title{font-size:22px; font-weight:700; letter-spacing:2px; text-align:center; margin:2px 0 10px;}"
        + "#tasunAuthOverlay .sub{font-size:13px; opacity:.82; text-align:center; margin:0 0 18px;}"
        + "#tasunAuthOverlay label{display:block; font-size:12px; opacity:.8; margin:10px 0 6px;}"
        + "#tasunAuthOverlay select,#tasunAuthOverlay input{width:100%; height:42px; border-radius:999px;"
        + " border:1px solid rgba(246,214,150,.26); background: rgba(0,0,0,.28); color: rgba(246,214,150,.96);"
        + " padding: 0 14px; outline:none;}"
        + "#tasunAuthOverlay .row{display:flex; gap:10px; align-items:center;}"
        + "#tasunAuthOverlay .btn{height:40px; border-radius:999px; border:1px solid rgba(246,214,150,.26);"
        + " background: rgba(246,214,150,.14); color: rgba(246,214,150,.98); padding:0 16px; cursor:pointer;"
        + " font-weight:700; letter-spacing:1px;}"
        + "#tasunAuthOverlay .btn:disabled{opacity:.5; cursor:not-allowed;}"
        + "#tasunAuthOverlay .msg{min-height:18px; margin-top:10px; font-size:12px; opacity:.9; text-align:center;}"
        + "#tasunAuthOverlay .hint{margin-top:10px; font-size:12px; opacity:.75; text-align:center;}";
      var st = document.createElement("style");
      st.setAttribute("data-tasun-auth-v65","1");
      st.textContent = css;
      (document.head || document.documentElement).appendChild(st);
    }catch(e){}
  }

  function lockPage(){
    try{ document.documentElement.classList.add("tasun-auth-lock"); }catch(e){}
  }
  function unlockPage(){
    try{ document.documentElement.classList.remove("tasun-auth-lock"); }catch(e){}
  }

  function ensureOverlay(){
    if(_ui.mounted) return;
    _ui.mounted = true;

    function mount(){
      if(document.getElementById("tasunAuthOverlay")) return true;
      if(!document.body) return false;

      var root = document.createElement("div");
      root.id = "tasunAuthOverlay";

      var bg = document.createElement("div");
      bg.className = "bg";
      root.appendChild(bg);

      var card = document.createElement("div");
      card.className = "card";

      var t = document.createElement("div");
      t.className = "title";
      t.textContent = BRAND + " · 登入";
      card.appendChild(t);

      var sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = SUBTITLE;
      card.appendChild(sub);

      var lab1 = document.createElement("label");
      lab1.textContent = "帳號";
      card.appendChild(lab1);

      var sel = document.createElement("select");
      card.appendChild(sel);

      var lab2 = document.createElement("label");
      lab2.textContent = "全站密碼";
      card.appendChild(lab2);

      var row = document.createElement("div");
      row.className = "row";

      var pwd = document.createElement("input");
      pwd.type = "password";
      pwd.placeholder = "請輸入密碼";
      row.appendChild(pwd);

      var btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "登入";
      row.appendChild(btn);

      card.appendChild(row);

      var msg = document.createElement("div");
      msg.className = "msg";
      card.appendChild(msg);

      var hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "提示：連續輸入錯誤會暫時鎖定。";
      card.appendChild(hint);

      root.appendChild(card);
      document.body.appendChild(root);

      _ui.root = root; _ui.msg = msg; _ui.sel = sel; _ui.pwd = pwd; _ui.btn = btn; _ui.hint = hint;
      return true;
    }

    // poll until body ready
    var tries = 0;
    (function tick(){
      if(mount()) return;
      tries++;
      if(tries > 120) return; // ~6s
      setTimeout(tick, 50);
    })();
  }

  function uiMsg(s){ try{ if(_ui.msg) _ui.msg.textContent = String(s||""); }catch(e){} }
  function uiSetUsers(users){
    if(!_ui.sel) return;
    _ui.sel.innerHTML = "";
    for(var i=0;i<users.length;i++){
      var o = document.createElement("option");
      o.value = users[i].username;
      o.textContent = users[i].username + " (" + (users[i].role||"") + ")";
      _ui.sel.appendChild(o);
    }
  }

  // ---------- Auth flow ----------
  async function loadAuthFromCloud(){
    var resources = await loadResources();
    var apiBase = pickApiBase(resources);
    var ep = pickEndpoints(resources);
    if(!apiBase || !/^https?:\/\//i.test(apiBase)){
      // If not found, try window override only; else fail to fallback
      return null;
    }

    // Try keys in order
    var lastErr = "";
    for(var i=0;i<AUTH_KEYS.length;i++){
      var k = AUTH_KEYS[i];
      try{
        var raw = await workerReadAuth(apiBase, ep.read, k);
        if(raw){
          var auth = normalizeAuthPayload(raw);
          if(auth.users && auth.users.length){
            auth.source = "cloud:" + k;
            return auth;
          }
        }
      }catch(e){
        lastErr = String(e && e.message ? e.message : e);
      }
    }
    return null;
  }

  function loadAuthFromLocal(){
    var raw = getLS(S_AUTH_LS);
    var j = safeJsonParse(raw);
    var auth = normalizeAuthPayload(j);
    auth.source = "localStorage:" + S_AUTH_LS;
    return (auth.users && auth.users.length) ? auth : null;
  }

  async function ensureAuthPayload(){
    // Cloud first
    var cloud = null;
    try{ cloud = await loadAuthFromCloud(); }catch(e){ cloud = null; }
    if(cloud) return cloud;

    // local fallback (still works offline)
    var local = loadAuthFromLocal();
    if(local) return local;

    return {globalPassHash:"", users:[], source:"none"};
  }

  async function verifyAndLogin(auth, username, password){
    username = norm(username);
    password = String(password||"");

    var lock = getLockInfo(username);
    if(lock.lockUntil && now() < lock.lockUntil){
      var sec = Math.ceil((lock.lockUntil - now())/1000);
      uiMsg("帳號暫時鎖定，請稍後再試（約 " + sec + " 秒）");
      return false;
    }

    var u = null;
    for(var i=0;i<auth.users.length;i++){
      if(norm(auth.users[i].username) === username){ u = auth.users[i]; break; }
    }
    if(!u){
      recordFail(username);
      uiMsg("帳號不存在或尚未授權");
      return false;
    }

    // compute hash and compare
    var inHash = await sha256Hex(password);
    if(!inHash){
      uiMsg("此瀏覽器不支援安全登入（缺少 WebCrypto）");
      return false;
    }

    var expected = norm(auth.globalPassHash) || norm(u.passHash);
    if(!expected){
      uiMsg("尚未設定全站密碼（請至 權限表 設定並同步雲端）");
      return false;
    }

    if(inHash.toLowerCase() !== expected.toLowerCase()){
      var it = recordFail(username);
      if(it.lockUntil && now() < it.lockUntil){
        var sec2 = Math.ceil((it.lockUntil - now())/1000);
        uiMsg("密碼錯誤，帳號已鎖定（約 " + sec2 + " 秒）");
      }else{
        uiMsg("密碼錯誤，請再試一次");
      }
      return false;
    }

    // success
    clearFail(username);
    writeSession(username, u.role || "read");

    // also set legacy current user object (for existing UI)
    try{
      setLS(S_CUR_LS, JSON.stringify({ user: username, role: u.role||"read", at: now(), ver:"6.5" }));
    }catch(e){}

    // drop overlay
    try{
      if(_ui.root) _ui.root.remove();
    }catch(e){}
    unlockPage();
    return true;
  }

  function bindIdleLogout(){
    function act(){
      touchActivity();
    }
    ["click","keydown","mousemove","touchstart","scroll"].forEach(function(ev){
      try{ window.addEventListener(ev, act, {passive:true}); }catch(e){ try{ window.addEventListener(ev, act); }catch(_e){} }
    });

    // periodic check
    setInterval(function(){
      var sess = readSession();
      if(!sess) return;
      if(!isSessionValid(sess)){
        clearSession();
        // force re-auth (reload keeps page state minimal)
        if(FORCE_AUTH){
          try{ location.reload(); }catch(e){}
        }
      }
    }, 5000);
  }

  async function main(){
    injectStyleEarly();

    // Decide if this page requires auth
    if(!FORCE_AUTH){
      return;
    }

    // If already logged in and valid -> proceed
    var sess = readSession();
    if(sess && isSessionValid(sess)){
      bindIdleLogout();
      return;
    }

    // else lock and show overlay
    lockPage();
    ensureOverlay();
    uiMsg("載入權限中…");

    var auth = await ensureAuthPayload();
    if(!auth.users || !auth.users.length){
      uiMsg("找不到權限資料（請先開啟 權限表 進行初始化/同步雲端）");
      // allow retry by reload
      return;
    }

    // populate user list
    uiSetUsers(auth.users);
    uiMsg("請登入（來源：" + auth.source + "）");

    // bind button
    function doLogin(){
      if(!_ui.btn) return;
      var user = _ui.sel ? _ui.sel.value : "";
      var pwd = _ui.pwd ? _ui.pwd.value : "";
      _ui.btn.disabled = true;
      Promise.resolve().then(async function(){
        try{
          var ok = await verifyAndLogin(auth, user, pwd);
          if(ok){
            bindIdleLogout();
          }else{
            if(_ui.pwd) _ui.pwd.value = "";
            if(_ui.pwd) _ui.pwd.focus();
          }
        } finally {
          if(_ui.btn) _ui.btn.disabled = false;
        }
      });
    }

    try{
      if(_ui.btn) _ui.btn.addEventListener("click", function(ev){ ev.preventDefault(); doLogin(); });
      if(_ui.pwd) _ui.pwd.addEventListener("keydown", function(ev){ if(ev.key==="Enter"){ ev.preventDefault(); doLogin(); } });
      if(_ui.sel) _ui.sel.addEventListener("keydown", function(ev){ if(ev.key==="Enter"){ ev.preventDefault(); doLogin(); } });
      // focus
      setTimeout(function(){ try{ if(_ui.pwd) _ui.pwd.focus(); }catch(e){} }, 80);
    }catch(e){}
  }

  // Start ASAP
  Promise.resolve().then(function(){ return main(); }).catch(function(e){
    try{
      console.warn("[TasunAuthV65] error:", e);
    }catch(_e){}
  });

  // Expose small helper
  window.TasunAuthV65 = {
    logout: function(){
      clearSession();
      try{ location.reload(); }catch(e){}
    },
    status: function(){
      var s = readSession();
      return s && isSessionValid(s) ? { ok:true, user:s.user, role:s.role, expiresAt:s.expiresAt } : { ok:false };
    }
  };
})();
