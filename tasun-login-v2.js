/* tasun-login-v2.js
 * Browser-session login + Worker token (Security v2)
 * - sessionStorage: token/user/role
 * - injects Authorization: Bearer <token> for Worker read/merge
 * - keeps your UI unchanged: index.html calls tasunAuth.login(username,password)
 */
(function(){
  "use strict";

  const WORKER_BASE = "https://tasun-worker.wutasun.workers.dev";
  const SESSION = "tasunAuthSession_v2";

  function safeJson(s){ try{ return JSON.parse(s); }catch(e){ return null; } }
  function now(){ return Date.now(); }

  function get(){
    const s = safeJson(sessionStorage.getItem(SESSION) || "null");
    if(!s || typeof s !== "object") return null;
    if(!s.token || !s.user) return null;
    if(s.exp && now() > Number(s.exp)) return null;
    return s;
  }

  function set(sess){
    try{ sessionStorage.setItem(SESSION, JSON.stringify(sess)); }catch(e){}
  }

  function clear(){
    try{ sessionStorage.removeItem(SESSION); }catch(e){}
  }

  async function login(username, password){
    const res = await fetch(WORKER_BASE + "/api/tasun/login", {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify({ username, password })
    });
    const j = await res.json().catch(()=>({}));
    if(!res.ok || !j.ok) throw new Error(j.error || "LOGIN_FAILED");
    const sess = { token:j.token, user:j.user, role:j.role, exp:j.exp };
    set(sess);
    return sess;
  }

  function logout(){ clear(); }

  function isLoggedIn(){ return !!get(); }

  function requireLogin(){
    if(isLoggedIn()) return true;
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace("index.html?next=" + next);
    return false;
  }

  // Fetch wrapper: add Authorization for Worker endpoints
  (function installAuthFetch(){
    if(window.__TASUN_AUTH_FETCH__) return;
    window.__TASUN_AUTH_FETCH__ = true;
    const _fetch = window.fetch.bind(window);
    window.fetch = function(input, init){
      try{
        const s = get();
        if(!s || !s.token) return _fetch(input, init);

        const url = (typeof input === "string") ? input : (input && input.url) ? input.url : "";
        const u = new URL(url, location.href);
        // only attach for worker endpoints
        if(u.origin === new URL(WORKER_BASE).origin && u.pathname.startsWith("/api/tasun/")){
          const headers = new Headers((init && init.headers) || (typeof input !== "string" ? input.headers : undefined) || {});
          headers.set("authorization", "Bearer " + s.token);
          const nextInit = Object.assign({}, init || {}, { headers });
          return _fetch(input, nextInit);
        }
      }catch(e){}
      return _fetch(input, init);
    };
  })();

  window.tasunAuth = { get, login, logout, isLoggedIn, requireLogin, WORKER_BASE };
})();