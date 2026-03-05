/* tasun-guard-v2.js */
(function(){
  try{
    if(window.tasunAuth && typeof window.tasunAuth.requireLogin === "function"){
      window.tasunAuth.requireLogin();
    }
  }catch(e){}
})();