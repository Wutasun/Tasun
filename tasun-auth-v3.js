// tasun-auth-v3.js
// Tasun Security v3 - Frontend Auth (sessionStorage based; per-browser-session login)
//
// Session key: tasunAuthSession_v3
// Stores: { token, exp, user:{username,role}, loginAt, workerBase }
//
// Requires your Worker base, default from resources.json if present, else set window.TASUN_WORKER_BASE

(function(){
  const KEY = "tasunAuthSession_v3";

  function now(){ return Date.now(); }

  function getWorkerBase(){
    return (window.TASUN_WORKER_BASE || "").trim() || inferWorkerBaseFromResources() || "";
  }

  function inferWorkerBaseFromResources(){
    try{
      // If you have resources.json defining API_BASE, you can expose it as window.TASUN_RESOURCES
      // This is a safe fallback: do nothing if not present.
      const r = window.TASUN_RESOURCES || null;
      if(r && r.API_BASE) return String(r.API_BASE).replace(/\/+$/,"");
    }catch{}
    return "";
  }

  function getSession(){
    const raw = sessionStorage.getItem(KEY);
    if(!raw) return null;
    try{
      const s = JSON.parse(raw);
      if(!s || !s.token || !s.user) return null;
      if(s.exp && now() > Number(s.exp)) return null;
      return s;
    }catch{
      return null;
    }
  }

  function setSession(s){
    sessionStorage.setItem(KEY, JSON.stringify(s));
  }

  function clearSession(){
    sessionStorage.removeItem(KEY);
  }

  async function login(username, password){
    const base = getWorkerBase();
    if(!base) throw new Error("TASUN_WORKER_BASE not set");
    const res = await fetch(base + "/api/tasun/login", {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify({ username, password })
    });
    const j = await res.json().catch(()=>null);
    if(!res.ok || !j || !j.ok) throw new Error((j && (j.error||j.detail)) || "LOGIN_FAIL");
    const sess = {
      token: j.token,
      exp: j.exp,
      user: j.user,
      loginAt: now(),
      workerBase: base
    };
    setSession(sess);
    return sess;
  }

  function logout(){
    clearSession();
    // Do not hard reload by default; caller can redirect
  }

  function requireSessionOrRedirect(){
    const s = getSession();
    if(s) return s;
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace("index.html?next=" + next);
    return null;
  }

  // Role-based buttons (works with your existing data-roles convention)
  // - If element has data-roles="admin,write" then only show for those roles.
  // - If element has data-role="admin" also works.
  function applyRoleButtons(root){
    const s = getSession();
    const role = (s && s.user && s.user.role) ? String(s.user.role) : "";
    const scope = root || document;
    const nodes = scope.querySelectorAll("[data-roles],[data-role]");
    nodes.forEach(el=>{
      const a = el.getAttribute("data-roles");
      const b = el.getAttribute("data-role");
      const allow = (a ? a.split(",").map(x=>x.trim()) : (b?[b.trim()]:[])).filter(Boolean);
      if(!allow.length) return;
      const ok = allow.includes(role);
      el.style.display = ok ? "" : "none";
    });
  }

  window.TasunAuthV3 = {
    KEY,
    getWorkerBase,
    getSession,
    login,
    logout,
    requireSessionOrRedirect,
    applyRoleButtons,
  };
})(); 
