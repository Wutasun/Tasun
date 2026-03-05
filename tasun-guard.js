/* Tasun page guard (stable v1)
 * Include after tasun-login.js. It will redirect to index.html if not logged in.
 */
(function(){
  "use strict";
  try{
    if(window.tasunLogin && typeof window.tasunLogin.requireLogin === "function"){
      window.tasunLogin.requireLogin({ index: "index.html" });
    }
  }catch(e){}
})();