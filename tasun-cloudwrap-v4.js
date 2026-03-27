/* TasunCloudWrapV4 (v5 unified bridge final)
 * - resources/api base loader
 * - unified bearer bridge reader
 */
(function(global){
  'use strict';
  var _apiBase = null;
  var TOKEN_KEYS=['tasunBearerToken_v1','tasunCloudToken_v1','tasunCloudToken','tasun_token','tasunToken','tasunWorkerToken','tasun_auth_token','tasun_session_token'];
  function withV(path){ try{ return global.__withV ? global.__withV(path) : path; }catch(e){ return path; } }
  function norm(v){ return v == null ? '' : String(v).trim(); }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(_e){ return null; } }
  function token(){
    for(var i=0;i<TOKEN_KEYS.length;i++){
      var k=TOKEN_KEYS[i];
      try{ var sv=norm(sessionStorage.getItem(k)); if(sv) return sv.replace(/^Bearer\s+/i,''); }catch(_e){}
      try{ var lv=norm(localStorage.getItem(k)); if(lv) return lv.replace(/^Bearer\s+/i,''); }catch(_e){}
    }
    var userKeys=['tasunCurrentUser_v1','tasunSession_v1','tasunSessionBridge_v1'];
    for(var j=0;j<userKeys.length;j++){
      try{
        var raw=sessionStorage.getItem(userKeys[j]) || localStorage.getItem(userKeys[j]) || '';
        var row=safeJSON(raw);
        var tk=norm(row && row.token);
        if(tk) return tk.replace(/^Bearer\s+/i,'');
      }catch(_e){}
    }
    try{ if(global.TasunAuthV4 && global.TasunAuthV4.getToken) return norm(global.TasunAuthV4.getToken()).replace(/^Bearer\s+/i,''); }catch(_e){}
    return '';
  }
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
  async function authFetch(path, init){
    var apiBase = await load();
    var url = /^https?:/i.test(path||'') ? path : String(apiBase||'').replace(/\/$/,'') + String(path||'');
    init = init || {};
    var headers = Object.assign({'Accept':'application/json'}, init.headers || {});
    var tk = token();
    if(tk && !headers.Authorization && !headers.authorization) headers.Authorization = 'Bearer ' + tk;
    return fetch(url, Object.assign({ credentials:'include' }, init, { headers: headers }));
  }
  global.TASUN_API_BASE = global.TASUN_API_BASE || _apiBase || '';
  global.TasunCloudWrapV4 = { load:load, getApiBase:getApiBase, authFetch:authFetch, getToken:token, TOKEN_KEYS:TOKEN_KEYS.slice() };
  try{ load(); }catch(e){}
})(window);
