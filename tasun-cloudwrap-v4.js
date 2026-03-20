/* TasunCloudWrapV4 (v5 unified)
 * - resources/api base loader
 * - bearer/session aware fetch wrapper
 */
(function(global){
  'use strict';
  var _apiBase = null;
  function withV(path){ try{ return global.__withV ? global.__withV(path) : path; }catch(e){ return path; } }
  function token(){ try{ return sessionStorage.getItem('tasunBearerToken_v1') || sessionStorage.getItem('tasunCloudToken_v1') || ''; }catch(e){ return ''; } }
  async function load(){
    if(_apiBase) return _apiBase;
    if(global.TASUN_API_BASE){ _apiBase = String(global.TASUN_API_BASE); return _apiBase; }
    try{
      var res = await fetch(withV('tasun-resources.json'), { cache:'no-store', credentials:'include' });
      if(res.ok){ var cfg = await res.json(); if(cfg && cfg.api && cfg.api.base){ _apiBase = String(cfg.api.base); global.TASUN_API_BASE = _apiBase; return _apiBase; } }
    }catch(e){}
    _apiBase=''; return _apiBase;
  }
  function getApiBase(){ return _apiBase || String(global.TASUN_API_BASE || ''); }
  async function authFetch(path, init){ var apiBase = await load(); var url = /^https?:/i.test(path||'') ? path : String(apiBase||'').replace(/\/$/,'') + String(path||''); init = init || {}; var headers = Object.assign({'Accept':'application/json'}, init.headers || {}); var tk = token(); if(tk) headers['Authorization'] = 'Bearer ' + tk; return fetch(url, Object.assign({ credentials:'include' }, init, { headers: headers })); }
  global.TASUN_API_BASE = global.TASUN_API_BASE || _apiBase || '';
  global.TasunCloudWrapV4 = { load:load, getApiBase:getApiBase, authFetch:authFetch };
  try{ load(); }catch(e){}
})(window);
