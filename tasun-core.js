/* Tasun Core v5-r300-auto-version
   提供 index/子頁會用到的基本工具：withV/jsonParse/clamp/rafDebounce/ready
   ✅不改 UI：只提供穩定的共用函式
*/
(function(){
  'use strict';

  const Core = {};

  Core.appVer = String(window.__CACHE_V || window.TASUN_APP_VER || window.APP_VER || '').trim();

  Core.withV = function(u){
    const vv = String(window.__CACHE_V || Core.appVer || '').trim();
    if(!vv) return String(u||'');
    try{
      const uu = new URL(String(u||''), document.baseURI);
      if(uu.origin === location.origin){
        uu.searchParams.set('v', vv);
        return uu.toString();
      }
      return String(u||'');
    }catch(_){
      const s = String(u||'');
      if(!s || /^https?:\/\//i.test(s) || /^mailto:/i.test(s)) return s;
      const sep = s.includes('?') ? '&' : '?';
      return s + sep + 'v=' + encodeURIComponent(vv);
    }
  };

  Core.jsonParse = function(s, fallback){
    try{ return JSON.parse(s); }catch(_){ return fallback; }
  };

  Core.clamp = function(n,a,b){
    n = Number(n); a = Number(a); b = Number(b);
    return Math.max(a, Math.min(b, n));
  };

  Core.rafDebounce = function(fn){
    let r = 0;
    return function(){
      try{ cancelAnimationFrame(r); }catch(_){ }
      r = requestAnimationFrame(function(){
        try{ fn(); }catch(_){ }
      });
    };
  };



  Core.AUTO_VERSION_STANDARD = Object.assign({}, window.__TASUN_AUTO_VERSION_STANDARD__ || {}, {
    versionMode:'auto',
    includeCurrentPage:true,
    versionJson:'tasun-version.json',
    releaseScript:'publish-version_tasun_project_autoscan.mjs',
    releaseWorkflow:'.github/workflows/release-version.yml',
    rebuildStampFile:'TASUN_REBUILD_STAMP',
    htmlBuildStampMeta:'tasun-build-stamp'
  });

  Core.getCurrentVersion = function(){
    return String(window.__CACHE_V || window.TASUN_APP_VER || window.APP_VER || Core.appVer || '').trim();
  };

  Core.parseVersionConfig = function(cfg){
    cfg = (cfg && typeof cfg === 'object') ? cfg : {};
    const meta = cfg.meta || {};
    return {
      version: String(cfg.version || cfg.ver || cfg.appVer || cfg.APP_VER || cfg.cacheV || cfg.cache_v || meta.version || '').trim(),
      buildStamp: String(cfg.buildStamp || cfg.build_stamp || cfg.pageBuildStamp || meta.buildStamp || '').trim(),
      versionMode: String(cfg.versionMode || '').trim(),
      includeCurrentPage: cfg.includeCurrentPage === true,
      releaseScript: String((cfg.release && cfg.release.script) || '').trim(),
      releaseWorkflow: String((cfg.release && cfg.release.workflow) || '').trim(),
      autoVersion: !!(meta.autoVersion || cfg.versionMode === 'auto')
    };
  };

  Core.validateAutoVersionConfig = function(cfg){
    const v = Core.parseVersionConfig(cfg);
    const ok = v.versionMode === 'auto' && v.includeCurrentPage === true &&
      v.releaseScript === 'publish-version_tasun_project_autoscan.mjs' &&
      v.releaseWorkflow === '.github/workflows/release-version.yml' &&
      !!v.version && !!v.buildStamp;
    return Object.assign({ ok: ok }, v);
  };

  Core.getVersionState = function(cfg){
    const parsed = cfg ? Core.validateAutoVersionConfig(cfg) : null;
    return {
      currentVersion: Core.getCurrentVersion(),
      cacheV: String(window.__CACHE_V || '').trim(),
      appVer: String(window.TASUN_APP_VER || window.APP_VER || '').trim(),
      autoVersionStandard: Core.AUTO_VERSION_STANDARD,
      config: parsed,
      checkedAt: new Date().toISOString()
    };
  };

  Core.installWithV = function(){
    const ver = Core.getCurrentVersion();
    if(ver){
      Core.appVer = ver;
      window.__CACHE_V = window.__CACHE_V || ver;
      window.TASUN_APP_VER = window.TASUN_APP_VER || ver;
      window.APP_VER = window.APP_VER || ver;
    }
    window.__withV = function(href){ return Core.withV(href); };
    window.__TASUN_AUTO_VERSION_STANDARD__ = Object.assign({}, window.__TASUN_AUTO_VERSION_STANDARD__ || {}, Core.AUTO_VERSION_STANDARD);
    return true;
  };

  Core.assertAutoVersionReady = function(){
    const s = window.__TASUN_AUTO_VERSION_STANDARD__ || Core.AUTO_VERSION_STANDARD || {};
    return !!(s.versionMode === 'auto' && s.includeCurrentPage === true && s.releaseScript && s.releaseWorkflow);
  };

  Core.ready = function(cb, timeoutMs){
    const t = Math.max(0, Number(timeoutMs||0));
    let done = false;
    function fire(){ if(done) return; done = true; try{ cb(); }catch(_){ } }
    if(document.readyState === 'complete' || document.readyState === 'interactive'){
      setTimeout(fire, 0);
    }else{
      document.addEventListener('DOMContentLoaded', fire, { once:true });
    }
    if(t){ setTimeout(fire, t); }
  };

  Core.installWithV();

  window.TasunCore = Object.assign(window.TasunCore || {}, Core);
  window.__TASUN_CORE_R300_AUTO_VERSION__ = true;
})();
