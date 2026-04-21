(function(global){
  'use strict';
  var NEXT_KEY = 'tasun_next_path_v1';
  var LOOP_KEY = 'tasun_guard_redirect_lock_v1';

  function norm(v){ return v == null ? '' : String(v).trim(); }
  function sameOriginPath(href){
    try{
      var u = new URL(href, location.origin);
      if(u.origin !== location.origin) return '';
      return u.pathname + u.search + u.hash;
    }catch(_e){
      return (href && href.charAt(0) === '/') ? href : '';
    }
  }
  function getEntryPath(){
    var G = global.__TASUN_GLOBALS__ || {};
    var C = G.CONSTS || {};
    var base = '';
    try{
      var p = location.pathname;
      var i = p.indexOf('/Tasun/');
      base = (i >= 0) ? p.slice(0, i + '/Tasun/'.length) : '/';
    }catch(_e){ base = '/'; }
    var entry = norm(C.ENTRY_FILE || 'entry.html');
    var href = base + entry;
    return global.__withV ? global.__withV(href) : href;
  }
  function setNext(path){
    path = norm(path);
    if(!path) return;
    try{
      sessionStorage.setItem(NEXT_KEY, path);
      localStorage.setItem(NEXT_KEY, path);
    }catch(_e){}
  }
  function isLoggedIn(){
    try{ if(typeof global.__TASUN_IS_LOGGED_IN__ === 'function') return !!global.__TASUN_IS_LOGGED_IN__(); }catch(_e){}
    try{ if(global.TasunAuthV4 && global.TasunAuthV4.isLoggedIn) return !!global.TasunAuthV4.isLoggedIn(); }catch(_e){}
    try{
      if(global.TasunGlobalCore && global.TasunGlobalCore.getCurrentUser && global.TasunGlobalCore.getCloudToken){
        var cur = global.TasunGlobalCore.getCurrentUser();
        return !!(cur && cur.user && global.TasunGlobalCore.getCloudToken());
      }
    }catch(_e){}
    return false;
  }
  function redirectToEntry(nextPath){
    var p = norm(nextPath || sameOriginPath(location.href));
    if(!p) p = sameOriginPath(location.href);
    setNext(p);
    try{
      var raw = sessionStorage.getItem(LOOP_KEY) || '';
      var row = raw ? JSON.parse(raw) : null;
      var now = Date.now();
      if(row && row.path === p && (now - Number(row.ts || 0)) < 12000) return false;
      sessionStorage.setItem(LOOP_KEY, JSON.stringify({ path:p, ts:now }));
    }catch(_e){}
    var url = getEntryPath() + '#next=' + encodeURIComponent(p);
    location.replace(url);
    return true;
  }

  global.TASUN_GUARD_V5 = { setNext:setNext, redirectToEntry:redirectToEntry };
  try{
    var requireLogin = !!global.__TASUN_REQUIRE_LOGIN__;
    if(requireLogin && !isLoggedIn()){
      redirectToEntry(sameOriginPath(location.href));
    }
  }catch(_e){}
})(window);
