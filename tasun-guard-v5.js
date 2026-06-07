/*!
 * tasun-guard-v5 r501 (index login + direct-open target bridge)
 * - Direct child pages require Tasun index login when no session exists.
 * - Stores same-origin next path in session/local storage, redirects to index.html?next=...
 */
(function(global){
  "use strict";
  var NEXT_KEYS = ["tasun_direct_open_target_v1", "tasun_entry_next_v1", "tasun_next_path_v1"];
  function norm(v){ return v == null ? "" : String(v).trim(); }
  function sameOriginPath(href){ try{ var u = new URL(href, location.href); if(u.origin !== location.origin) return ""; return u.pathname + u.search + u.hash; }catch(_e){ return (href && String(href).charAt(0)==="/") ? String(href) : ""; } }
  function indexUrl(nextPath){ var u = new URL("index.html", location.href); if(nextPath) u.searchParams.set("next", nextPath); u.searchParams.set("_login", "1"); u.searchParams.set("_auth", "direct"); u.searchParams.set("_", String(Date.now())); return u.toString(); }
  function setNext(path){ path = sameOriginPath(path || location.href); if(!path || /\/index\.html(?:[?#]|$)/i.test(path)) return; NEXT_KEYS.forEach(function(k){ try{ sessionStorage.setItem(k, path); }catch(_e){} try{ localStorage.setItem(k, path); }catch(_e){} }); }
  function readUserLike(raw){ try{ var o=JSON.parse(raw||""); if(!o || typeof o !== "object") return null; var u=norm(o.user||o.username||o.name||o.account||o.uid); if(!u || u==="—" || u==="-") return null; return o; }catch(_e){ return null; } }
  function hasStorageSession(){ var keys=["tasunCurrentUser_v1","tasunSessionBridge_v1","tasunSession_v1","tasunSessionLogin_v2","tasunSso_v2","tasunSso_v1","tasunAuthSession_v1","tasunCurrentUser_v2","tasunIndexUser_v1"]; for(var i=0;i<keys.length;i++){ var raw=""; try{ raw=sessionStorage.getItem(keys[i])||""; }catch(_e){} if(!raw){ try{ raw=localStorage.getItem(keys[i])||""; }catch(_e){} } if(readUserLike(raw)) return true; } return false; }
  function isLoggedIn(){
    try{ if(typeof global.__TASUN_IS_LOGGED_IN__ === "function" && global.__TASUN_IS_LOGGED_IN__()) return true; }catch(_e){}
    try{ if(global.TasunAuthV4 && global.TasunAuthV4.getCurrent && global.TasunAuthV4.getCurrent()) return true; }catch(_e){}
    try{ if(global.TasunGlobalCore && global.TasunGlobalCore.getCurrentUser && global.TasunGlobalCore.getCurrentUser()) return true; }catch(_e){}
    return hasStorageSession();
  }
  function redirectToIndex(nextPath){ var p = sameOriginPath(nextPath || location.href); setNext(p); location.replace(indexUrl(p)); }
  global.TASUN_GUARD_V5 = { setNext:setNext, redirectToIndex:redirectToIndex, redirectToEntry:redirectToIndex, isLoggedIn:isLoggedIn };
  try{ if(!!global.__TASUN_REQUIRE_LOGIN__ && !isLoggedIn()) redirectToIndex(location.href); }catch(_e){}
})(window);
