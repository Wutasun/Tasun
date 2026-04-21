(function(){
  'use strict';
  var Core = {};
  function norm(v){ return v == null ? '' : String(v).trim(); }
  Core.appVer = norm(window.TASUN_APP_VER || window.APP_VER || window.__CACHE_V || '');
  Core.withV = function(u){
    var vv = norm(window.__CACHE_V || window.TASUN_APP_VER || window.APP_VER || Core.appVer || '');
    if(!vv) return String(u || '');
    try{
      var uu = new URL(String(u || ''), document.baseURI);
      if(uu.origin === location.origin){
        uu.searchParams.set('v', vv);
        return uu.toString();
      }
      return String(u || '');
    }catch(_e){
      var s = String(u || '');
      if(!s || /^https?:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
      return s + (s.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(vv);
    }
  };
  Core.jsonParse = function(s, fallback){ try{ return JSON.parse(s); }catch(_e){ return fallback; } };
  Core.clamp = function(n,a,b){ n = Number(n); a = Number(a); b = Number(b); return Math.max(a, Math.min(b, n)); };
  Core.rafDebounce = function(fn){
    var r = 0;
    return function(){
      try{ cancelAnimationFrame(r); }catch(_e){}
      r = requestAnimationFrame(function(){ try{ fn(); }catch(_err){} });
    };
  };
  Core.ready = function(cb, timeoutMs){
    var done = false;
    function fire(){ if(done) return; done = true; try{ cb(); }catch(_e){} }
    if(document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fire, 0);
    else document.addEventListener('DOMContentLoaded', fire, { once:true });
    if(Number(timeoutMs || 0) > 0) setTimeout(fire, Number(timeoutMs));
  };
  Core.getGlobals = function(){ return window.__TASUN_GLOBALS__ = window.__TASUN_GLOBALS__ || {}; };
  Core.getConsts = function(){ var G = Core.getGlobals(); G.CONSTS = G.CONSTS || {}; return G.CONSTS; };
  Core.getCurrentUser = function(){ return window.TasunGlobalCore && window.TasunGlobalCore.getCurrentUser ? window.TasunGlobalCore.getCurrentUser() : null; };
  Core.getCloudToken = function(){ return window.TasunGlobalCore && window.TasunGlobalCore.getCloudToken ? window.TasunGlobalCore.getCloudToken() : ''; };
  Core.dedupeRows = function(rows){ return window.TasunGlobalCore && window.TasunGlobalCore.dedupeRows ? window.TasunGlobalCore.dedupeRows(rows) : (Array.isArray(rows) ? rows.slice() : []); };
  window.TasunCore = window.TasunCore || Core;
})();
