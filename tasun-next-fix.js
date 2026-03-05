/* Tasun next-fix v4 (2026-03-05)
   - 修正 next 參數巢狀/循環造成舊檔或卡住
   - 不改既有 UI，只做 URL/Session 的穩定化
*/
(function(){
  'use strict';

  const NEXT_KEY = 'tasun_next_target_v1';

  function safeDecode(s){
    try{ return decodeURIComponent(String(s||'')); }catch(_){ return String(s||''); }
  }

  function normalizeNext(raw){
    let s = String(raw||'').trim();
    if(!s) return '';

    // 反覆 decode（最多 3 次）
    for(let i=0;i<3;i++){
      const d = safeDecode(s);
      if(d === s) break;
      s = d;
    }

    // 只取最後一層 next=（避免 next=...next=... 無限巢狀）
    try{
      // 可能是完整 URL 或相對路徑
      const u = new URL(s, location.href);
      let n = u.searchParams.get('next') || '';
      if(n){
        // 若仍有 next，取最深層
        const nn = normalizeNext(n);
        if(nn) return nn;
      }
      // 排除回到自己（避免循環）
      const here = new URL(location.href);
      if(u.pathname === here.pathname && u.origin === here.origin) return '';
      return u.pathname + u.search + u.hash;
    }catch(_){
      // 相對路徑情況
      if(/\bnext=/.test(s)){
        const m = s.match(/(?:\?|&)next=([^&#]+)/g);
        if(m && m.length){
          const last = m[m.length-1].replace(/^(?:\?|&)next=/,'');
          return normalizeNext(last);
        }
      }
      // 排除 javascript: 等
      if(/^\s*javascript:/i.test(s)) return '';
      if(s.length > 1800) return '';
      return s;
    }
  }

  function storeNext(n){
    if(!n) return;
    try{ sessionStorage.setItem(NEXT_KEY, n); }catch(_){ }
  }

  function pickStoredNext(){
    try{ return String(sessionStorage.getItem(NEXT_KEY)||'').trim(); }catch(_){ return ''; }
  }

  function clearStoredNext(){
    try{ sessionStorage.removeItem(NEXT_KEY); }catch(_){ }
  }

  // 將 URL 的 next 正規化並存到 session
  try{
    const url = new URL(location.href);
    const rawNext = url.searchParams.get('next') || '';
    const n = normalizeNext(rawNext);
    if(n){
      storeNext(n);
      // 在「非 index」頁，保留 next 以便回首頁；在 index 頁，移除 next 避免循環 reload
      const isIndex = /(^|\/)(index(?:_[^\/]*)?\.html?)$/i.test(url.pathname);
      if(isIndex){
        url.searchParams.delete('next');
        // 只在真的有變更時 replace
        const cur = String(location.href);
        const nxt = url.toString();
        if(nxt !== cur) location.replace(nxt);
      }
    }

    // 反覆 refresh/back-forward cache 後「舊 next」導致跳轉：如果 next 指向不存在/同頁，清掉
    const stored = pickStoredNext();
    if(stored){
      const here = new URL(location.href);
      try{
        const t = new URL(stored, location.href);
        if(t.origin === here.origin && t.pathname === here.pathname){
          clearStoredNext();
        }
      }catch(_){ }
    }

    // 若網址過長（某些環境會導致 cache/404），移除 next
    if(location.href.length > 1900 && url.searchParams.has('next')){
      url.searchParams.delete('next');
      location.replace(url.toString());
    }
  }catch(_){ }

  // 導出給 index 用（不要求）
  window.__TASUN_NEXT_FIX__ = {
    key: NEXT_KEY,
    get: pickStoredNext,
    clear: clearStoredNext,
    set: storeNext,
    normalize: normalizeNext
  };
})();
