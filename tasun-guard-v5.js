/*!
 * tasun-guard-v5 (no-query-next)
 * Prevents "URI Too Long" by NEVER putting next into ?next=...
 * Strategy:
 *  - Save next into sessionStorage
 *  - Redirect to entry.html#next=<encoded> (hash not sent to server)
 *  - entry.html then redirects to index.html with short URL
 */
(function(){
  "use strict";

  const NEXT_KEY = "tasun_next_path_v1";

  const ENTRY_PATH = (function(){
    const p = location.pathname;
    const i = p.indexOf("/Tasun/");
    const base = (i >= 0) ? p.slice(0, i + "/Tasun/".length) : "/";
    return base + "entry.html";
  })();

  function safeEncode(s){ try { return encodeURIComponent(s); } catch(e){ return ""; } }

  function sameOriginPath(href){
    try {
      const u = new URL(href, location.origin);
      if (u.origin !== location.origin) return "";
      return u.pathname + u.search + u.hash;
    } catch(e){
      return (href && href.startsWith("/")) ? href : "";
    }
  }

  function setNext(path){
    if (!path) return;
    if (/\/index\.html\?next=/i.test(path) || /\/index\.html#next=/i.test(path)) return;
    try { sessionStorage.setItem(NEXT_KEY, path); } catch(e){}
  }

  window.TASUN_GUARD_V5 = {
    setNext,
    redirectToEntry: function(nextPath){
      const p = nextPath || sameOriginPath(location.href);
      setNext(p);
      const url = ENTRY_PATH + "#next=" + safeEncode(p);
      location.replace(url);
    }
  };

  // Optional auto-enforce (compatible shim)
  try {
    const require = !!window.__TASUN_REQUIRE_LOGIN__;
    const isLoggedIn = (typeof window.__TASUN_IS_LOGGED_IN__ === "function") ? !!window.__TASUN_IS_LOGGED_IN__() : true;
    if (require && !isLoggedIn) {
      window.TASUN_GUARD_V5.redirectToEntry(sameOriginPath(location.href));
    }
  } catch(e){
    // fail-open
  }
})();

(function(){
  try{
    function isLoggedIn(){
      try{ return !!(sessionStorage.getItem('tasunCurrentUser_v1') || sessionStorage.getItem('tasunSession_v1')); }catch(e){ return false; }
    }
    window.TasunGuardV4 = {
      boot: function(){
        if(!isLoggedIn() && window.TASUN_GUARD_V5){ window.TASUN_GUARD_V5.redirectToEntry(); }
      },
      redirectToEntry: function(next){ if(window.TASUN_GUARD_V5) window.TASUN_GUARD_V5.redirectToEntry(next); }
    };
  }catch(e){}
})();
