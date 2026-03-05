// tasun-guard-v3.js
// Tasun Security v3 - Guard for subpages.
// If not logged in (sessionStorage empty/expired), redirect to index.html?next=...
// Also provides helper to enforce role for write actions.

(function(){
  function guard(){
    if(!window.TasunAuthV3) return;
    window.TasunAuthV3.requireSessionOrRedirect();
  }

  function role(){
    const s = window.TasunAuthV3 && window.TasunAuthV3.getSession ? window.TasunAuthV3.getSession() : null;
    return (s && s.user && s.user.role) ? String(s.user.role) : "";
  }

  function assertCanWrite(){
    const r = role();
    if(r === "admin" || r === "write") return true;
    alert("此帳號僅有讀取權限，無法寫入/同步。");
    return false;
  }

  // Run guard as early as possible
  if(document.readyState === "loading"){
    guard(); // still ok: uses location.replace only
  }else{
    guard();
  }

  window.TasunGuardV3 = { role, assertCanWrite };
})(); 
