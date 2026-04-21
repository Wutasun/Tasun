(function(global){
  'use strict';

  var cache = null;
  function norm(v){ return v == null ? '' : String(v).trim(); }
  function withV(url){
    try{ return typeof global.__withV === 'function' ? global.__withV(url) : url; }catch(_e){ return url; }
  }
  async function loadResources(){
    if(cache) return cache;
    if(global.TASUN_API_BASE){
      cache = { api:{ base:String(global.TASUN_API_BASE) }, resources:{} };
      return cache;
    }
    try{
      var res = await fetch(withV('tasun-resources.json') + (withV('tasun-resources.json').indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(), { cache:'no-store', credentials:'same-origin' });
      if(res.ok){
        cache = await res.json();
        if(cache && cache.api && cache.api.base){
          global.TASUN_API_BASE = String(cache.api.base);
        }
        return cache || { api:{ base:'' }, resources:{} };
      }
    }catch(_e){}
    cache = { api:{ base:'' }, resources:{} };
    return cache;
  }
  async function load(){
    return loadResources();
  }
  function getApiBaseSync(){
    if(cache && cache.api && cache.api.base) return String(cache.api.base);
    return String(global.TASUN_API_BASE || '');
  }
  async function getApiBase(){
    var cfg = await loadResources();
    return norm(cfg && cfg.api && cfg.api.base);
  }
  async function getPageResource(pageFile){
    var cfg = await loadResources();
    var key = norm(pageFile || ((global.__TASUN_GLOBALS__ || {}).PAGE_FILE) || location.pathname.split('/').pop() || '');
    return cfg && cfg.resources ? (cfg.resources[key] || null) : null;
  }

  var api = {
    load: load,
    loadResources: loadResources,
    getApiBase: getApiBaseSync,
    getApiBaseAsync: getApiBase,
    getPageResource: getPageResource
  };

  global.TasunCloudWrapV4 = api;
  global.TasunCloudwrapV4 = api;
  try{ loadResources(); }catch(_e){}
})(window);
