/* Tasun Version Loader v7 core-pack strict
 * 正式版號唯一來源：tasun-version.json
 * 三重比對：version + rebuild stamp + 遠端實頁 fingerprint
 */
(function(){
  'use strict';

  var READY_RESOLVE = function(){};
  var READY = new Promise(function(resolve){ READY_RESOLVE = resolve; });
  window.__TASUN_VERSION_READY__ = READY;

  var CACHE_KEY = 'tasun_single_version_cache_v7';
  var REDIRECT_GUARD_PREFIX = 'tasun_single_ver_guard_v7__';
  var RELOAD_GUARD_MS = 15000;

  function norm(v){ return (v === undefined || v === null) ? '' : String(v).trim(); }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(_e){ return null; } }
  function getGlobals(){
    var G = window.__TASUN_GLOBALS__ = window.__TASUN_GLOBALS__ || {};
    var C = G.CONSTS = G.CONSTS || {};
    G.PAGE_FILE = norm(G.PAGE_FILE || C.PAGE_FILE || (location.pathname.split('/').pop() || 'index.html'));
    G.VERSION_URL = norm(G.VERSION_URL || C.VERSION_URL || 'tasun-version.json');
    G.REBUILD_STAMP_META_NAME = norm(G.REBUILD_STAMP_META_NAME || C.REBUILD_META_NAME || C.REBUILD_STAMP_META_NAME || 'tasun-rebuild-stamp');
    G.BUILD_STAMP_META_NAME = norm(G.BUILD_STAMP_META_NAME || 'tasun-build-stamp');
    G.REBUILD_STAMP_REGEX = G.REBUILD_STAMP_REGEX || /TASUN_REBUILD_STAMP:([^\n>]*)/i;
    return G;
  }
  function readCache(){
    var raw = '';
    try{ raw = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY) || ''; }catch(_e){}
    return safeJSON(raw) || null;
  }
  function saveCache(ver, stamp, fingerprint){
    var payload = JSON.stringify({ ver:norm(ver), stamp:norm(stamp), fingerprint:norm(fingerprint), at:Date.now() });
    try{ sessionStorage.setItem(CACHE_KEY, payload); }catch(_e){}
    try{ localStorage.setItem(CACHE_KEY, payload); }catch(_e){}
  }
  function currentUrlVersion(){
    try{ return norm(new URL(location.href).searchParams.get('v')); }catch(_e){ return ''; }
  }
  function addVer(url, ver){
    var vv = norm(ver);
    if(!vv) return String(url || '');
    try{
      var u = new URL(String(url || ''), location.href);
      if(u.origin === location.origin){
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
  function setGlobals(ver, cfg){
    var G = getGlobals();
    ver = norm(ver);
    if(ver){
      window.APP_VER = ver;
      window.TASUN_APP_VER = ver;
      window.__CACHE_V = ver;
      window.__withV = function(href){ return addVer(href, ver); };
    }
    if(cfg && typeof cfg === 'object'){
      G.VERSION_CONFIG = cfg;
      G.LATEST_VERSION = norm(cfg.version || cfg.ver || cfg.appVer || cfg.cacheV || cfg.cache_v || '');
      G.BUILD_STAMP = norm(cfg.buildStamp || cfg.build_stamp || cfg.pageBuildStamp || (cfg.meta && cfg.meta.buildStamp) || '');
    }
  }
  function localBuildStamp(){
    var G = getGlobals();
    var candidates = [];
    try{
      var rebuildMeta = document.querySelector('meta[name="' + G.REBUILD_STAMP_META_NAME + '"]');
      if(rebuildMeta) candidates.push(norm(rebuildMeta.getAttribute('content')));
    }catch(_e){}
    try{
      var buildMeta = document.querySelector('meta[name="' + G.BUILD_STAMP_META_NAME + '"]');
      if(buildMeta) candidates.push(norm(buildMeta.getAttribute('content')));
    }catch(_e){}
    try{
      if(window.__TASUN_PAGE_BUILD_STAMP__) candidates.push(norm(window.__TASUN_PAGE_BUILD_STAMP__));
      if(window.__TASUN_BUILD_STAMP__) candidates.push(norm(window.__TASUN_BUILD_STAMP__));
    }catch(_e){}
    try{
      var html = String(document.documentElement && document.documentElement.outerHTML || '');
      var m = html.match(G.REBUILD_STAMP_REGEX);
      if(m && m[1]) candidates.push(norm(m[1]));
    }catch(_e){}
    for(var i=0;i<candidates.length;i++) if(candidates[i]) return candidates[i];
    return '';
  }
  function fingerprintFromHtml(html){
    var s = String(html || '').replace(/\s+/g,' ').slice(0, 24000);
    var markers = [
      /id=["']loginOverlay["']/.test(s) ? 'loginOverlay' : '',
      /id=["']navArea["']/.test(s) ? 'navArea' : '',
      /id=["']tbody["']/.test(s) ? 'tbody' : '',
      /id=["']entryBox["']/.test(s) ? 'entryBox' : '',
      /id=["']zenImg["']/.test(s) ? 'zenImg' : '',
      /id=["']mask["']/.test(s) ? 'mask' : ''
    ].filter(Boolean).join('|');
    var hash = 2166136261;
    for(var i=0;i<s.length;i++){
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return markers + '|' + ((hash >>> 0).toString(16));
  }
  async function fetchVersionConfig(){
    var G = getGlobals();
    var u = new URL(G.VERSION_URL || 'tasun-version.json', location.href);
    u.searchParams.set('_', String(Date.now()));
    var res = await fetch(u.toString(), { cache:'no-store', credentials:'same-origin' });
    if(!res.ok) throw new Error('tasun-version.json:HTTP ' + res.status);
    var cfg = await res.json().catch(function(){ return null; });
    if(!cfg || typeof cfg !== 'object') throw new Error('tasun-version.json invalid');
    return cfg;
  }
  function parseVersion(cfg){
    return norm(cfg && (cfg.version || cfg.ver || cfg.appVer || cfg.cacheV || cfg.cache_v || cfg.APP_VER || ''));
  }
  function parseBuildStamp(cfg){
    return norm(cfg && (cfg.buildStamp || cfg.build_stamp || cfg.pageBuildStamp || (cfg.meta && cfg.meta.buildStamp) || ''));
  }
  async function fetchRemotePageProbe(pageFile, version){
    var G = getGlobals();
    try{
      var u = new URL(pageFile || G.PAGE_FILE || 'index.html', location.href);
      if(version) u.searchParams.set('v', version);
      u.searchParams.set('_', String(Date.now()));
      var res = await fetch(u.toString(), { cache:'no-store', credentials:'same-origin' });
      if(!res.ok) return { stamp:'', fingerprint:'', html:'' };
      var html = await res.text();
      var stamp = '';
      var mm = html.match(/<meta\s+name=["']tasun-rebuild-stamp["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+name=["']tasun-build-stamp["']\s+content=["']([^"']+)["']/i)
            || html.match(/TASUN_REBUILD_STAMP:([^\n>]*)/i);
      if(mm && mm[1]) stamp = norm(mm[1]);
      return { stamp: stamp, fingerprint: fingerprintFromHtml(html), html: html };
    }catch(_e){
      return { stamp:'', fingerprint:'', html:'' };
    }
  }
  function shouldThrottleRedirect(ver, stamp, fingerprint){
    try{
      var key = REDIRECT_GUARD_PREFIX + (location.pathname || '') + '__' + norm(ver) + '__' + norm(stamp) + '__' + norm(fingerprint);
      var raw = sessionStorage.getItem(key) || '';
      var row = raw ? safeJSON(raw) : null;
      var now = Date.now();
      if(row && (now - Number(row.ts || 0)) < RELOAD_GUARD_MS) return true;
      sessionStorage.setItem(key, JSON.stringify({ ts: now }));
    }catch(_e){}
    return false;
  }
  async function maybeRedirect(ver, buildStamp){
    ver = norm(ver);
    if(!ver) return false;
    var G = getGlobals();
    var curVer = currentUrlVersion();
    var localStamp = localBuildStamp();
    var localFingerprint = fingerprintFromHtml(String(document.documentElement && document.documentElement.outerHTML || ''));
    var remote = await fetchRemotePageProbe(G.PAGE_FILE, ver);
    var remoteStamp = norm(remote.stamp || '');
    var remoteFingerprint = norm(remote.fingerprint || '');
    var needRedirect = false;
    if(curVer !== ver) needRedirect = true;
    if(buildStamp && localStamp && buildStamp !== localStamp) needRedirect = true;
    if(remoteStamp && localStamp && remoteStamp !== localStamp) needRedirect = true;
    if(remoteFingerprint && localFingerprint && remoteFingerprint !== localFingerprint) needRedirect = true;
    if(!needRedirect) return false;
    if(shouldThrottleRedirect(ver, remoteStamp || buildStamp || localStamp, remoteFingerprint || localFingerprint)) return false;
    try{
      var u = new URL(location.href);
      u.searchParams.set('v', ver);
      u.searchParams.set('_', String(Date.now()));
      if(remoteStamp || buildStamp || localStamp) u.searchParams.set('_bs', encodeURIComponent(remoteStamp || buildStamp || localStamp));
      location.replace(u.toString());
      return true;
    }catch(_e){}
    return false;
  }

  (async function(){
    try{
      var cached = readCache();
      var initial = norm(currentUrlVersion() || (cached && cached.ver) || '');
      if(initial) setGlobals(initial, null);
      var cfg = await fetchVersionConfig();
      var ver = parseVersion(cfg) || initial || 'tasun_v5_boot_fallback';
      var stamp = parseBuildStamp(cfg);
      setGlobals(ver, cfg);
      var remoteProbe = await fetchRemotePageProbe(getGlobals().PAGE_FILE, ver);
      saveCache(ver, stamp || remoteProbe.stamp, remoteProbe.fingerprint);
      var redirected = await maybeRedirect(ver, stamp);
      if(redirected) return;
      READY_RESOLVE(true);
    }catch(_e){
      var cached = readCache();
      var fallback = norm(currentUrlVersion() || (cached && cached.ver) || 'tasun_v5_boot_fallback');
      setGlobals(fallback, null);
      READY_RESOLVE(true);
    }
  })();
})();
