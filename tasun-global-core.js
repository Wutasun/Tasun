(function(global){
  'use strict';

  var CORE_VER = '20260318_global_core_v1';
  var CURRENT_KEY = 'tasunCurrentUser_v1';
  var SESSION_KEY = 'tasunSessionLogin_v2';
  var INDEX_SESSION_KEY = 'tasunIndexSession_v1';
  var ROUTES_KEY = 'tasunNavRoutes_v1';
  var BUTTONS_KEY = 'tasunNavButtons_v1';
  var AUTH_KEY = 'tasunAuthTable_v1';
  var CLOUD_TOKEN_KEY = 'tasunCloudToken_v1';

  function norm(v){ return v == null ? '' : String(v).trim(); }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(_e){ return null; } }
  function nowISO(){ return new Date().toISOString(); }
  function addV(url){
    url = norm(url);
    if(!url) return url;
    var v = norm(global.TASUN_APP_VER || global.__CACHE_V || '');
    if(!v) return url;
    try{
      var abs = /^(https?:)?\/\//i.test(url);
      if(abs){
        var u = new URL(url, location.href);
        u.searchParams.set('v', v);
        return u.toString();
      }
    }catch(_e){}
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(v);
  }

  function readStorage(key){
    try{
      var s = sessionStorage.getItem(key);
      if(s) return s;
    }catch(_e){}
    try{
      var l = localStorage.getItem(key);
      if(l) return l;
    }catch(_e){}
    return '';
  }

  function getCurrentUser(){
    var keys = [CURRENT_KEY, SESSION_KEY, INDEX_SESSION_KEY, 'tasunSso_v2', 'tasunSso_v1', 'tasunSessionBridge_v1'];
    for(var i=0;i<keys.length;i++){
      var row = safeJSON(readStorage(keys[i]));
      if(row && (row.user || row.name || row.username)){
        return {
          user: norm(row.user || row.username || row.name),
          name: norm(row.name || row.user || row.username),
          role: norm(row.role || row.level || 'read') || 'read',
          at: norm(row.at || nowISO())
        };
      }
    }
    return null;
  }

  function setCurrentUser(user){
    if(!user) return false;
    var row = JSON.stringify({
      user: norm(user.user || user.name),
      name: norm(user.name || user.user),
      role: norm(user.role || 'read') || 'read',
      at: nowISO()
    });
    try{ sessionStorage.setItem(CURRENT_KEY, row); }catch(_e){}
    try{ localStorage.setItem(CURRENT_KEY, row); }catch(_e){}
    try{ sessionStorage.setItem(SESSION_KEY, row); }catch(_e){}
    try{ sessionStorage.setItem(INDEX_SESSION_KEY, '1'); }catch(_e){}
    return true;
  }

  function clearSessionLogin(){
    [CURRENT_KEY, SESSION_KEY, INDEX_SESSION_KEY].forEach(function(k){
      try{ sessionStorage.removeItem(k); }catch(_e){}
    });
  }

  function hasAnySitePageOpenSignal(){
    try{ return sessionStorage.getItem(INDEX_SESSION_KEY) === '1'; }catch(_e){ return false; }
  }

  function requireLoginOnColdStart(){
    return !hasAnySitePageOpenSignal();
  }

  function normalizeAuthTable(){
    var t = safeJSON(readStorage(AUTH_KEY)) || {};
    var users = Array.isArray(t.users) ? t.users : Array.isArray(t.rows) ? t.rows : [];
    return users.map(function(u){
      return {
        user: norm(u.user || u.username || u.name),
        name: norm(u.name || u.user || u.username),
        role: norm(u.role || 'read') || 'read',
        pass: norm(u.pass || u.password || u.pwd || u.secret || u.passwd || '')
      };
    }).filter(function(u){ return !!u.user; });
  }

  function getNamedButtons(){
    var raw = safeJSON(readStorage(BUTTONS_KEY)) || {};
    var list = Array.isArray(raw.buttons) ? raw.buttons : Array.isArray(raw) ? raw : [];
    return list.map(function(x, idx){
      return {
        key: norm(x.key || ('btn' + (idx+1))),
        name: norm(x.name || x.label || x.title || ('btn' + (idx+1))),
        href: norm(x.href || x.url || '')
      };
    });
  }

  function defaultRouteMap(){
    return {
      '捷運汐止東湖線': '汐東工程管理表.html',
      '捷運汐東線': '汐東工程管理表.html',
      '汐東工程管理表': '汐東工程管理表.html',
      '臻鼎時代大廈管理表': '臻鼎管理表.html',
      '工程資料庫': '工程資料庫.html',
      '系統/權限': '權限表.html'
    };
  }

  function getRouteMap(){
    var map = defaultRouteMap();
    var stored = safeJSON(readStorage(ROUTES_KEY));
    if(stored && typeof stored === 'object'){
      Object.keys(stored).forEach(function(k){
        var nk = norm(k), nv = norm(stored[k]);
        if(nk && nv) map[nk] = nv;
      });
    }
    getNamedButtons().forEach(function(btn){
      if(btn.name && btn.href) map[btn.name] = btn.href;
    });
    return map;
  }

  function resolveRouteByName(name){
    name = norm(name);
    if(!name) return '';
    var map = getRouteMap();
    return norm(map[name] || '');
  }

  function navigateByName(name){
    var href = resolveRouteByName(name);
    if(!href) return false;
    location.href = addV(href);
    return true;
  }

  function applyButtonRoutes(root){
    root = root || document;
    var nodes = root.querySelectorAll('[data-route-name], [data-btn-name]');
    nodes.forEach(function(node){
      var name = norm(node.getAttribute('data-route-name') || node.getAttribute('data-btn-name') || node.textContent);
      if(!name) return;
      node.addEventListener('click', function(ev){
        ev.preventDefault();
        navigateByName(name);
      });
    });
    return nodes.length;
  }

  function getCloudToken(){
    var token = readStorage(CLOUD_TOKEN_KEY) || readStorage('tasunBearerToken_v1') || readStorage('tasunAccessToken_v1');
    token = norm(token);
    return token.replace(/^Bearer\s+/i, '');
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
    var json = safeJSON(text);
    return { ok: res.ok, status: res.status, text: text, json: json };
  }

  async function syncBootstrap(opts){
    opts = opts || {};
    var apiBase = norm(opts.apiBase || '');
    var resourceKey = norm(opts.resourceKey || '');
    var localRows = Array.isArray(opts.localRows) ? opts.localRows : [];
    if(!apiBase || !resourceKey) return { ok:false, reason:'missing-config' };

    var readUrl = apiBase.replace(/\/+$/,'') + '/api/tasun/read';
    var mergeUrl = apiBase.replace(/\/+$/,'') + '/api/tasun/merge';

    if(localRows.length){
      await fetchJson(mergeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ resourceKey: resourceKey, payload: { db: localRows, counter: Number(opts.counter || 0) || 0 } })
      });
    }

    return fetchJson(readUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({ resourceKey: resourceKey })
    });
  }

  global.TasunGlobalCore = {
    version: CORE_VER,
    nowISO: nowISO,
    addV: addV,
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    clearSessionLogin: clearSessionLogin,
    requireLoginOnColdStart: requireLoginOnColdStart,
    normalizeAuthTable: normalizeAuthTable,
    getNamedButtons: getNamedButtons,
    getRouteMap: getRouteMap,
    resolveRouteByName: resolveRouteByName,
    navigateByName: navigateByName,
    applyButtonRoutes: applyButtonRoutes,
    getCloudToken: getCloudToken,
    buildAuthHeaders: buildAuthHeaders,
    fetchJson: fetchJson,
    syncBootstrap: syncBootstrap
  };
})(window);
