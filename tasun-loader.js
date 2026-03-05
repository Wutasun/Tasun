/* Tasun Loader v4-stable (minimal)
   index.html 會呼叫 TasunLoader.start(...)。
   我們提供：
   - start(): 載入 corePath（若尚未載入）並在 ready 後觸發
   - ready(): 安全等待
*/
(function(){
  'use strict';

  const Loader = {};

  function loadScript(src){
    return new Promise((resolve)=>{
      try{
        const s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = ()=>resolve(true);
        s.onerror = ()=>resolve(false);
        document.head.appendChild(s);
      }catch(_){ resolve(false); }
    });
  }

  Loader.start = async function(opts){
    opts = opts || {};
    try{
      // 若 core 未載入，載入 corePath
      if(!window.TasunCore && opts.corePath){
        const src = (window.__withV ? window.__withV(opts.corePath) : opts.corePath);
        await loadScript(src);
      }
    }catch(_){ }

    // 讓頁面自行 runIndexApp（index 裡已綁 ready/run）
    try{ document.documentElement.classList.add('tasun-ready'); }catch(_){ }
  };

  Loader.ready = function(cb, timeoutMs){
    const Core = window.TasunCore;
    if(Core && typeof Core.ready === 'function') return Core.ready(cb, timeoutMs);

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

  window.TasunLoader = window.TasunLoader || Loader;
})();
