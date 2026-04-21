(function(global){
  'use strict';
  try{ global.__TASUN_BOOT_AT__ = Date.now(); }catch(_e){}
  function runStable(reason){
    try{
      if(typeof global.__TASUN_STABLE_CALIBRATOR__ === 'function'){
        global.__TASUN_STABLE_CALIBRATOR__(reason);
      }else if(typeof global.__TASUN_ENSURE_LATEST_BUILDSTAMP__ === 'function'){
        Promise.resolve(global.__TASUN_ENSURE_LATEST_BUILDSTAMP__(reason)).catch(function(){});
      }
    }catch(_e){}
  }
  ['DOMContentLoaded','load','pageshow','focus'].forEach(function(ev){
    global.addEventListener(ev, function(){ runStable(ev); }, { passive:true });
  });
})(window);
