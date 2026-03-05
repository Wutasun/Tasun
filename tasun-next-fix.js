/*!
 * tasun-next-fix.js (Tasun v4 stable)
 * Purpose:
 *  - Prevent infinite nested ?next=... that causes GitHub Pages 414 (URI Too Long)
 *  - Store next target in sessionStorage and clean URL early (before other scripts)
 *  - Provide helper API for other scripts: window.TasunNextFix
 *
 * Placement:
 *  - Put this file in the SAME folder as index.html (e.g. /Tasun/tasun-next-fix.js)
 *  - Include it as the FIRST script in <head> (before guard/login scripts)
 */
(function(){
  "use strict";
  const KEY = "tasun_next_target_v4";
  const MAX_URL_LEN = 1200;      // conservative for GitHub Pages
  const MAX_NEXT_LEN = 900;      // avoid long next payload
  const MAX_UNWRAP = 8;

  function safeDecode(s){
    try { return decodeURIComponent(s); } catch(e){ return s; }
  }

  function unwrapNext(raw){
    let t = String(raw || "");
    for(let i=0;i<MAX_UNWRAP;i++){
      t = safeDecode(t);
      const m = t.match(/[?&]next=([^&]+)/i);
      if(m && m[1]) { t = m[1]; continue; }
      break;
    }
    return safeDecode(t);
  }

  function isIndexLike(urlStr){
    try{
      const u = new URL(urlStr, location.origin + location.pathname.replace(/[^/]*$/, ""));
      return /\/index\.html?$/i.test(u.pathname);
    }catch(e){
      return /\/index\.html?/i.test(urlStr);
    }
  }

  function cleanSelfUrlKeepOthers(){
    // remove only 'next' from current URL, keep other params (like v=)
    const u = new URL(location.href);
    if(!u.searchParams.has("next")) return null;
    u.searchParams.delete("next");
    // if nothing left, remove trailing '?'
    return u.pathname + (u.searchParams.toString() ? ("?" + u.searchParams.toString()) : "") + u.hash;
  }

  function setNextTarget(target){
    if(!target) return;
    try{
      sessionStorage.setItem(KEY, String(target));
    }catch(e){}
  }

  // 1) If URL already has next, unwrap & store it.
  const sp = new URLSearchParams(location.search);
  const next = sp.get("next");
  if(next){
    const unwrapped = unwrapNext(next);
    // store only if not looping back to index with next again
    if(unwrapped && !(isIndexLike(unwrapped) && /[?&]next=/i.test(unwrapped))){
      setNextTarget(unwrapped);
    }
    // clean URL immediately to stop next nesting
    const cleaned = cleanSelfUrlKeepOthers();
    if(cleaned){
      // use replaceState to avoid a navigation
      try{ history.replaceState(null, "", cleaned); }catch(e){}
    }
  }

  // 2) If URL is already too long (some browsers still load), force-clean it.
  try{
    if(String(location.href).length > MAX_URL_LEN){
      const cleaned = (function(){
        const u = new URL(location.href);
        u.search = ""; // drop all params if too long
        u.hash = "";
        return u.pathname;
      })();
      history.replaceState(null, "", cleaned);
    }
  }catch(e){}

  // 3) helper API
  window.TasunNextFix = {
    KEY,
    unwrapNext,
    getNextTarget(){
      try { return sessionStorage.getItem(KEY) || ""; } catch(e){ return ""; }
    },
    consumeNextTarget(){
      let v = "";
      try { v = sessionStorage.getItem(KEY) || ""; } catch(e){}
      try { sessionStorage.removeItem(KEY); } catch(e){}
      return v;
    },
    setNextTarget,
    // recommended redirect to login/index without huge query string:
    redirectToIndex(target){
      if(target) setNextTarget(target);
      // IMPORTANT: do NOT append ?next=... to avoid 414
      const base = location.origin + location.pathname.replace(/\/[^/]*$/, "/index.html");
      location.href = base;
    }
  };

  // 4) hard safety: if any script later tries to set ?next=<very long>, clamp it.
  // (We can't intercept all cases, but this provides a safer way for internal code.)
  window.__tasun_safe_next = function(url){
    const u = String(url || "");
    if(u.length > MAX_NEXT_LEN) return u.slice(0, MAX_NEXT_LEN);
    return u;
  };
})();
