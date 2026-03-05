/* Tasun Cloud Wrap v4: auto attach Authorization Bearer token */
(() => {
  const KEY = "tasunAuthSession_v4";
  const _fetch = window.fetch.bind(window);
  function safeJSON(s){ try{ return JSON.parse(s); }catch(e){ return null; } }
  window.fetch = function(resource, init) {
    try{
      const sess = safeJSON(sessionStorage.getItem(KEY) || "null");
      if (sess && sess.token) {
        init = init || {};
        init.headers = init.headers || {};
        // keep existing Authorization if user set one
        if (!init.headers["Authorization"] && !init.headers["authorization"]) {
          init.headers["Authorization"] = "Bearer " + sess.token;
        }
      }
    }catch(e){}
    return _fetch(resource, init);
  };
})();
