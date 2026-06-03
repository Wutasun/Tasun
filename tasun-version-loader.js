/* Tasun Version Loader v5.2 page-entry-only authority final
 * 正式版號唯一來源：tasun-version.json；正式頁只讀自己的 page entry，避免其他檔案修改 root version 後互相導向或開頁閃爍。
 */
(function(){
  "use strict";
  var VERSION_JSON_URL = "tasun-version.json";
  var CACHE_KEY = "tasun_single_version_cache_v52_page_entry";
  var NON_FORMAL_FALLBACK = "tasun_v5_boot_fallback";
  var READY_RESOLVE = function(){};
  var READY = new Promise(function(resolve){ READY_RESOLVE = resolve; });
  window.__TASUN_VERSION_READY__ = READY;
  function norm(v){ return (v === undefined || v === null) ? "" : String(v).trim(); }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(_e){ return null; } }
  function pageFile(){ try{ return decodeURIComponent((location.pathname.split('/').pop() || 'index.html').trim()) || 'index.html'; }catch(_e){ return (location.pathname.split('/').pop() || 'index.html').trim() || 'index.html'; } }
  function pageKey(){
    try{
      var G = window.__TASUN_GLOBALS__ || {};
      return norm(window.__TASUN_PAGE_KEY__ || G.PAGE_KEY || G.pageKey || '');
    }catch(_e){ return ''; }
  }
  function addVer(url, ver){
    var vv = norm(ver); if(!vv) return url;
    try{ var u = new URL(url, location.href); if(u.origin !== location.origin) return url; u.searchParams.set("v", vv); return u.pathname + u.search + u.hash; }
    catch(_e){ var s=String(url||''); if(!s || /^https?:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return s; return s + (s.indexOf("?")>=0 ? "&" : "?") + "v=" + encodeURIComponent(vv); }
  }
  function setGlobals(ver, buildStamp, cfg, page){
    ver = norm(ver); buildStamp = norm(buildStamp);
    if(ver){ window.APP_VER = ver; window.TASUN_APP_VER = ver; window.__CACHE_V = ver; window.__withV = function(href){ return addVer(href, ver); }; }
    if(buildStamp){ window.__TASUN_BUILD_STAMP__ = buildStamp; window.__TASUN_PAGE_BUILD_TARGET__ = buildStamp; window.__TASUN_LATEST_BUILD_STAMP__ = buildStamp; window.__TASUN_PAGE_BUILD_STAMP__ = buildStamp; }
    if(cfg && typeof cfg === "object"){
      window.__TASUN_VERSION_CONFIG__ = cfg;
      window.__TASUN_VERSION_MODE__ = norm(cfg.versionMode || "auto");
      window.__TASUN_INCLUDE_CURRENT_PAGE__ = cfg.includeCurrentPage !== false;
      window.__TASUN_AUTO_VERSION_ENABLED__ = window.__TASUN_VERSION_MODE__ === "auto";
      window.__TASUN_RELEASE_SCRIPT__ = norm(cfg.release && cfg.release.script || "publish-version_tasun_project_autoscan.mjs");
      window.__TASUN_RELEASE_WORKFLOW__ = norm(cfg.release && cfg.release.workflow || ".github/workflows/release-version.yml");
    }
    window.__TASUN_VERSION_PAGE_ENTRY__ = page || null;
    window.__TASUN_VERSION_AUTHORITY_MODE__ = "page_entry_only_r456";
  }
  function readCache(){ var raw=""; try{ raw=sessionStorage.getItem(CACHE_KEY)||localStorage.getItem(CACHE_KEY)||""; }catch(_e){} var row=safeJSON(raw); return (row&&typeof row==='object')?row:null; }
  function saveCache(ver, buildStamp, cfg, pageName){
    var payload=JSON.stringify({ ver:norm(ver), buildStamp:norm(buildStamp), pageFile:pageName||pageFile(), versionMode:norm(cfg&&cfg.versionMode||'auto'), includeCurrentPage:!(cfg&&cfg.includeCurrentPage===false), at:Date.now() });
    try{ sessionStorage.setItem(CACHE_KEY,payload); }catch(_e){} try{ localStorage.setItem(CACHE_KEY,payload); }catch(_e){}
  }
  async function fetchVersionConfig(){
    var u=new URL(VERSION_JSON_URL, location.href); u.searchParams.set("_", String(Date.now())+"_"+Math.random().toString(16).slice(2));
    var res=await fetch(u.toString(), { cache:"no-store", credentials:"same-origin", headers:{"Cache-Control":"no-cache","Pragma":"no-cache"} });
    if(!res.ok) throw new Error("tasun-version.json:HTTP "+res.status);
    var cfg=safeJSON(await res.text()); if(!cfg||typeof cfg!=="object") throw new Error("tasun-version.json invalid"); return cfg;
  }
  function rootVersion(cfg){ var meta=(cfg&&cfg.meta)||{}; return norm(cfg.version||cfg.ver||cfg.appVer||cfg.APP_VER||cfg.appVersion||cfg.cacheV||cfg.cache_v||cfg.manualVersion||cfg.fallbackVersion||meta.version||meta.ver||meta.appVer||meta.cacheV||""); }
  function rootBuildStamp(cfg){ var meta=(cfg&&cfg.meta)||{}; return norm(cfg.buildStamp||cfg.build_stamp||cfg.pageBuildStamp||cfg.page_build_stamp||cfg.rebuildStamp||meta.buildStamp||meta.build_stamp||meta.pageBuildStamp||meta.rebuildStamp||""); }
  function pickPageEntry(cfg){
    cfg=(cfg&&typeof cfg==='object')?cfg:{}; var pages=(cfg.pages&&typeof cfg.pages==='object')?cfg.pages:{}; var pf=pageFile(); var pk=pageKey();
    var p=pages[pf] || (pk?pages[pk]:null) || null;
    if(!p){
      var noExt=pf.replace(/\.html?$/i,'');
      p=pages[noExt] || null;
    }
    if(p&&typeof p==='object'){
      var v=norm(p.version||p.cacheV||p.buildStamp||p.pageBuildStamp||p.rebuildStamp||'');
      var bs=norm(p.pageBuildStamp||p.buildStamp||p.rebuildStamp||p.cacheV||p.version||v);
      return { page:p, version:v, buildStamp:bs, hasPageEntry:true, pageFile:pf, pageKey:pk };
    }
    return { page:null, version:rootVersion(cfg), buildStamp:rootBuildStamp(cfg), hasPageEntry:false, pageFile:pf, pageKey:pk };
  }
  function currentUrlVersion(){ try{ return norm(new URL(location.href).searchParams.get("v")); }catch(_e){ return ""; } }
  function maybeRedirect(ver, hasPageEntry){
    ver=norm(ver); if(!ver || !hasPageEntry) return; // r456：沒有本頁 entry 時不因 root version 重新導向。
    try{
      var u=new URL(location.href), cur=norm(u.searchParams.get("v"));
      var guardKey="tasun_single_ver_guard_page_entry__"+(location.pathname||"")+"__"+ver;
      var already=false; try{ already=sessionStorage.getItem(guardKey)==="1"; }catch(_e){}
      if(cur!==ver && !already){ try{ sessionStorage.setItem(guardKey,"1"); }catch(_e){} u.searchParams.set("v",ver); u.searchParams.set("_",String(Date.now())); location.replace(u.toString()); }
    }catch(_e){}
  }
  (async function(){
    try{
      var cached=readCache(); var initial=norm(currentUrlVersion()||(cached&&cached.ver)||""); var initialBuild=norm(cached&&cached.buildStamp||""); if(initial) setGlobals(initial, initialBuild, null, null);
      var cfg=await fetchVersionConfig(); var picked=pickPageEntry(cfg); var ver=picked.version || initial || NON_FORMAL_FALLBACK; var bs=picked.buildStamp || ver;
      setGlobals(ver, bs, cfg, picked.page); saveCache(ver, bs, cfg, picked.pageFile); maybeRedirect(ver, picked.hasPageEntry); READY_RESOLVE(true);
    }catch(_e){ var cached=readCache(); var fallback=norm(currentUrlVersion()||(cached&&cached.ver)||NON_FORMAL_FALLBACK); var fallbackBuild=norm(cached&&cached.buildStamp||""); setGlobals(fallback, fallbackBuild, null, null); READY_RESOLVE(true); }
  })();
})();
