/* Tasun Boot v5-r300-auto-version (minimal)
   - 只做必要的啟動前檢查/小修正，不改 UI
   - R300：登錄真正全自動版號標準，交由 tasun-version.json + GitHub Actions 發布鏈控管
*/
(function(){
  'use strict';
  if(window.__TASUN_BOOT_R300_AUTO_VERSION__) return;
  window.__TASUN_BOOT_R300_AUTO_VERSION__ = true;

  try{ window.__TASUN_BOOT_AT__ = Date.now(); }catch(_){}

  var standard = {
    versionMode: 'auto',
    includeCurrentPage: true,
    versionJson: 'tasun-version.json',
    releaseScript: 'publish-version_tasun_project_autoscan.mjs',
    releaseWorkflow: '.github/workflows/release-version.yml',
    rebuildStampFile: 'TASUN_REBUILD_STAMP',
    htmlBuildStampMeta: 'tasun-build-stamp',
    requiredFields: ['version','cacheV','buildStamp','pageBuildStamp'],
    source: 'tasun-boot.js',
    standard: 'Tasun v5 + TasunSelfHealV5 + R268/R300 auto version chain'
  };
  window.__TASUN_AUTO_VERSION_STANDARD__ = Object.assign({}, window.__TASUN_AUTO_VERSION_STANDARD__ || {}, standard);

  function norm(v){ return v == null ? '' : String(v).trim(); }
  function currentVersion(){ return norm(window.__CACHE_V || window.TASUN_APP_VER || window.APP_VER || ''); }
  window.__TASUN_GET_AUTO_VERSION_STATE__ = window.__TASUN_GET_AUTO_VERSION_STATE__ || function(){
    return {
      ok: true,
      version: currentVersion(),
      standard: window.__TASUN_AUTO_VERSION_STANDARD__ || standard,
      checkedAt: new Date().toISOString()
    };
  };

  function registerSelfHeal(){
    try{
      var core = window.TasunSelfHealV5;
      if(!core || typeof core.register !== 'function') return;
      core.register('tasunR300AutoVersionBootStandard', {
        check:function(){
          var s = window.__TASUN_AUTO_VERSION_STANDARD__ || {};
          return s.versionMode === 'auto' && s.includeCurrentPage === true && !!s.releaseScript && !!s.releaseWorkflow;
        },
        repair:function(){
          window.__TASUN_AUTO_VERSION_STANDARD__ = Object.assign({}, window.__TASUN_AUTO_VERSION_STANDARD__ || {}, standard);
          return true;
        },
        verify:function(){
          var s = window.__TASUN_AUTO_VERSION_STANDARD__ || {};
          return s.versionMode === 'auto' && s.includeCurrentPage === true;
        },
        coolDownMs:1800,
        maxRetry:3
      });
    }catch(_e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', registerSelfHeal, { once:true, passive:true });
  }else{
    registerSelfHeal();
  }
})();
