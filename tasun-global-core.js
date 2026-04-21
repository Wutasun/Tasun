(function(global){
  'use strict';

  var G = global.__TASUN_GLOBALS__ = global.__TASUN_GLOBALS__ || {};
  var C = G.CONSTS = G.CONSTS || {};
  var R = G.RUNTIME = G.RUNTIME || {};

  var DEFAULTS = {
    CURRENT_KEY: 'tasunCurrentUser_v1',
    SESSION_KEY: 'tasunSession_v1',
    SESSION_BRIDGE_KEY: 'tasunSessionBridge_v1',
    INDEX_SESSION_KEY: 'tasunIndexSession_v1',
    LAST_PASS_KEY: 'tasunLastLoginPass_v1',
    NEXT_KEY: 'tasun_next_path_v1',
    AUTH_KEY: 'tasunAuthTable_v1',
    BUTTONS_KEY: 'tasunNavButtons_v1',
    ROUTES_KEY: 'tasunNavRoutes_v1',
    VERSION_URL: 'tasun-version.json',
    RESOURCES_URL: 'tasun-resources.json',
    REBUILD_STAMP_FILE: 'TASUN_REBUILD_STAMP',
    TOKEN_KEYS: [
      'tasunBearerToken_v1','tasunCloudToken_v1','tasunCloudToken','tasun_token',
      'tasunToken','tasunWorkerToken','tasun_auth_token','tasun_session_token'
    ],
    STABLE_EVENTS: ['DOMContentLoaded','load','pageshow','focus']
  };

  Object.keys(DEFAULTS).forEach(function(k){
    if(typeof C[k] === 'undefined') C[k] = Array.isArray(DEFAULTS[k]) ? DEFAULTS[k].slice() : DEFAULTS[k];
  });

  function norm(v){ return v == null ? '' : String(v).trim(); }
  function safeJSON(raw, fallback){ try{ return JSON.parse(raw); }catch(_e){ return fallback; } }
  function nowISO(){ return new Date().toISOString(); }
  function read(store, key){ try{ return store.getItem(key) || ''; }catch(_e){ return ''; } }
  function write(store, key, value){ try{ store.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); }catch(_e){} }
  function remove(store, key){ try{ store.removeItem(key); }catch(_e){} }
  function removeBoth(key){ remove(sessionStorage, key); remove(localStorage, key); }
  function normalizeRole(role){
    role = norm(role).toLowerCase();
    if(role === 'admin' || role === 'write' || role === 'read') return role;
    if(role === 'edit') return 'write';
    if(role === 'view') return 'read';
    return 'read';
  }
  function getTokenKeys(){ return Array.isArray(C.TOKEN_KEYS) ? C.TOKEN_KEYS.slice() : DEFAULTS.TOKEN_KEYS.slice(); }
  function addV(url, ver){
    var vv = norm(ver || global.__CACHE_V || global.TASUN_APP_VER || global.APP_VER || '');
    if(!vv) return norm(url);
    try{
      var u = new URL(String(url || ''), global.location.href);
      if(u.origin === global.location.origin){
        u.searchParams.set('v', vv);
        return u.toString();
      }
      return String(url || '');
    }catch(_e){
      var s = String(url || '');
      if(!s || /^https?:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
      return s + (s.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(vv);
    }
  }
  function getAny(keys){
    var arr = Array.isArray(keys) ? keys : [keys];
    for(var i=0;i<arr.length;i++){
      var key = arr[i];
      var sv = norm(read(sessionStorage, key));
      if(sv) return sv;
      var lv = norm(read(localStorage, key));
      if(lv) return lv;
    }
    return '';
  }
  function getCloudToken(){
    var token = getAny(getTokenKeys());
    if(token) return norm(token).replace(/^Bearer\s+/i, '');
    var cur = getCurrentUser();
    return norm(cur && cur.token).replace(/^Bearer\s+/i, '');
  }
  function mirrorToken(token){
    var clean = norm(token).replace(/^Bearer\s+/i, '');
    getTokenKeys().forEach(function(k){
      if(clean){
        write(sessionStorage, k, clean);
        write(localStorage, k, clean);
      }else{
        removeBoth(k);
      }
    });
    return clean;
  }
  function normalizeUserLike(obj, source){
    if(!obj || typeof obj !== 'object') return null;
    var user = norm(obj.user || obj.username || obj.name || obj.account || obj.u);
    if(!user) return null;
    return {
      user: user,
      username: user,
      name: norm(obj.name || user),
      role: normalizeRole(obj.role || obj.level || obj.r),
      token: norm(obj.token || getCloudToken()),
      at: norm(obj.at || nowISO()),
      source: source || 'storage'
    };
  }
  function getCurrentUser(){
    var keys = [C.CURRENT_KEY, C.SESSION_KEY, C.SESSION_BRIDGE_KEY, 'tasunSso_v2', 'tasunSso_v1'];
    for(var i=0;i<keys.length;i++){
      var raw = read(sessionStorage, keys[i]) || read(localStorage, keys[i]);
      var row = normalizeUserLike(safeJSON(raw, null), keys[i]);
      if(row) return row;
    }
    return null;
  }
  function setCurrentUser(user){
    var row = normalizeUserLike(user, 'setCurrentUser');
    if(!row){
      clearSessionLogin();
      return false;
    }
    write(sessionStorage, C.CURRENT_KEY, row);
    write(localStorage, C.CURRENT_KEY, row);
    write(sessionStorage, C.SESSION_KEY, row);
    write(localStorage, C.SESSION_KEY, row);
    write(sessionStorage, C.SESSION_BRIDGE_KEY, row);
    write(localStorage, C.SESSION_BRIDGE_KEY, row);
    write(sessionStorage, C.INDEX_SESSION_KEY, '1');
    write(localStorage, C.INDEX_SESSION_KEY, '1');
    if(row.token) mirrorToken(row.token);
    return true;
  }
  function setLastPass(pass){
    pass = norm(pass);
    if(!pass) return;
    write(sessionStorage, C.LAST_PASS_KEY, pass);
    write(localStorage, C.LAST_PASS_KEY, pass);
  }
  function bridgeAuth(user, token, pass){
    var row = normalizeUserLike(user || getCurrentUser(), 'bridge');
    if(!row) return false;
    row.token = norm(token || row.token || getCloudToken());
    setCurrentUser(row);
    if(row.token) mirrorToken(row.token);
    if(pass) setLastPass(pass);
    return true;
  }
  function clearSessionLogin(){
    [C.CURRENT_KEY, C.SESSION_KEY, C.SESSION_BRIDGE_KEY, C.INDEX_SESSION_KEY, C.LAST_PASS_KEY, 'tasunSso_v2', 'tasunSso_v1'].forEach(removeBoth);
    getTokenKeys().forEach(removeBoth);
  }
  function hasAnySitePageOpenSignal(){
    return read(sessionStorage, C.INDEX_SESSION_KEY) === '1' || read(localStorage, C.INDEX_SESSION_KEY) === '1';
  }
  function requireLoginOnColdStart(){
    return !hasAnySitePageOpenSignal();
  }
  function normalizeAuthTable(){
    var t = safeJSON(read(localStorage, C.AUTH_KEY), null) || {};
    var users = Array.isArray(t.users) ? t.users : Array.isArray(t.rows) ? t.rows : Array.isArray(t) ? t : [];
    return users.map(function(u){
      return { user:norm(u.user || u.username || u.name), name:norm(u.name || u.user || u.username), role:normalizeRole(u.role || 'read'), pass:norm(u.pass || u.password || u.pwd || u.secret || u.passwd || '') };
    }).filter(function(u){ return !!u.user; });
  }
  function getNamedButtons(){
    var raw = safeJSON(read(localStorage, C.BUTTONS_KEY), null) || {};
    var list = Array.isArray(raw.buttons) ? raw.buttons : Array.isArray(raw) ? raw : [];
    return list.map(function(x, idx){
      return { key:norm(x.key || ('btn' + (idx + 1))), name:norm(x.name || x.label || x.title || ('btn' + (idx + 1))), href:norm(x.href || x.url || ''), target:norm(x.target || '') };
    });
  }
  function defaultRouteMap(){
    return {
      '捷運汐止東湖線':'汐東工程管理表.html',
      '捷運汐東線':'汐東工程管理表.html',
      '汐東工程管理表':'汐東工程管理表.html',
      '臻鼎時代大廈管理表':'臻鼎管理表.html',
      '工程資料庫':'工程資料庫.html',
      '系統/權限':'權限表.html'
    };
  }
  function getRouteMap(){
    var map = defaultRouteMap();
    [C.ROUTES_KEY, 'tasunRoutes_v1'].forEach(function(key){
      var stored = safeJSON(read(localStorage, key), null);
      if(stored && typeof stored === 'object'){
        Object.keys(stored).forEach(function(k){
          var nk = norm(k), nv = norm(stored[k]);
          if(nk && nv) map[nk] = nv;
        });
      }
    });
    getNamedButtons().forEach(function(btn){
      if(btn.name && btn.href) map[btn.name] = btn.href;
    });
    return map;
  }
  function resolveRouteByName(name){
    name = norm(name);
    return name ? norm(getRouteMap()[name] || '') : '';
  }
  function navigateByName(name){
    var href = resolveRouteByName(name);
    if(!href) return false;
    global.location.href = addV(href);
    return true;
  }
  function applyButtonRoutes(root){
    root = root || document;
    var nodes = root.querySelectorAll('[data-route-name], [data-btn-name]');
    nodes.forEach(function(node){
      var name = norm(node.getAttribute('data-route-name') || node.getAttribute('data-btn-name') || node.textContent);
      if(!name || node.__tasunRouteBound) return;
      node.__tasunRouteBound = true;
      node.addEventListener('click', function(ev){
        ev.preventDefault();
        navigateByName(name);
      });
    });
    return nodes.length;
  }
  function buildAuthHeaders(extra){
    var headers = Object.assign({}, extra || {});
    var token = getCloudToken();
    if(token && !headers.Authorization && !headers.authorization){
      headers.Authorization = 'Bearer ' + token;
    }
    return headers;
  }
  async function fetchJson(url, options){
    options = options || {};
    var res = await fetch(url, Object.assign({}, options, {
      credentials: options.credentials || 'include',
      headers: buildAuthHeaders(options.headers || {})
    }));
    var text = await res.text();
    return { ok:res.ok, status:res.status, text:text, json:safeJSON(text, null) };
  }
  function rowUid(row){
    return norm(row && (row.uid || row.pk || row.uuid));
  }
  function rowUpdatedAt(row){
    return Number(row && row.updatedAt || 0) || 0;
  }
  function dedupeRows(rows){
    var input = Array.isArray(rows) ? rows : [];
    var byUid = {};
    input.forEach(function(row){
      if(!row || typeof row !== 'object') return;
      var uid = rowUid(row);
      if(!uid) return;
      var prev = byUid[uid];
      if(!prev || rowUpdatedAt(row) >= rowUpdatedAt(prev)){
        byUid[uid] = Object.assign({}, row);
      }
    });
    return Object.keys(byUid).sort().map(function(uid){ return byUid[uid]; });
  }
  function storeDedupeResult(key, rows){
    var clean = dedupeRows(rows);
    if(key){
      try{ localStorage.setItem(key, JSON.stringify(clean)); }catch(_e){}
    }
    return clean;
  }
  async function syncBootstrap(opts){
    opts = opts || {};
    var apiBase = norm(opts.apiBase || global.TASUN_API_BASE || '');
    var resourceKey = norm(opts.resourceKey || global.TASUN_RESOURCE_KEY || global.TASUN_PAGE_KEY || '');
    var localRows = dedupeRows(opts.rows || []);
    if(!apiBase || !resourceKey) return { ok:false, reason:'missing-config' };
    var readUrl = apiBase.replace(/\/+$/,'') + '/api/tasun/read';
    var mergeUrl = apiBase.replace(/\/+$/,'') + '/api/tasun/merge';
    if(localRows.length){
      await fetchJson(mergeUrl, {
        method:'POST',
        headers:{ 'content-type':'application/json', 'accept':'application/json' },
        body: JSON.stringify({ resourceKey:resourceKey, payload:{ db: localRows, counter:Number(opts.counter || 0) || 0 } })
      });
    }
    return fetchJson(readUrl, {
      method:'POST',
      headers:{ 'content-type':'application/json', 'accept':'application/json' },
      body: JSON.stringify({ resourceKey:resourceKey })
    });
  }

  global.TasunGlobalCore = {
    version: '20260420_global_core_unified_r1',
    consts: C,
    runtime: R,
    norm: norm,
    safeJSON: safeJSON,
    nowISO: nowISO,
    addV: addV,
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    bridgeAuth: bridgeAuth,
    setLastPass: setLastPass,
    clearSessionLogin: clearSessionLogin,
    requireLoginOnColdStart: requireLoginOnColdStart,
    normalizeAuthTable: normalizeAuthTable,
    getNamedButtons: getNamedButtons,
    getRouteMap: getRouteMap,
    resolveRouteByName: resolveRouteByName,
    navigateByName: navigateByName,
    applyButtonRoutes: applyButtonRoutes,
    getCloudToken: getCloudToken,
    mirrorToken: mirrorToken,
    buildAuthHeaders: buildAuthHeaders,
    fetchJson: fetchJson,
    syncBootstrap: syncBootstrap,
    dedupeRows: dedupeRows,
    storeDedupeResult: storeDedupeResult,
    TOKEN_KEYS: getTokenKeys()
  };
})(window);
