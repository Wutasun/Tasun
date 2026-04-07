\
/* Tasun Version Loader v5 single-source final
 * 正式版號唯一來源：tasun-version.json -> version
 * 頁面 / 首頁 / 子頁 / 核心檔不得再手寫正式版號
 */
(function(){
  "use strict";

  var VERSION_JSON_URL = "tasun-version.json";
  var CACHE_KEY = "tasun_single_version_cache_v5";
  var NON_FORMAL_FALLBACK = "tasun_v5_boot_fallback";

  var READY_RESOLVE = function(){};
  var READY = new Promise(function(resolve){ READY_RESOLVE = resolve; });
  window.__TASUN_VERSION_READY__ = READY;

  function norm(v){ return (v === undefined || v === null) ? "" : String(v).trim(); }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(_e){ return null; } }

  function addVer(url, ver){
    var vv = norm(ver);
    if(!vv) return url;
    try{
      var u = new URL(url, location.href);
      if(u.origin !== location.origin) return url;
      u.searchParams.set("v", vv);
      return u.pathname + u.search + u.hash;
    }catch(_e){
      var s = String(url || "");
      if(!s || /^https?:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
      return s + (s.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }

  function setGlobals(ver){
    ver = norm(ver);
    if(!ver) return;
    window.APP_VER = ver;
    window.TASUN_APP_VER = ver;
    window.__CACHE_V = ver;
    window.__withV = function(href){ return addVer(href, ver); };
  }

  function readCache(){
    var raw = "";
    try{ raw = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY) || ""; }catch(_e){}
    var row = safeJSON(raw);
    return (row && typeof row === "object") ? row : null;
  }

  function saveCache(ver){
    var payload = JSON.stringify({ ver: norm(ver), at: Date.now() });
    try{ sessionStorage.setItem(CACHE_KEY, payload); }catch(_e){}
    try{ localStorage.setItem(CACHE_KEY, payload); }catch(_e){}
  }

  async function fetchVersionConfig(){
    var u = new URL(VERSION_JSON_URL, location.href);
    u.searchParams.set("_", String(Date.now()) + "_" + Math.random().toString(16).slice(2));
    var res = await fetch(u.toString(), { cache:"no-store", credentials:"omit" });
    if(!res.ok) throw new Error("tasun-version.json:HTTP " + res.status);
    var raw = await res.text();
    var cfg = safeJSON(raw);
    if(!cfg || typeof cfg !== "object") throw new Error("tasun-version.json invalid");
    return cfg;
  }

  function parseVersion(cfg){
    cfg = (cfg && typeof cfg === "object") ? cfg : {};
    return norm(cfg.version || "");
  }

  function currentUrlVersion(){
    try{ return norm(new URL(location.href).searchParams.get("v")); }catch(_e){ return ""; }
  }

  function maybeRedirect(ver){
    ver = norm(ver);
    if(!ver) return;
    try{
      var u = new URL(location.href);
      var cur = norm(u.searchParams.get("v"));
      var guardKey = "tasun_single_ver_guard__" + (location.pathname || "") + "__" + ver;
      var already = false;
      try{ already = sessionStorage.getItem(guardKey) === "1"; }catch(_e){}
      if(cur !== ver && !already){
        try{ sessionStorage.setItem(guardKey, "1"); }catch(_e){}
        u.searchParams.set("v", ver);
        u.searchParams.set("_", String(Date.now()));
        location.replace(u.toString());
      }
    }catch(_e){}
  }

  (async function(){
    try{
      var cached = readCache();
      var initial = norm(currentUrlVersion() || (cached && cached.ver) || "");
      if(initial) setGlobals(initial);

      var cfg = await fetchVersionConfig();
      var ver = parseVersion(cfg);

      if(!ver){
        ver = initial || NON_FORMAL_FALLBACK;
      }

      setGlobals(ver);
      saveCache(ver);
      maybeRedirect(ver);
      READY_RESOLVE(true);
    }catch(_e){
      var cached = readCache();
      var fallback = norm(currentUrlVersion() || (cached && cached.ver) || NON_FORMAL_FALLBACK);
      setGlobals(fallback);
      READY_RESOLVE(true);
    }
  })();
})();
