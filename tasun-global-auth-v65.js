/* Tasun Global Auth v6.5 (SSO hotfix)
   - Uses a single "global password" flow across pages (existing page logic can still handle UI).
   - Adds cross-page SSO token support: if user logged in on index, other pages can skip re-login.
   - Does NOT change UI by itself; it only syncs auth state into localStorage/sessionStorage and emits events.
*/
(function(){
  "use strict";

  const CURRENT_KEY = "tasunCurrentUser_v1";
  const AUTH_KEY    = "tasunAuthTable_v1";      // permission matrix (optional)
  const SSO_KEY     = "tasunSso_v1";
  const TAB_KEY     = "tasunSsoTab_v1";
  const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12;   // 12h

  function jparse(s, fb){ try{ return JSON.parse(s); }catch(_){ return fb; } }
  function now(){ return Date.now(); }

  function inferRole(name, role){
    if(role) return role;
    if(name === "alex") return "admin";
    if(name === "tasun") return "write";
    return "read";
  }

  function setCurrent(name, role){
    try{
      const r = inferRole(name, role);
      localStorage.setItem(CURRENT_KEY, JSON.stringify({ name, user:name, role:r }));
      return { name, role:r };
    }catch(_){ return { name, role: inferRole(name, role) }; }
  }

  function getCurrent(){
    const o = jparse(localStorage.getItem(CURRENT_KEY)||"", null) || {};
    const name = o.name || o.user || o.username || o.account || "";
    const role = inferRole(name, o.role);
    return name ? { name, role } : null;
  }

  function getSSO(){
    const o = jparse(localStorage.getItem(SSO_KEY)||"", null);
    if(!o || !o.name) return null;
    const exp = Number(o.exp || 0);
    if(exp && now() > exp) return null;
    return { name:o.name, role: inferRole(o.name, o.role), exp: exp || (now()+DEFAULT_TTL_MS) };
  }

  function writeSSO(name, role, ttlMs){
    try{
      const t = now();
      const payload = { name, role: inferRole(name, role), at:t, exp:t + (ttlMs||DEFAULT_TTL_MS) };
      localStorage.setItem(SSO_KEY, JSON.stringify(payload));
      try{ sessionStorage.setItem(TAB_KEY, "1"); }catch(_e){}
      return payload;
    }catch(_){ return null; }
  }

  function clearSSO(){
    try{ localStorage.removeItem(SSO_KEY); }catch(_){}
    try{ sessionStorage.removeItem(TAB_KEY); }catch(_){}
  }

  // 1) If SSO token exists, treat as authenticated and sync CURRENT_KEY
  (function adoptSSO(){
    const sso = getSSO();
    if(!sso) return;
    setCurrent(sso.name, sso.role);
    try{ sessionStorage.setItem(TAB_KEY, "1"); }catch(_e){}
    window.__TASUN_SSO_OK__ = true;
  })();

  // 2) Expose small API for pages (index can call on login/logout)
  window.TasunGlobalAuthV65 = {
    getCurrent,
    setCurrent: (name, role) => setCurrent(name, role),
    getSSO,
    setSSO: (name, role, ttlMs) => writeSSO(name, role, ttlMs),
    clearSSO,
    inferRole
  };

  // 3) Emit event so pages can refresh UI without coupling
  (function emit(){
    const cur = getCurrent();
    if(cur){
      try{
        window.dispatchEvent(new CustomEvent("tasun:auth", { detail:{ ok:true, user:cur.name, role:cur.role, via: window.__TASUN_SSO_OK__ ? "sso" : "local" } }));
      }catch(_e){}
    }else{
      try{
        window.dispatchEvent(new CustomEvent("tasun:auth", { detail:{ ok:false, user:"", role:"" } }));
      }catch(_e){}
    }
  })();
})();
