/* TasunCloudWrapV4 core-chain aligned v6
 * - resources/api base loader
 * - unified bearer bridge reader
 * - index cloud mount/save/pull controller
 */
(function(global){
  'use strict';

  var _apiBase = null;
  var _resources = null;
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
    try{
      if(global.TasunAuthV4 && global.TasunAuthV4.getToken){
        return norm(global.TasunAuthV4.getToken()).replace(/^Bearer\s+/i,'');
      }
    }catch(_e){}
    return '';
  }

  async function loadResources(){
    if(_resources) return _resources;
    var res = await fetch(withV('tasun-resources.json'), { cache:'no-store', credentials:'include' });
    if(!res.ok) throw new Error('tasun-resources.json:HTTP ' + res.status);
    _resources = await res.json();
    if(_resources && _resources.api && _resources.api.base){
      _apiBase = String(_resources.api.base);
      global.TASUN_API_BASE = _apiBase;
    }
    return _resources;
  }

  async function load(){
    if(_apiBase) return _apiBase;
    if(global.TASUN_API_BASE){ _apiBase = String(global.TASUN_API_BASE); return _apiBase; }
    try{
      var cfg = await loadResources();
      return String((cfg && cfg.api && cfg.api.base) || '');
    }catch(e){
      _apiBase = '';
      return _apiBase;
    }
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

  function dedupeRows(rows){
    var arr = Array.isArray(rows) ? rows : [];
    var map = new Map();
    arr.forEach(function(row){
      if(!row || typeof row !== 'object') return;
      var key = norm(row.uid || row.k || row.key);
      if(!key) return;
      var prev = map.get(key);
      if(!prev){
        map.set(key, row);
        return;
      }
      var prevTs = Number(prev.updatedAt || 0);
      var nextTs = Number(row.updatedAt || 0);
      if(nextTs >= prevTs) map.set(key, row);
    });
    return Array.from(map.values()).sort(function(a,b){
      return String(a.k || a.key || a.uid || '').localeCompare(String(b.k || b.key || b.uid || ''), 'zh-Hant');
    });
  }

  async function readMerged(opts){
    opts = opts || {};
    var resources = await loadResources();
    var resourceKey = norm(opts.resourceKey || opts.cloudKey || opts.pageKey);
    var resource = resources && resources.resources && resources.resources[resourceKey];
    var endpoint = (resource && resource.endpoints && resource.endpoints.read) || (resources.api && resources.api.read) || '/api/tasun/read';
    var payload = {
      resourceKey: resourceKey,
      pageKey: norm(opts.pageKey || ''),
      table: resource && resource.table ? resource.table : '',
      pk: resource && resource.pk ? resource.pk : 'uid'
    };
    var res = await authFetch(endpoint, {
      method:'POST',
      cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('cloud read http ' + res.status);
    var json = await res.json().catch(function(){ return {}; }) || {};
    var rows = dedupeRows(json.db || json.rows || (json.data && json.data.rows) || []);
    return Object.assign({}, json, { db: rows, rows: rows });
  }

  async function mergePayload(opts){
    opts = opts || {};
    var resources = await loadResources();
    var resourceKey = norm(opts.resourceKey || opts.cloudKey || opts.pageKey);
    var resource = resources && resources.resources && resources.resources[resourceKey];
    var endpoint = (resource && resource.endpoints && resource.endpoints.merge) || (resources.api && resources.api.merge) || '/api/tasun/merge';
    var payload = Object.assign({}, opts.payload || {}, {
      resourceKey: resourceKey,
      pageKey: norm(opts.pageKey || ''),
      table: resource && resource.table ? resource.table : '',
      pk: resource && resource.pk ? resource.pk : 'uid',
      db: dedupeRows((opts.payload && opts.payload.db) || opts.db || opts.rows || [])
    });
    var res = await authFetch(endpoint, {
      method:'POST',
      cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('cloud merge http ' + res.status);
    var json = await res.json().catch(function(){ return {}; }) || {};
    var rows = dedupeRows(json.db || json.rows || (json.data && json.data.rows) || payload.db || []);
    return Object.assign({}, json, { db: rows, rows: rows });
  }

  async function mountIndexCloud(opts){
    opts = opts || {};
    var timer = 0;
    var failCount = 0;
    var backoffMs = 0;
    function buildPayload(extra){
      var merged = Object.assign({}, opts, extra || {});
      return merged.payload || (typeof merged.buildPayload === 'function' ? merged.buildPayload() : null) || (typeof opts.buildPayload === 'function' ? opts.buildPayload() : null) || {};
    }
    async function applyPulled(data){
      try{
        if(typeof opts.applyRows === 'function'){
          var rows = Array.isArray(data && data.db) ? data.db : (Array.isArray(data && data.rows) ? data.rows : []);
          await opts.applyRows(dedupeRows(rows), data);
        }
      }catch(_e){}
    }
    return {
      async pullNow(){
        var data = await readMerged(opts);
        await applyPulled(data);
        return data;
      },
      async saveMerged(extra){
        var merged = Object.assign({}, opts, extra || {});
        var payload = buildPayload(merged);
        return mergePayload(Object.assign({}, merged, { payload: payload }));
      },
      queueSave(extra){
        clearTimeout(timer);
        timer = setTimeout(async function(){
          var jitter = Math.floor(Math.random()*180);
          var wait = Math.max(0, backoffMs) + jitter;
          if(wait) await new Promise(function(r){ setTimeout(r, wait); });
          try{
            await this.saveMerged(extra || { lock:false, mode:'merge' });
            failCount = 0;
            backoffMs = 0;
          }catch(e){
            failCount++;
            var msg = String(e && (e.message || e) || '');
            var status = Number(e && (e.status || e.code || (e.cause && e.cause.status)) || 0) || 0;
            if(status === 400 || /(\b400\b)|MERGE_FAIL/i.test(msg)) backoffMs = Math.min(30000, (backoffMs || 1200) * 2);
            else backoffMs = Math.min(20000, (backoffMs || 800) * 2);
          }
        }.bind(this), 650);
      }
    };
  }

  global.TASUN_API_BASE = global.TASUN_API_BASE || _apiBase || '';
  global.TasunCloudWrapV4 = {
    load:load,
    loadResources:loadResources,
    getApiBase:getApiBase,
    authFetch:authFetch,
    getToken:token,
    dedupeRows:dedupeRows,
    mountIndexCloud:mountIndexCloud,
    createCloudController:mountIndexCloud,
    TOKEN_KEYS:TOKEN_KEYS.slice()
  };
  try{ load(); }catch(e){}
})(window);
