(function(global){
  'use strict';
  function norm(v){ return v == null ? '' : String(v).trim(); }
  function withV(u){ try{ return typeof global.__withV === 'function' ? global.__withV(u) : u; }catch(_e){ return u; } }
  global.TasunLoader = global.TasunLoader || {
    start: function(opts){
      opts = opts || {};
      var state = global.__TASUN_LOADER_STATE__ = global.__TASUN_LOADER_STATE__ || {};
      state.startedAt = Date.now();
      state.pageKey = norm(opts.pageKey || '');
      state.versionUrl = norm(opts.verUrl || 'tasun-version.json');
      state.corePath = norm(opts.corePath || 'tasun-core.js');
      try{
        if(!global.TasunCore){
          var s = document.createElement('script');
          s.src = withV(state.corePath);
          s.async = false;
          document.head.appendChild(s);
        }
      }catch(_e){}
      return true;
    }
  };
})(window);
