/*!
 * tasun-guard-v5 (token-bridge unified)
 * - never put next into query
 * - uses sessionStorage next path
 * - redirect to entry.html#next=...
 */
(function(global){
  "use strict";
  const NEXT_KEY = "tasun_next_path_v1";
  const ENTRY_PATH = (function(global){
    const p = location.pathname;
    const i = p.indexOf("/Tasun/");
    const base = (i >= 0) ? p.slice(0, i + "/Tasun/".length) : "/";
    return global.__withV ? global.__withV(base + "entry.html") : (base + "entry.html");
  })(window);
  function safeEncode(s){ try { return encodeURIComponent(s); } catch(e){ return ""; } }
  function sameOriginPath(href){ try { const u = new URL(href, location.origin); if (u.origin !== location.origin) return ""; return u.pathname + u.search + u.hash; } catch(e){ return (href && href.startsWith("/")) ? href : ""; } }
  function setNext(path){ if (!path) return; if (/\/index\.html\?next=/i.test(path) || /\/index\.html#next=/i.test(path)) return; try { sessionStorage.setItem(NEXT_KEY, path); } catch(e){} }
  function isLoggedIn(){
    try{ if(typeof window.__TASUN_IS_LOGGED_IN__ === 'function') return !!window.__TASUN_IS_LOGGED_IN__(); }catch(_e){}
    try{ if(window.TasunAuthV4 && window.TasunAuthV4.isLoggedIn) return !!window.TasunAuthV4.isLoggedIn(); }catch(_e){}
    try{ if(window.TasunGlobalCore && window.TasunGlobalCore.getCurrentUser && window.TasunGlobalCore.getCloudToken){ var cur=window.TasunGlobalCore.getCurrentUser(); return !!(cur && cur.user && window.TasunGlobalCore.getCloudToken()); } }catch(_e){}
    return false;
  }
  window.TASUN_GUARD_V5 = {
    setNext,
    redirectToEntry: function(nextPath){ const p = nextPath || sameOriginPath(location.href); setNext(p); const url = ENTRY_PATH + "#next=" + safeEncode(p); location.replace(url); }
  };
  try { const require = !!window.__TASUN_REQUIRE_LOGIN__; if (require && !isLoggedIn()) { window.TASUN_GUARD_V5.redirectToEntry(sameOriginPath(location.href)); } } catch(e){ }
})(window);
