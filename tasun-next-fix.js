/* Tasun next-fix (v4 FINAL) - 防止 next 參數無限巢狀導致 URL Too Long(414)
 * - 若 next 很長或 next=next=... 重複巢狀，會把 next 移除，改存 sessionStorage
 * - 若非首頁也可使用（不影響 UI）
 */
(function(){
  try{
    var u = new URL(location.href);
    if(!u.searchParams.has('next')) return;
    var next = u.searchParams.get('next') || '';
    var decoded = next;
    try{ decoded = decodeURIComponent(next); }catch(e){}

    // 偵測巢狀 next
    var nested = /[?&]next=/.test(decoded) || /%3Fnext%3D/i.test(next) || (next.split('next=').length-1)>=2;
    var tooLong = (location.href.length > 1500) || (next.length > 700) || (decoded.length > 700);

    if(tooLong || nested){
      // 把原本想去的頁面存起來（只存同站相對路徑）
      var safe = decoded;
      try{
        // 若是完整 URL，只留 pathname+search+hash
        var nu = new URL(decoded, location.origin);
        safe = nu.pathname + nu.search + nu.hash;
      }catch(e){
        // 不是合法 URL，嘗試把起始的站點拔掉
        safe = decoded.replace(location.origin,'');
      }
      if(safe && safe.length < 1200){
        sessionStorage.setItem('tasun_next_v1', safe);
      }
      // 移除 next，避免 414
      u.searchParams.delete('next');
      history.replaceState(null, '', u.toString());
    }
  }catch(e){}
})();
