/* Tasun Browser-Session Login (stable v1)
 * - Login once per browser session; closing browser requires re-login (sessionStorage)
 * - Cross-tab convenience: uses short-lived localStorage share + heartbeat (expires quickly if browser closed)
 * - Does NOT change UI; pages call tasunRequireLogin() to guard.
 */
(function(){
  "use strict";

  const SESSION_KEY = "tasunSessionLogin_v1";      // same as index.html
  const SHARE_KEY   = "tasunSessionShare_v1";      // short-lived share for other tabs
  const SHARE_TTL_MS = 15000;                      // 15s without heartbeat => treat as logged out (close browser/all tabs)
  const PING_MS      = 5000;                       // heartbeat every 5s when logged in

  function now(){ return Date.now(); }
  function safeJson(s){ try{ return JSON.parse(s); }catch(e){ return null; } }

  function readSession(){
    const o = safeJson(sessionStorage.getItem(SESSION_KEY) || "null");
    if(!o || typeof o !== "object") return null;
    const user = String(o.user||"").trim();
    const role = String(o.role||"").trim();
    if(!user) return null;
    return { user, role: role.toLowerCase(), t: Number(o.t||0) };
  }

  function readShare(){
    const o = safeJson(localStorage.getItem(SHARE_KEY) || "null");
    if(!o || typeof o !== "object") return null;
    const user = String(o.user||"").trim();
    const role = String(o.role||"").trim();
    const ts = Number(o.ts||0);
    if(!user) return null;
    const age = now() - ts;
    if(!(age >= 0 && age <= SHARE_TTL_MS)) return null;
    return { user, role: role.toLowerCase(), t: Number(o.t||0), ts };
  }

  function writeShare(sess){
    try{
      localStorage.setItem(SHARE_KEY, JSON.stringify({ user: sess.user, role: sess.role, t: sess.t||now(), ts: now() }));
    }catch(e){}
  }

  function clearShare(){
    try{ localStorage.removeItem(SHARE_KEY); }catch(e){}
  }

  function ensureImportedFromShare(){
    if(readSession()) return readSession();
    const sh = readShare();
    if(!sh) return null;
    try{
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: sh.user, role: sh.role, t: sh.t||now() }));
    }catch(e){}
    return readSession();
  }

  function setLogin(user, role){
    const sess = { user: String(user||"").trim(), role: String(role||"").trim().toLowerCase(), t: now() };
    if(!sess.user) return null;
    try{ sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess)); }catch(e){}
    writeShare(sess);
    startHeartbeat();
    return sess;
  }

  function logout(){
    try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
    clearShare();
    stopHeartbeat();
  }

  function isLoggedIn(){
    return !!(readSession() || ensureImportedFromShare());
  }

  function getLogin(){
    return readSession() || ensureImportedFromShare();
  }

  function requireLogin(opts){
    const ok = isLoggedIn();
    if(ok) return true;

    const o = opts && typeof opts === "object" ? opts : {};
    const index = o.index || "index.html";
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace(index + (index.includes("?") ? "&" : "?") + "next=" + next);
    return false;
  }

  function touch(){
    const sess = readSession();
    if(!sess) return;
    writeShare(sess);
  }

  function startHeartbeat(){
    try{
      if(window.__TASUN_LOGIN_PING__) return;
      window.__TASUN_LOGIN_PING__ = setInterval(()=>{
        if(readSession()) touch();
      }, PING_MS);
    }catch(e){}
  }

  function stopHeartbeat(){
    try{
      if(window.__TASUN_LOGIN_PING__){
        clearInterval(window.__TASUN_LOGIN_PING__);
        window.__TASUN_LOGIN_PING__ = null;
      }
    }catch(e){}
  }

  // Auto start heartbeat if already logged in on this page
  if(readSession()) startHeartbeat();

  // Export API
  window.tasunLogin = {
    get: getLogin,
    isLoggedIn,
    set: setLogin,
    logout,
    requireLogin,
    _touch: touch
  };
})();