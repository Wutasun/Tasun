/* Tasun Cloud Kit (v4 FINAL)
 * - Worker(/read,/merge) 同步 + localStorage cache
 * - 兼容 index.html 目前呼叫：TasunCloudKit.init({...}); TasunCloudKit.mount({...})
 * - payload 形式：{db:[rows...]}
 */
(function(global){
  'use strict';

  var DEFAULTS = {
    resourcesUrl: 'tasun-resources.json',
    appVer: '',
    ui: {},
    lock: {}
  };
  var _cfg = Object.assign({}, DEFAULTS);

  function now(){ return Date.now(); }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

  function uuidv4(){
    if(global.crypto && crypto.randomUUID) return crypto.randomUUID();
    var rnd = (global.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(16)) : Array.from({length:16},()=>Math.floor(Math.random()*256));
    rnd[6] = (rnd[6] & 0x0f) | 0x40;
    rnd[8] = (rnd[8] & 0x3f) | 0x80;
    var b = Array.from(rnd, x=>('0'+x.toString(16)).slice(-2)).join('');
    return b.slice(0,8)+'-'+b.slice(8,12)+'-'+b.slice(12,16)+'-'+b.slice(16,20)+'-'+b.slice(20);
  }

  function normalizeRow(row){
    var r = Object.assign({}, row||{});
    if(!r.uid) r.uid = uuidv4();
    if(typeof r.deleted !== 'number') r.deleted = 0;
    if(typeof r.rev !== 'number') r.rev = 0;
    if(typeof r.updatedAt !== 'number') r.updatedAt = now();
    return r;
  }

  function pickNewer(a,b){
    if(!a) return b;
    if(!b) return a;
    var au = +a.updatedAt||0, bu = +b.updatedAt||0;
    if(bu!==au) return bu>au ? b : a;
    var ar = +a.rev||0, br = +b.rev||0;
    return br>ar ? b : a;
  }

  function mergeRows(localRows, remoteRows){
    var map = new Map();
    (localRows||[]).forEach(function(r){ r=normalizeRow(r); map.set(r.uid, r); });
    (remoteRows||[]).forEach(function(r){ r=normalizeRow(r); map.set(r.uid, pickNewer(map.get(r.uid), r)); });
    var arr = Array.from(map.values());
    // 盡量依 id 排序，否則 k
    arr.sort(function(x,y){
      var xi = (x.id==null?1e18:+x.id||0), yi = (y.id==null?1e18:+y.id||0);
      if(xi!==yi) return xi-yi;
      var xk = String(x.k||''), yk = String(y.k||'');
      if(xk!==yk) return xk<yk?-1:1;
      return (+x.updatedAt||0) - (+y.updatedAt||0);
    });
    return arr;
  }

  async function fetchJSON(url, bodyObj){
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj||{}),
      credentials: 'omit'
    });
    var txt = await res.text();
    var data;
    try{ data = JSON.parse(txt); }catch(e){ data = { ok:false, raw:txt }; }
    if(!res.ok){
      var err = new Error('HTTP '+res.status);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function withRetry(fn, tries){
    var n = tries || 4;
    var last;
    for(var i=0;i<n;i++){
      try{ return await fn(i); }catch(e){
        last = e;
        if(e && e.status && e.status>=400 && e.status<500 && e.status!==429) throw e;
        var backoff = (200*Math.pow(2,i)) + Math.floor(Math.random()*120);
        await sleep(backoff);
      }
    }
    throw last;
  }

  async function loadResources(resourcesUrl){
    var res = await fetch(resourcesUrl, { cache:'no-store' });
    if(!res.ok) throw new Error('Failed to load resources: '+res.status);
    return await res.json();
  }

  function buildApi(cfgJson){
    var api = (cfgJson && cfgJson.api) || {};
    var base = api.base || '';
    return {
      base: base,
      read: base + (api.read||''),
      merge: base + (api.merge||''),
      health: base + (api.health||'')
    };
  }

  function createMountedClient(opts){
    opts = opts || {};
    var state = {
      resourceKey: opts.resourceKey || opts.key || '',
      idField: opts.idField || 'id',
      getLocal: typeof opts.getLocal==='function' ? opts.getLocal : function(){ return {db:[]}; },
      apply: typeof opts.apply==='function' ? opts.apply : function(){} ,
      __readOnly__: false,
      __disabled__: false,
      _api: null,
      _resources: null
    };

    async function ensureLoaded(){
      if(state._api && state._resources) return;
      var cfg = await loadResources(_cfg.resourcesUrl);
      state._resources = cfg.resources || {};
      state._api = buildApi(cfg);
    }

    function readLocalPayload(){
      var p = state.getLocal() || {db:[]};
      var rows = Array.isArray(p.db) ? p.db : [];
      return { db: rows.map(normalizeRow) };
    }

    async function pullNow(){
      if(state.__disabled__) return readLocalPayload();
      await ensureLoaded();
      var local = readLocalPayload();
      if(!state.resourceKey){
        state.apply(local);
        return local;
      }
      var payload = { resourceKey: state.resourceKey, appVer: _cfg.appVer };
      var data = await withRetry(()=>fetchJSON(state._api.read, payload), 4);
      var remoteRows = data.rows || (data.data && data.data.rows) || data.items || [];
      var merged = mergeRows(local.db, remoteRows);
      var out = { db: merged };
      state.apply(out);
      return out;
    }

    async function saveMerged(_opts){
      if(state.__disabled__) return readLocalPayload();
      if(state.__readOnly__) return readLocalPayload();
      await ensureLoaded();
      var local = readLocalPayload();
      // bump rev/updatedAt
      var maxId = local.db.reduce((m,r)=>Math.max(m, (r.id==null?0:+r.id||0)), 0);
      local.db.forEach(function(r){
        if(r.id==null){ maxId++; r.id = maxId; }
        r.updatedAt = now();
        r.rev = (+r.rev||0) + 1;
      });

      if(!state.resourceKey){
        state.apply(local);
        return local;
      }
      var payload = { resourceKey: state.resourceKey, appVer: _cfg.appVer, rows: local.db };
      var data = await withRetry(()=>fetchJSON(state._api.merge, payload), 5);
      var remoteRows = data.rows || (data.data && data.data.rows) || data.items || [];
      var merged = mergeRows(local.db, remoteRows);
      var out = { db: merged };
      state.apply(out);
      return out;
    }

    return {
      pullNow: pullNow,
      saveMerged: saveMerged,
      state: state
    };
  }

  global.TasunCloudKit = {
    init: function(cfg){ _cfg = Object.assign({}, _cfg, cfg||{}); return _cfg; },
    mount: function(opts){ return createMountedClient(opts); },
    _getConfig: function(){ return Object.assign({}, _cfg); }
  };
})(window);
