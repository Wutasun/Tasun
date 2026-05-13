(function(global){
  'use strict';
  var CORE_VER = norm(global.__CACHE_V || global.TASUN_APP_VER || global.APP_VER || '20260513_tasun_v5_r300_global_core_auto_version');
  var CURRENT_KEY = 'tasunCurrentUser_v1';
  var SESSION_KEY = 'tasunSession_v1';
  var INDEX_SESSION_KEY = 'tasunIndexSession_v1';
  var SESSION_BRIDGE_KEY = 'tasunSessionBridge_v1';
  var LAST_PASS_KEY = 'tasunLastLoginPass_v1';
  var ROUTES_KEY = 'tasunNavRoutes_v1';
  var BUTTONS_KEY = 'tasunNavButtons_v1';
  var AUTH_KEY = 'tasunAuthTable_v1';
  var TOKEN_KEYS = ['tasunBearerToken_v1','tasunCloudToken_v1','tasunCloudToken','tasun_token','tasunToken','tasunWorkerToken','tasun_auth_token','tasun_session_token'];

  function norm(v){ return v == null ? '' : String(v).trim(); }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(_e){ return null; } }
  function nowISO(){ return new Date().toISOString(); }
  function addV(url){
    url = norm(url); if(!url) return url;
    var v = norm(global.TASUN_APP_VER || global.__CACHE_V || global.APP_VER || '');
    if(!v) return url;
    try{ var u = new URL(url, location.href); if(u.origin===location.origin){ u.searchParams.set('v', v); return u.toString(); } return url; }catch(_e){ return url + (url.indexOf('?')>=0?'&':'?') + 'v=' + encodeURIComponent(v); }
  }
  function readSession(key){ try{ return sessionStorage.getItem(key) || ''; }catch(_e){ return ''; } }
  function readLocal(key){ try{ return localStorage.getItem(key) || ''; }catch(_e){ return ''; } }
  function readStorage(key){ return readSession(key) || readLocal(key); }
  function writeSession(key,val){ try{ sessionStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)); }catch(_e){} }
  function writeLocal(key,val){ try{ localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)); }catch(_e){} }
  function removeBoth(key){ try{ sessionStorage.removeItem(key); }catch(_e){} try{ localStorage.removeItem(key); }catch(_e){} }
  function normalizeRole(role){ role = norm(role).toLowerCase(); return (role==='admin' || role==='write' || role==='read') ? role : 'read'; }
  function getAnyToken(){
    for(var i=0;i<TOKEN_KEYS.length;i++){
      var k=TOKEN_KEYS[i], sv=norm(readSession(k)); if(sv) return sv.replace(/^Bearer\s+/i,'');
      var lv=norm(readLocal(k)); if(lv) return lv.replace(/^Bearer\s+/i,'');
    }
    return '';
  }
  function normalizeUserLike(o, source){
    if(!o || typeof o !== 'object') return null;
    var user = norm(o.user || o.username || o.name || o.u);
    if(!user) return null;
    return { user:user, username:user, name:norm(o.name || user), role:normalizeRole(o.role || o.level || o.r), token:norm(o.token || getAnyToken()), at:norm(o.at || nowISO()), source:source||'storage' };
  }
  function getCurrentUser(){
    var keys = [CURRENT_KEY, SESSION_KEY, SESSION_BRIDGE_KEY, 'tasunSso_v2', 'tasunSso_v1'];
    for(var i=0;i<keys.length;i++){
      var row = normalizeUserLike(safeJSON(readSession(keys[i]) || readLocal(keys[i])), keys[i]);
      if(row) return row;
    }
    return null;
  }
  function mirrorToken(token){
    token = norm(token).replace(/^Bearer\s+/i,'');
    TOKEN_KEYS.forEach(function(k){ if(token){ writeSession(k, token); writeLocal(k, token); } else { removeBoth(k); } });
    return token;
  }
  function setCurrentUser(user){
    if(!user){ clearSessionLogin(); return false; }
    var row = { user:norm(user.user || user.name), username:norm(user.user || user.name), name:norm(user.name || user.user), role:normalizeRole(user.role || 'read'), token:norm(user.token || getAnyToken()), at:nowISO() };
    writeSession(CURRENT_KEY, row); writeLocal(CURRENT_KEY, row);
    writeSession(SESSION_KEY, row); writeLocal(SESSION_KEY, row);
    writeSession(SESSION_BRIDGE_KEY, row); writeLocal(SESSION_BRIDGE_KEY, row);
    writeSession(INDEX_SESSION_KEY, '1');
    if(row.token) mirrorToken(row.token);
    return true;
  }
  function setLastPass(pass){ pass = norm(pass); if(pass){ writeSession(LAST_PASS_KEY, pass); writeLocal(LAST_PASS_KEY, pass); } }
  function bridgeAuth(user, token, pass){
    var row = normalizeUserLike(user || getCurrentUser(), 'bridge');
    if(!row) return false;
    row.token = norm(token || row.token || getAnyToken());
    setCurrentUser(row);
    if(row.token) mirrorToken(row.token);
    if(pass) setLastPass(pass);
    return true;
  }
  function clearSessionLogin(){ [CURRENT_KEY, SESSION_KEY, SESSION_BRIDGE_KEY, INDEX_SESSION_KEY, LAST_PASS_KEY, 'tasunSso_v2', 'tasunSso_v1'].forEach(removeBoth); TOKEN_KEYS.forEach(removeBoth); }
  function hasAnySitePageOpenSignal(){ try{ return sessionStorage.getItem(INDEX_SESSION_KEY) === '1'; }catch(_e){ return false; } }
  function requireLoginOnColdStart(){ return !hasAnySitePageOpenSignal(); }
  function normalizeAuthTable(){ var t = safeJSON(readLocal(AUTH_KEY)) || {}; var users = Array.isArray(t.users) ? t.users : Array.isArray(t.rows) ? t.rows : Array.isArray(t) ? t : []; return users.map(function(u){ return { user:norm(u.user || u.username || u.name), name:norm(u.name || u.user || u.username), role:normalizeRole(u.role || 'read'), pass:norm(u.pass || u.password || u.pwd || u.secret || u.passwd || '') }; }).filter(function(u){ return !!u.user; }); }
  function getNamedButtons(){ var raw = safeJSON(readLocal(BUTTONS_KEY)) || {}; var list = Array.isArray(raw.buttons) ? raw.buttons : Array.isArray(raw) ? raw : []; return list.map(function(x, idx){ return { key:norm(x.key || ('btn' + (idx+1))), name:norm(x.name || x.label || x.title || ('btn' + (idx+1))), href:norm(x.href || x.url || ''), target:norm(x.target || '') }; }); }
  function defaultRouteMap(){ return { '捷運汐止東湖線':'汐東工程管理表.html','捷運汐東線':'汐東工程管理表.html','汐東工程管理表':'汐東工程管理表.html','臻鼎時代大廈管理表':'臻鼎管理表.html','工程資料庫':'工程資料庫.html','系統/權限':'權限表.html' }; }
  function getRouteMap(){ var map = defaultRouteMap(); [ROUTES_KEY, 'tasunRoutes_v1'].forEach(function(key){ var stored = safeJSON(readLocal(key)); if(stored && typeof stored === 'object'){ Object.keys(stored).forEach(function(k){ var nk=norm(k), nv=norm(stored[k]); if(nk&&nv) map[nk]=nv; }); } }); getNamedButtons().forEach(function(btn){ if(btn.name && btn.href) map[btn.name] = btn.href; }); return map; }
  function resolveRouteByName(name){ name = norm(name); if(!name) return ''; return norm(getRouteMap()[name] || ''); }
  function navigateByName(name){ var href = resolveRouteByName(name); if(!href) return false; location.href = addV(href); return true; }
  function applyButtonRoutes(root){ root = root || document; var nodes = root.querySelectorAll('[data-route-name], [data-btn-name]'); nodes.forEach(function(node){ var name = norm(node.getAttribute('data-route-name') || node.getAttribute('data-btn-name') || node.textContent); if(!name) return; node.addEventListener('click', function(ev){ ev.preventDefault(); navigateByName(name); }); }); return nodes.length; }
  function getCloudToken(){ var token = getAnyToken(); if(token) return token; var cur=getCurrentUser(); return norm(cur && cur.token).replace(/^Bearer\s+/i,''); }
  function buildAuthHeaders(extra){ var headers = Object.assign({}, extra || {}); var token = getCloudToken(); if(token && !headers.Authorization && !headers.authorization){ headers.Authorization = 'Bearer ' + token; } return headers; }
  async function fetchJson(url, options){ options = options || {}; var res = await fetch(url, Object.assign({}, options, { credentials: options.credentials || 'include', headers: buildAuthHeaders(options.headers || {}) })); var text = await res.text(); return { ok:res.ok, status:res.status, text:text, json:safeJSON(text) }; }
  async function syncBootstrap(opts){ opts = opts || {}; var apiBase = norm(opts.apiBase || global.TASUN_API_BASE || ''); var resourceKey = norm(opts.resourceKey || global.TASUN_RESOURCE_KEY || global.TASUN_PAGE_KEY || ''); var localRows = Array.isArray(opts.rows) ? opts.rows : []; if(!apiBase || !resourceKey) return { ok:false, reason:'missing-config' }; var readUrl = apiBase.replace(/\/+$/,'') + '/api/tasun/read'; var mergeUrl = apiBase.replace(/\/+$/,'') + '/api/tasun/merge'; if(localRows.length){ await fetchJson(mergeUrl,{ method:'POST', headers:{ 'content-type':'application/json','accept':'application/json' }, body: JSON.stringify({ resourceKey:resourceKey, payload:{ db: localRows, counter:Number(opts.counter||0)||0 } }) }); }
    return fetchJson(readUrl,{ method:'POST', headers:{ 'content-type':'application/json','accept':'application/json' }, body: JSON.stringify({ resourceKey:resourceKey }) }); }


  var AUTO_VERSION_STANDARD = Object.assign({}, global.__TASUN_AUTO_VERSION_STANDARD__ || {}, {
    versionMode:'auto',
    includeCurrentPage:true,
    versionJson:'tasun-version.json',
    releaseScript:'publish-version_tasun_project_autoscan.mjs',
    releaseWorkflow:'.github/workflows/release-version.yml',
    rebuildStampFile:'TASUN_REBUILD_STAMP',
    htmlBuildStampMeta:'tasun-build-stamp',
    source:'tasun-global-core.js'
  });
  global.__TASUN_AUTO_VERSION_STANDARD__ = AUTO_VERSION_STANDARD;
  function getVersionState(){
    return {
      version:norm(global.__CACHE_V || global.TASUN_APP_VER || global.APP_VER || ''),
      buildStamp:norm(global.__TASUN_PAGE_BUILD_STAMP__ || global.__TASUN_BUILD_STAMP__ || ''),
      versionJson:AUTO_VERSION_STANDARD.versionJson,
      releaseScript:AUTO_VERSION_STANDARD.releaseScript,
      releaseWorkflow:AUTO_VERSION_STANDARD.releaseWorkflow,
      checkedAt:nowISO()
    };
  }
  function validateAutoVersionConfig(cfg){
    cfg = cfg && typeof cfg === 'object' ? cfg : {};
    var rel = cfg.release || {};
    var meta = cfg.meta || {};
    var version = norm(cfg.version || cfg.ver || cfg.appVer || cfg.APP_VER || cfg.cacheV || cfg.cache_v || meta.version || '');
    var buildStamp = norm(cfg.buildStamp || cfg.build_stamp || cfg.pageBuildStamp || meta.buildStamp || '');
    var ok = cfg.versionMode === 'auto' && cfg.includeCurrentPage === true &&
      norm(rel.script) === AUTO_VERSION_STANDARD.releaseScript &&
      norm(rel.workflow) === AUTO_VERSION_STANDARD.releaseWorkflow &&
      !!version && !!buildStamp;
    return { ok:ok, version:version, buildStamp:buildStamp, versionMode:norm(cfg.versionMode), includeCurrentPage:cfg.includeCurrentPage === true, releaseScript:norm(rel.script), releaseWorkflow:norm(rel.workflow) };
  }

  global.TasunGlobalCore = { version:CORE_VER, nowISO:nowISO, addV:addV, getCurrentUser:getCurrentUser, setCurrentUser:setCurrentUser, bridgeAuth:bridgeAuth, setLastPass:setLastPass, clearSessionLogin:clearSessionLogin, requireLoginOnColdStart:requireLoginOnColdStart, normalizeAuthTable:normalizeAuthTable, getNamedButtons:getNamedButtons, getRouteMap:getRouteMap, resolveRouteByName:resolveRouteByName, navigateByName:navigateByName, applyButtonRoutes:applyButtonRoutes, getCloudToken:getCloudToken, mirrorToken:mirrorToken, buildAuthHeaders:buildAuthHeaders, fetchJson:fetchJson, syncBootstrap:syncBootstrap, getVersionState:getVersionState, validateAutoVersionConfig:validateAutoVersionConfig, AUTO_VERSION_STANDARD:AUTO_VERSION_STANDARD, TOKEN_KEYS:TOKEN_KEYS.slice() };
})(window);
