/* ================================
   Tasun Browser Session Login
   ================================ */

const TASUN_LOGIN_KEY = "tasun_login_user_v1";

/* 取得目前登入使用者 */
function tasunGetUser(){
  return sessionStorage.getItem(TASUN_LOGIN_KEY);
}

/* 設定登入 */
function tasunSetUser(user){
  sessionStorage.setItem(TASUN_LOGIN_KEY,user);
}

/* 登出 */
function tasunLogout(){
  sessionStorage.removeItem(TASUN_LOGIN_KEY);
  location.href="index.html";
}

/* 是否已登入 */
function tasunIsLogin(){
  return !!sessionStorage.getItem(TASUN_LOGIN_KEY);
}

/* 強制登入檢查 (所有子頁用) */
function tasunRequireLogin(){

  if(!tasunIsLogin()){

    const url = encodeURIComponent(location.pathname+location.search);

    location.href = "index.html?next="+url;

    return false;
  }

  return true;
}

/* 登入成功 */
function tasunLoginSuccess(user){

  tasunSetUser(user);

  const params = new URLSearchParams(location.search);

  const next = params.get("next");

  if(next){

    location.href = next;

  }else{

    location.href = "index.html";
  }
}