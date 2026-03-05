/*!
 * tasun-next-fix.js  (Tasun v4 stable)
 * Purpose:
 * - Prevent "next=...next=...next=..." infinite nesting that causes:
 *   1) URL too long / HTTP 414
 *   2) redirect loops between guarded pages and index
 * - Keep UI unchanged (no DOM/CSS changes).
 *
 * Placement:
 * - Put this file in the SAME folder as index.html (and all HTML pages).
 * - Include it in <head> BEFORE any redirects/loader.
 *
 * Works with:
 * - guard-all-html-*.js (or any guard that appends ?next=...)
 */
(function(){
  "use strict";

  var KEY = "tasun_next_target_v1";
  var MAX_URL = 1200;   // conservative: avoid 414 on GH Pages/CF/NGINX
  var MAX_NEST = 2;     // allow small nesting, but stop the runaway

  function safeDecode(s){
    try{ return decodeURIComponent(s); }catch(_){ return String(s||""); }
  }

  function normalizePath(p){
    p = String(p||"").trim();
    if(!p) return "";
    // If full URL: keep only path+search+hash for same-origin navigation
    try{
      var u = new URL(p, location.href);
      if(u.origin === location.origin){
        return u.pathname + u.search + u.hash;
      }
    }catch(_){}
    // if it looks like protocol URL -> do not store (safety)
    if(/^https?:\/\//i.test(p)) return "";
    return p;
  }

  function extractNext(urlObj){
    var next = urlObj.searchParams.get("next");
    if(!next) return "";
    // Prefer first; if multiple next params exist, ignore the rest
    next = String(next);

    // If already absurdly long, truncate by dropping nested query and hash
    if(next.length > 4000){
      next = next.slice(0, 4000);
    }

    // Try decode once (many guards encodeURIComponent)
    var dec = safeDecode(next);

    // If dec itself is a full URL (same-origin), normalize it
    var norm = normalizePath(dec) || normalizePath(next);
    if(!norm) return "";

    return norm;
  }

  function stripNext(urlObj){
    urlObj.searchParams.delete("next");
    // also strip repeated next (some libs add next multiple times)
    // delete() removes all instances
  }

  function countNestedNext(s){
    var t = String(s||"");
    var n = 0;
    // crude: count "?next=" or "&next=" occurrences
    var m = t.match(/(?:\?|&)next=/g);
    n = m ? m.length : 0;
    return n;
  }

  try{
    var url = new URL(location.href);

    var rawHref = url.href;
    var hasNext = url.searchParams.has("next");
    if(!hasNext) return;

    var target = extractNext(url);
    var nested = countNestedNext(rawHref);

    // Store target if:
    // - exists
    // - is not current page
    // - and nesting/length indicates danger OR always store if present
    if(target){
      // prevent redirect loop back to same index
      var cur = location.pathname.replace(/\/+$/,"");
      var tarPath = target.split("?")[0].split("#")[0].replace(/\/+$/,"");
      if(tarPath && tarPath !== cur){
        try{ sessionStorage.setItem(KEY, target); }catch(_){}
      }
    }

    // Clean URL in-place to stop growth:
    // If URL too long or nested too deep => remove next immediately.
    // Even if not too long, removing next makes refresh stable.
    if(rawHref.length > MAX_URL || nested > MAX_NEST || true){
      stripNext(url);
      var cleaned = url.pathname + (url.search || "") + (url.hash || "");
      // replaceState: NO reload, no history growth
      history.replaceState(null, "", cleaned);
    }
  }catch(_e){}
})();
