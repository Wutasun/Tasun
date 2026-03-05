/* tasun-guard-v4.js (v4 FINAL)
 * - 首頁：確保登入遮罩優先顯示
 * - 子頁：若未登入則回首頁（由 tasun-global-auth-v65.js 負責）
 * - 這支檔案存在是為了相容 index.html 原本引用
 */
(function(global){
  'use strict';

  function showLoginMask(){
    var mask = document.querySelector('#loginMask') || document.querySelector('#login-mask') || document.querySelector('.login-mask') || document.querySelector('.loginMask');
    if(!mask) return;
    mask.style.display = 'flex';
    mask.classList.add('show');
  }

  function onIndex(){
    return /(^|\/)index\.html$/i.test(location.pathname) || location.pathname.endsWith('/');
  }

  function getCurrent(){
    try{ return JSON.parse(localStorage.getItem('tasunCurrentUser_v1')||'null'); }catch(e){ return null; }
  }

  try{
    if(onIndex() && !getCurrent()) showLoginMask();
  }catch(e){}

  // DOM ready 再補一次
  document.addEventListener('DOMContentLoaded', function(){
    try{
      if(onIndex() && !getCurrent()) showLoginMask();
    }catch(e){}
  });
})(window);
