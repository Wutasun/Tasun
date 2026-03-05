/* tasun-next-fix.js
   Fix: prevent recursive next= nesting that causes 414 URI Too Long on GitHub Pages / proxies.
   - Captures ?next= once, stores to sessionStorage, then removes it from URL (no more growth)
   - Normalizes and clamps next target (same-origin only; relative path preferred)
*/
(function(){
  "use strict";
  const NEXT_KEY = "tasunNextUrl_v1";

  function safeDecode(s, maxPass){
    let out = String(s||"");
    const n = Math.max(0, Math.min(5, maxPass||2));
    for(let i=0;i<n;i++){
      try{
        const dec = decodeURIComponent(out);
        if(dec === out) break;
        out = dec;
      }catch(_e){ break; }
    }
    return out;
  }

  function stripNestedNext(raw){
    let cur = String(raw||"");
    for(let i=0;i<6;i++){
      if(!/(\?|&)next=/i.test(cur)) break;
      try{
        const u = new URL(cur, location.href);
        const n = u.searchParams.get("next");
        if(!n) break;
        cur = n;
      }catch(_e){
        const m = cur.match(/(?:\?|&)next=([^&#]+)/i);
        if(!m) break;
        cur = m[1];
      }
    }
    return cur;
  }

  function normalizeNext(raw){
    let s = safeDecode(raw, 3);
    s = stripNestedNext(s);
    s = safeDecode(s, 2).trim();

    if(!s) return "";

    // Clamp length (avoid proxy limits)
    if(s.length > 512) s = s.slice(0, 512);

    // Disallow javascript: and data:
    if(/^\s*(javascript:|data:)/i.test(s)) return "";

    // If absolute URL, force same-origin
    if(/^https?:\/\//i.test(s)){
      try{
        const u = new URL(s);
        if(u.origin !== location.origin) return "";
        // Return origin-relative
        return u.pathname + u.search + u.hash;
      }catch(_e){ return ""; }
    }

    // Ensure it is a relative URL
    if(s.startsWith("//")) return "";
    return s;
  }

  function consumeNextParam(){
    try{
      const url = new URL(location.href);
      const raw = url.searchParams.get("next");
      if(!raw) return;

      const next = normalizeNext(raw);

      // Store only if it's not pointing back to current page (to avoid loops)
      if(next){
        const curPath = location.pathname.replace(/\/+$/,"");
        const nextPath = String(next).split("?")[0].split("#")[0].replace(/\/+$/,"");
        if(nextPath && nextPath !== curPath){
          try{ sessionStorage.setItem(NEXT_KEY, next); }catch(_e){}
        }
      }

      // Remove next from URL (prevents growth on subsequent redirects)
      url.searchParams.delete("next");
      history.replaceState(null, "", url.toString());
    }catch(_e){}
  }

  // Expose helper for index/app to redirect after login
  window.TasunNextFix = {
    KEY: NEXT_KEY,
    consume: consumeNextParam,
    take: function(){
      try{
        const v = sessionStorage.getItem(NEXT_KEY);
        if(!v) return "";
        sessionStorage.removeItem(NEXT_KEY);
        return v;
      }catch(_e){ return ""; }
    }
  };

  consumeNextParam();
})();
