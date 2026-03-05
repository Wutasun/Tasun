/* Tasun Global Auth v65 (v4 FINAL Stable)
 * - 全站守門：沒登入就回首頁（不使用巢狀 next，避免 414）
 * - index.html：強制先顯示登入遮罩
 * - 登入後：依 role / 權限表(localStorage) 控制按鍵顯示
 * - 不改 UI：只讀取既有 DOM（nav-btn / data-roles / login mask）
 */
(function(global){
  'use strict';

  var AUTH_KEY = 'tasunAuthTable_v1';
  var CURRENT_KEY = 'tasunCurrentUser_v1';
  var NEXT_KEY = 'tasun_next_v1'; // sessionStorage

  function $(sel, root){ return (root||document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }

  function safePath(){
    return location.pathname.replace(/.*\//,'') ? (location.pathname + location.search + location.hash) : ('/');
  }

  function getCurrent(){
    try{ return JSON.parse(localStorage.getItem(CURRENT_KEY)||'null'); }catch(e){ return null; }
  }

  function setCurrent(u){
    try{ localStorage.setItem(CURRENT_KEY, JSON.stringify(u||null)); }catch(e){}
  }

  function getAuthTable(){
    try{ return JSON.parse(localStorage.getItem(AUTH_KEY)||'[]')||[]; }catch(e){ return []; }
  }

  function ensureDefaultUsers(){
    var rows = getAuthTable();
    if(rows && rows.length) return;
    // 預設帳號：alex(admin) / tasun(write) / wu(read)
    var def = [
      {uid:'u-alex', id:1, username:'alex', role:'admin', entry:'', btn1:1,btn2:1,btn3:1,btn4:1,btn5:1, rev:1, updatedAt:Date.now(), deleted:0},
      {uid:'u-tasun', id:2, username:'tasun', role:'write', entry:'', btn1:1,btn2:1,btn3:1,btn4:1,btn5:1, rev:1, updatedAt:Date.now(), deleted:0},
      {uid:'u-wu', id:3, username:'wu', role:'read', entry:'', btn1:1,btn2:1,btn3:1,btn4:1,btn5:1, rev:1, updatedAt:Date.now(), deleted:0}
    ];
    try{ localStorage.setItem(AUTH_KEY, JSON.stringify(def)); }catch(e){}
  }

  function showLoginMask(show){
    var mask = $('#loginMask') || $('#login-mask') || $('.login-mask') || $('.loginMask');
    if(!mask) return;
    mask.style.display = show ? 'flex' : 'none';
    mask.classList.toggle('show', !!show);
  }

  function applyNavVisibility(){
    var cur = getCurrent();
    var role = (cur && cur.role) ? cur.role : '';

    // 1) data-roles 控制
    $all('[data-roles]').forEach(function(el){
      var roles = (el.getAttribute('data-roles')||'').split(',').map(s=>s.trim()).filter(Boolean);
      if(!roles.length) return;
      var ok = roles.includes(role);
      el.style.display = ok ? '' : 'none';
    });

    // 2) nav 按鈕（btn1~btn6）依權限表
    // 依目前使用者 username 對到 auth row
    var rows = getAuthTable();
    var me = rows.find(r=>r && r.username && cur && r.username===cur.username);
    if(me){
      for(var i=1;i<=5;i++){
        var btn = $('#btn'+i) || $('[data-btn="'+i+'"]');
        if(btn){
          var on = (+me['btn'+i]||0)===1;
          btn.style.display = on ? '' : 'none';
        }
      }
      // 第6顆固定 admin
      var btn6 = $('#btn6') || $('[data-btn="6"]');
      if(btn6) btn6.style.display = (role==='admin') ? '' : 'none';
    }else{
      // 沒對到權限列：保守隱藏 btn1~5；btn6 僅 admin
      for(var j=1;j<=5;j++){
        var b = $('#btn'+j) || $('[data-btn="'+j+'"]');
        if(b) b.style.display = 'none';
      }
      var b6 = $('#btn6') || $('[data-btn="6"]');
      if(b6) b6.style.display = (role==='admin') ? '' : 'none';
    }

    // 顯示「目前使用者」(若有)
    var curEl = $('#currentUser') || $('#current-user') || $('#currentUserLabel');
    if(curEl){
      curEl.textContent = cur && cur.username ? cur.username : '未登入';
    }
  }

  function rememberNext(path){
    try{ sessionStorage.setItem(NEXT_KEY, path); }catch(e){}
  }

  function consumeNext(){
    try{
      var v = sessionStorage.getItem(NEXT_KEY);
      if(v) sessionStorage.removeItem(NEXT_KEY);
      return v;
    }catch(e){ return null; }
  }

  function toIndex(){
    // 不帶 next 參數，完全避免巢狀
    location.replace('index.html');
  }

  function isIndex(){
    return /(^|\/)index\.html$/i.test(location.pathname) || /(^|\/)index\.htm$/i.test(location.pathname) || location.pathname.endsWith('/');
  }

  function enforceGuard(){
    ensureDefaultUsers();
    var cur = getCurrent();
    if(isIndex()){
      // 首頁：未登入 -> 顯示遮罩；已登入 -> 隱藏遮罩
      showLoginMask(!cur);
      applyNavVisibility();
      return;
    }

    if(!cur){
      rememberNext(safePath());
      toIndex();
      return;
    }

    applyNavVisibility();
  }

  // 對外 API（讓 index 的登入成功後呼叫）
  global.TasunAuth = global.TasunAuth || {};
  global.TasunAuth.getCurrent = getCurrent;
  global.TasunAuth.setCurrent = setCurrent;
  global.TasunAuth.applyNavVisibility = applyNavVisibility;
  global.TasunAuth.consumeNext = consumeNext;
  global.TasunAuth.rememberNext = rememberNext;
  global.TasunAuth.enforceGuard = enforceGuard;

  // 立即守門（DOM 未就緒也可先跳轉）
  try{ enforceGuard(); }catch(e){}

  // DOM ready 再套一次（確保按鍵存在後可隱藏/顯示）
  document.addEventListener('DOMContentLoaded', function(){
    try{ enforceGuard(); }catch(e){}
  });
})(window);
