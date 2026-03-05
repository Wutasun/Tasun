/* Tasun Core (minimal) v4-stable
   提供 index/子頁會用到的基本工具：withV/jsonParse/clamp/rafDebounce/ready
   ✅不改 UI：只提供穩定的共用函式
*/
(function(){
  'use strict';

  const Core = {};

  Core.appVer = String(window.TASUN_APP_VER || window.APP_VER || '').trim();

  Core.withV = function(u){
    const vv = String(window.__CACHE_V || Core.appVer || '').trim();
    if(!vv) return String(u||'');
    try{
      const uu = new URL(String(u||''), document.baseURI);
      if(uu.origin === location.origin){
        uu.searchParams.set('v', vv);
        return uu.toString();
      }
      return String(u||'');
    }catch(_){
      const s = String(u||'');
      if(!s || /^https?:\/\//i.test(s) || /^mailto:/i.test(s)) return s;
      const sep = s.includes('?') ? '&' : '?';
      return s + sep + 'v=' + encodeURIComponent(vv);
    }
  };

  Core.jsonParse = function(s, fallback){
    try{ return JSON.parse(s); }catch(_){ return fallback; }
  };

  Core.clamp = function(n,a,b){
    n = Number(n); a = Number(a); b = Number(b);
    return Math.max(a, Math.min(b, n));
  };

  Core.rafDebounce = function(fn){
    let r = 0;
    return function(){
      try{ cancelAnimationFrame(r); }catch(_){ }
      r = requestAnimationFrame(function(){
        try{ fn(); }catch(_){ }
      });
    };
  };

  Core.ready = function(cb, timeoutMs){
    const t = Math.max(0, Number(timeoutMs||0));
    let done = false;
    function fire(){ if(done) return; done = true; try{ cb(); }catch(_){ } }
    if(document.readyState === 'complete' || document.readyState === 'interactive'){
      setTimeout(fire, 0);
    }else{
      document.addEventListener('DOMContentLoaded', fire, { once:true });
    }
    if(t){ setTimeout(fire, t); }
  };

  window.TasunCore = window.TasunCore || Core;
})();
