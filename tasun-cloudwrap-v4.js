/* TasunCloudWrapV4 (v4 FINAL)
 * - 提供 getApiBase() 給 index 取得 Worker base
 * - 不改 UI：純工具
 */
(function(global){
  'use strict';

  var _apiBase = null;
  async function load(){
    if(_apiBase) return _apiBase;
    // 允許先用全域覆蓋
    if(global.TASUN_API_BASE){ _apiBase = String(global.TASUN_API_BASE); return _apiBase; }
    try{
      var res = await fetch('tasun-resources.json', { cache:'no-store' });
      if(res.ok){
        var cfg = await res.json();
        if(cfg && cfg.api && cfg.api.base){
          _apiBase = String(cfg.api.base);
          global.TASUN_API_BASE = _apiBase;
          return _apiBase;
        }
      }
    }catch(e){}
    _apiBase = '';
    return _apiBase;
  }

  function getApiBaseSync(){
    return _apiBase || String(global.TASUN_API_BASE || '');
  }

  global.TasunCloudWrapV4 = {
    load: load,
    getApiBase: getApiBaseSync
  };

  // 先行背景載入（不阻塞）
  try{ load(); }catch(e){}
})(window);
