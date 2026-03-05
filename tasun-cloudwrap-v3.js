// tasun-cloudwrap-v3.js
// Tasun Security v3 - fetch wrapper
// - Automatically adds Authorization: Bearer <token> for Worker calls
// - If response is 401/403, clears session and redirects to login (index.html?next=...)

(function(){
  function shouldAttachAuth(url){
    try{
      const s = window.TasunAuthV3 && window.TasunAuthV3.getSession ? window.TasunAuthV3.getSession() : null;
      if(!s || !s.workerBase) return false;
      return String(url).startsWith(String(s.workerBase).replace(/\/+$/,"") + "/api/tasun/");
    }catch{
      return false;
    }
  }

  async function wrappedFetch(input, init){
    const url = (typeof input === "string") ? input : (input && input.url) ? input.url : "";
    const opts = init ? { ...init } : {};
    opts.headers = new Headers(opts.headers || (input && input.headers) || {});

    const s = window.TasunAuthV3 && window.TasunAuthV3.getSession ? window.TasunAuthV3.getSession() : null;

    if(s && s.token && shouldAttachAuth(url)){
      opts.headers.set("Authorization", "Bearer " + s.token);
    }

    const res = await fetch(input, opts);

    if(res.status === 401 || res.status === 403){
      try{ window.TasunAuthV3 && window.TasunAuthV3.logout && window.TasunAuthV3.logout(); }catch{}
      const next = encodeURIComponent(location.pathname + location.search + location.hash);
      location.replace("index.html?next=" + next);
      return res;
    }
    return res;
  }

  // Export and optional global patch (safer: do not override fetch unless you choose)
  window.TasunFetchV3 = wrappedFetch;

  // Optional: auto-patch if window.TASUN_PATCH_FETCH = true
  if(window.TASUN_PATCH_FETCH === true){
    window.fetch = wrappedFetch;
  }
})(); 
