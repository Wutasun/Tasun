/* Tasun next-fix v4 (stable)
   Prevent infinite ?next= nesting causing "URI Too Long" (HTTP 414).
   - Sanitizes next parameter on page load and stores safe target in sessionStorage.
   - Removes unsafe/too-long/recursive next from URL via history.replaceState.
   - Provides window.__tasun_get_next_target__() for post-login redirect.
*/
(function(){
  "use strict";
  var KEY = "tasun_next_target_v1";
  var MAX_LEN = 360; // keep URLs short (GitHub Pages / proxies safe)

  function safeDecode(s){
    try{ return decodeURIComponent(String(s||"")); }catch(_){ return String(s||""); }
  }

  function normalizeTarget(t){
    t = String(t||"").trim();
    if(!t) return "";
    // block javascript: and data:
    if(/^(javascript|data):/i.test(t)) return "";
    // decode once if it looks encoded
    var decoded = safeDecode(t);
    if(decoded && decoded !== t) t = decoded;

    // If it contains another next=, drop it to avoid nesting
    try{
      var u = new URL(t, location.href);
      if(u.origin !== location.origin) return ""; // disallow cross-origin next
      u.searchParams.delete("next");
      // avoid redirecting back to this same page
      var cur = new URL(location.href);
      cur.searchParams.delete("next");
      if(u.pathname === cur.pathname && u.search === cur.search) return "";
      var out = u.pathname + (u.search||"") + (u.hash||"");
      if(out.length > MAX_LEN) return "";
      return out;
    }catch(_e){
      // relative path fallback
      if(t.length > MAX_LEN) return "";
      if(t.indexOf("next=") >= 0) return "";
      if(t.startsWith("#")) return "";
      // do not allow full external URLs here
      if(/^https?:\/\//i.test(t)) return "";
      return t;
    }
  }

  function setTarget(t){
    try{ sessionStorage.setItem(KEY, t); }catch(_e){}
  }
  function getTarget(){
    try{
      var t = sessionStorage.getItem(KEY);
      return String(t||"").trim();
    }catch(_e){ return ""; }
  }
  function clearTarget(){
    try{ sessionStorage.removeItem(KEY); }catch(_e){}
  }

  // Expose getter for index.html applyUser() to call after login
  window.__tasun_get_next_target__ = function(){
    var t = getTarget();
    if(!t) return "";
    clearTarget();
    return t;
  };

  // On load: sanitize URL ?next=
  try{
    var url = new URL(location.href);
    var rawNext = url.searchParams.get("next");
    if(rawNext){
      var safe = normalizeTarget(rawNext);
      if(safe){
        setTarget(safe);
      }
      // Always remove next from URL to stop nesting growth
      url.searchParams.delete("next");
      history.replaceState(null, "", url.toString());
    }
  }catch(_e){}
})();