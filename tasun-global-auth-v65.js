(function(){
  "use strict";

  var COOKIE_NAME = "tasun_session_v3";
  var CURRENT_KEY = "tasunCurrentUser_v1";
  var SESSION_KEY = "tasunSessionLogin_v1";
  var SSO_KEY = "tasunSso_v1";
  var SESSION_BRIDGE_KEY = "tasunCurrentBridge_v1";
  var INDEX_SESSION_KEY = "tasunIndexSessionAuthed_v1";

  function safeParse(s){ try{ return JSON.parse(s); }catch(_e){ return null; } }
  function now(){ return Date.now(); }
  function trim(v){ return String(v == null ? "" : v).trim(); }
  function normRole(v){
    v = trim(v).toLowerCase();
    return (v === "admin" || v === "write" || v === "read") ? v : "read";
  }
  function inferRole(name, role){
    var r = normRole(role);
    if(r) return r;
    var u = trim(name).toLowerCase();
    if(u === "alex" || u === "joyce") return "admin";
    if(u === "tasun") return "write";
    return "read";
  }
  function b64d(s){ try{ return decodeURIComponent(escape(atob(s))); }catch(_e){ return ""; } }
  function currentPageName(){
    try{
      var p = location.pathname.split("/").pop() || "index.html";
      return p || "index.html";
    }catch(_e){ return "index.html"; }
  }
  function isIndexPage(){
    var p = currentPageName().toLowerCase();
    return !p || p === "index.html";
  }
  function readCookieSession(){
    try{
      var m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
      if(!m) return null;
      var raw = decodeURIComponent(m[1] || "");
      var json = b64d(raw);
      var o = safeParse(json);
      if(!o) return null;
      var user = trim(o.u || o.user || o.username || o.name);
      if(!user) return null;
      var exp = Number(o.exp || 0) || 0;
      if(exp && now() > exp) return null;
      return { user:user, username:user, name:user, role:normRole(o.r || o.role || inferRole(user, o.r || o.role)), exp:exp, source:"cookie" };
    }catch(_e){ return null; }
  }
  function readJsonStorage(store, key){
    try{ return safeParse(store.getItem(key) || "null"); }catch(_e){ return null; }
  }
  function normalizeUserLike(o, source){
    if(!o || typeof o !== "object") return null;
    var user = trim(o.user || o.username || o.name || o.u);
    if(!user) return null;
    var exp = Number(o.exp || 0) || 0;
    if(exp && now() > exp) return null;
    return { user:user, username:user, name:user, role:normRole(o.role || o.level || o.r || inferRole(user, o.role || o.level || o.r)), exp:exp, source:source || "storage" };
  }
  function readBestSession(){
    var cookie = readCookieSession();
    var sess = normalizeUserLike(readJsonStorage(sessionStorage, SESSION_KEY), "session");
    var curS = normalizeUserLike(readJsonStorage(sessionStorage, CURRENT_KEY), "session-current");
    var ssoS = normalizeUserLike(readJsonStorage(sessionStorage, SSO_KEY), "session-sso");
    var curL = normalizeUserLike(readJsonStorage(localStorage, CURRENT_KEY), "local-current");
    var bridge = normalizeUserLike(readJsonStorage(localStorage, SESSION_BRIDGE_KEY), "local-bridge");
    return cookie || sess || curS || ssoS || bridge || curL || null;
  }
  function writeBridge(u){
    try{
      if(!u || !u.user) return;
      var payload = { user:u.user, username:u.user, name:u.user, role:normRole(u.role), level:normRole(u.role), at:now(), v:(window.__CACHE_V || window.TASUN_APP_VER || "") };
      try{ sessionStorage.setItem(CURRENT_KEY, JSON.stringify(payload)); }catch(_e){}
      try{ localStorage.setItem(CURRENT_KEY, JSON.stringify(payload)); }catch(_e){}
      try{ localStorage.setItem(SESSION_BRIDGE_KEY, JSON.stringify(payload)); }catch(_e){}
      try{ sessionStorage.setItem(INDEX_SESSION_KEY, "1"); }catch(_e){}
      var sess = { user:u.user, role:normRole(u.role), t:now() };
      try{ sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess)); }catch(_e){}
    }catch(_e){}
  }
  function clearStale(){
    try{ sessionStorage.removeItem(CURRENT_KEY); }catch(_e){}
    try{ sessionStorage.removeItem(SESSION_KEY); }catch(_e){}
    try{ sessionStorage.removeItem(SSO_KEY); }catch(_e){}
    try{ sessionStorage.removeItem(INDEX_SESSION_KEY); }catch(_e){}
    try{ localStorage.removeItem(CURRENT_KEY); }catch(_e){}
    try{ localStorage.removeItem(SESSION_BRIDGE_KEY); }catch(_e){}
  }
  function markPageUser(u){
    try{ document.documentElement.setAttribute("data-tasun-user", trim(u && u.user)); }catch(_e){}
    try{ document.documentElement.setAttribute("data-tasun-role", normRole(u && u.role)); }catch(_e){}
  }
  function redirectToIndex(){
    if(isIndexPage()) return;
    try{
      var url = new URL("index.html", location.href);
      var v = trim(window.__CACHE_V || window.TASUN_APP_VER || url.searchParams.get("v") || "");
      if(v) url.searchParams.set("v", v);
      url.searchParams.set("returnTo", currentPageName());
      location.replace(url.toString());
    }catch(_e){ location.replace("index.html"); }
  }

  var best = readBestSession();
  var cookie = readCookieSession();

  if(best && best.user){
    writeBridge(best);
    markPageUser(best);
    return;
  }

  // 沒有有效 session/cookie：清掉舊橋接，避免舊 localStorage 假登入。
  clearStale();
  if(!isIndexPage()) redirectToIndex();
})();
