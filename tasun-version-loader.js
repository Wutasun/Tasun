/* Tasun Version Loader v6 core-chain aligned
 * 正式版號唯一來源：tasun-version.json -> version
 * 核心收斂：version + rebuild stamp + 遠端實頁 比對統一由本檔處理
 */
(function(){
  "use strict";

  var VERSION_JSON_URL = "tasun-version.json";
  var CACHE_KEY = "tasun_single_version_cache_v6";
  var REDIRECT_GUARD_PREFIX = "tasun_single_ver_guard_v6__";
  var NON_FORMAL_FALLBACK = "tasun_v5_boot_fallback";
  var READY_RESOLVE = function(){};
  var READY = new Promise(function(resolve){ READY_RESOLVE = resolve; });
  window.__TASUN_VERSION_READY__ = READY;

  function norm(v){ return (v === undefined || v === null) ? "" : String(v).trim(); }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(_e){ return null; } }

  function getGlobals(){
    var G = window.__TASUN_GLOBALS__ = window.__TASUN_GLOBALS__ || {};
    G.PAGE_FILE = norm(G.PAGE_FILE || (location.pathname.split('/').pop() || 'index.html'));
    G.VERSION_URL = norm(G.VERSION_URL || VERSION_JSON_URL);
    G.REBUILD_STAMP_REGEX = G.REBUILD_STAMP_REGEX || /TASUN_REBUILD_STAMP:([^\n>]*)/i;
    try{
      if(!G.CURRENT_REBUILD_STAMP){
        var html = String(document.documentElement && document.documentElement.outerHTML || "");
        var m = html.match(G.REBUILD_STAMP_REGEX);
        G.CURRENT_REBUILD_STAMP = m ? norm(m[1]) : "";
      }
    }catch(_e){
      G.CURRENT_REBUILD_STAMP = G.CURRENT_REBUILD_STAMP || "";
    }
    return G;
  }

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

  function setGlobals(ver, cfg){
    var G = getGlobals();
    ver = norm(ver);
    if(ver){
      window.APP_VER = ver;
      window.TASUN_APP_VER = ver;
      window.__CACHE_V = ver;
      window.__withV = function(href){ return addVer(href, ver); };
    }
    if(cfg && typeof cfg === "object"){
      G.VERSION_CONFIG = cfg;
      G.LATEST_VERSION = norm(cfg.version || cfg.ver || cfg.appVer || cfg.cacheV || "");
      G.BUILD_STAMP = norm(cfg.buildStamp || cfg.build_stamp || cfg.pageBuildStamp || (cfg.meta && cfg.meta.buildStamp) || "");
    }
  }

  function readCache(){
    var raw = "";
    try{ raw = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY) || ""; }catch(_e){}
    var row = safeJSON(raw);
    return (row && typeof row === "object") ? row : null;
  }

  function saveCache(ver, stamp){
    var payload = JSON.stringify({ ver: norm(ver), stamp: norm(stamp), at: Date.now() });
    try{ sessionStorage.setItem(CACHE_KEY, payload); }catch(_e){}
    try{ localStorage.setItem(CACHE_KEY, payload); }catch(_e){}
  }

  async function fetchVersionConfig(){
    var G = getGlobals();
    var u = new URL(G.VERSION_URL || VERSION_JSON_URL, location.href);
    u.searchParams.set("_", String(Date.now()) + "_" + Math.random().toString(16).slice(2));
    var res = await fetch(u.toString(), { cache:"no-store", credentials:"same-origin" });
    if(!res.ok) throw new Error("tasun-version.json:HTTP " + res.status);
    var raw = await res.text();
    var cfg = safeJSON(raw);
    if(!cfg || typeof cfg !== "object") throw new Error("tasun-version.json invalid");
    return cfg;
  }

  function parseVersion(cfg){
    cfg = (cfg && typeof cfg === "object") ? cfg : {};
    return norm(cfg.version || cfg.ver || cfg.appVer || cfg.cacheV || cfg.cache_v || "");
  }

  function parseBuildStamp(cfg){
    cfg = (cfg && typeof cfg === "object") ? cfg : {};
    return norm(cfg.buildStamp || cfg.build_stamp || cfg.pageBuildStamp || (cfg.meta && cfg.meta.buildStamp) || "");
  }

  function currentUrlVersion(){
    try{ return norm(new URL(location.href).searchParams.get("v")); }catch(_e){ return ""; }
  }

  async function fetchRemotePageStamp(pageFile){
    var G = getGlobals();
    try{
      var page = norm(pageFile || G.PAGE_FILE || "index.html");
      var u = new URL(page, location.href);
      u.searchParams.set("_", String(Date.now()));
      var res = await fetch(u.toString(), { cache:"no-store", credentials:"same-origin" });
      if(!res.ok) return "";
      var html = await res.text();
      var m = String(html || "").match(G.REBUILD_STAMP_REGEX);
      return m ? norm(m[1]) : "";
    }catch(_e){
      return "";
    }
  }

  function shouldThrottleRedirect(ver, stamp){
    try{
      var key = REDIRECT_GUARD_PREFIX + (location.pathname || "") + "__" + norm(ver) + "__" + norm(stamp);
      var raw = sessionStorage.getItem(key) || "";
      var row = raw ? safeJSON(raw) : null;
      var now = Date.now();
      if(row && (now - Number(row.ts || 0)) < 12000) return true;
      sessionStorage.setItem(key, JSON.stringify({ ts: now }));
    }catch(_e){}
    return false;
  }

  async function maybeRedirect(ver, buildStamp){
    ver = norm(ver);
    buildStamp = norm(buildStamp);
    if(!ver) return false;

    var G = getGlobals();
    var curVer = currentUrlVersion();
    var localStamp = norm(G.CURRENT_REBUILD_STAMP || "");
    var remoteStamp = await fetchRemotePageStamp(G.PAGE_FILE);
    var needRedirect = false;

    try{
      var u = new URL(location.href);
      if(curVer !== ver){
        u.searchParams.set("v", ver);
        needRedirect = true;
      }
      if(remoteStamp && localStamp && remoteStamp !== localStamp){
        needRedirect = true;
      }else if(buildStamp && localStamp && buildStamp !== localStamp){
        needRedirect = true;
      }
      if(!needRedirect) return false;
      if(shouldThrottleRedirect(ver, remoteStamp || buildStamp || localStamp)) return false;
      u.searchParams.set("v", ver);
      u.searchParams.set("_", String(Date.now()));
      location.replace(u.toString());
      return true;
    }catch(_e){}
    return false;
  }

  (async function(){
    try{
      var cached = readCache();
      var initial = norm(currentUrlVersion() || (cached && cached.ver) || "");
      if(initial) setGlobals(initial, null);

      var cfg = await fetchVersionConfig();
      var ver = parseVersion(cfg);
      var stamp = parseBuildStamp(cfg);

      if(!ver){
        ver = initial || NON_FORMAL_FALLBACK;
      }

      setGlobals(ver, cfg);
      saveCache(ver, stamp);
      var redirected = await maybeRedirect(ver, stamp);
      if(redirected) return;
      READY_RESOLVE(true);
    }catch(_e){
      var cached = readCache();
      var fallback = norm(currentUrlVersion() || (cached && cached.ver) || NON_FORMAL_FALLBACK);
      setGlobals(fallback, null);
      READY_RESOLVE(true);
    }
  })();
})();
