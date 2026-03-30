/* Tasun version-loader fixed-final 2026-03-30 */
(function(){
  "use strict";
  var VERSION_JSON_URL = "tasun-version.json";
  var READY_RESOLVE = function(){};
  window.__TASUN_VERSION_READY__ = new Promise(function(resolve){ READY_RESOLVE = resolve; });
  function norm(s){ return (s===undefined||s===null) ? "" : String(s).trim(); }
  function addVer(url, ver){
    var vv = norm(ver);
    if(!vv) return url;
    try{
      var u = new URL(url, location.href);
      if(u.origin !== location.origin) return url;
      u.searchParams.set("v", vv);
      return u.pathname + u.search + u.hash;
    }catch(e){
      var s = String(url || "");
      if(!s || /^https?:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
      return s + (s.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }
  function setGlobals(ver){
    ver = norm(ver) || "20260330_tasun_v5_total_final";
    window.APP_VER = ver;
    window.TASUN_APP_VER = ver;
    window.__CACHE_V = ver;
    window.__withV = function(href){ return addVer(href, ver); };
    return ver;
  }
  async function main(){
    var ver = "20260330_tasun_v5_total_final";
    try{
      var res = await fetch(VERSION_JSON_URL + "?_=" + Date.now(), { cache:"no-store", credentials:"omit" });
      if(res.ok){
        var cfg = await res.json();
        ver = norm(cfg.manualVersion || cfg.ver || cfg.version || cfg.appVer || cfg.APP_VER || cfg.appVersion || cfg.fallbackVersion) || ver;
      }
    }catch(e){}
    ver = setGlobals(ver);
    try{
      var u = new URL(location.href);
      var cur = norm(u.searchParams.get("v"));
      if(!cur || /^auto_/i.test(cur) || cur !== ver){
        u.searchParams.set("v", ver);
        history.replaceState(null, "", u.toString());
      }
    }catch(e){}
    try{ READY_RESOLVE(true); }catch(e){}
  }
  main();
})();
