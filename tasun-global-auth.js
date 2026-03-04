/* tasun-global-auth.js  (STANDARD v1 - Global Cloud Password)
 * - Single global password hash stored in localStorage: tasunGlobalPassHash_v1
 * - Fallback: first non-empty user.passHash from tasunAuthTable_v1
 * - Session auth flag stored in sessionStorage: tasunAuthed_v1 + tasunCurrentUser_v1
 * - Optional: if TasunCloudKit exists + token set, pages can sync via existing CloudKit flows (no UI change).
 */
(function(){
  "use strict";

  var GLOBAL_PASS_KEY = "tasunGlobalPassHash_v1";
  var AUTH_KEY = "tasunAuthTable_v1";
  var CUR_KEY  = "tasunCurrentUser_v1";
  var AUTHED_KEY = "tasunAuthed_v1";

  function norm(s){ return (s===undefined||s===null) ? "" : String(s).trim(); }
  function safeParse(s){ try{ return JSON.parse(s); }catch(e){ return null; } }

  async function sha256Hex(str){
    str = String(str||"");
    if (window.crypto && crypto.subtle && window.TextEncoder){
      var buf = new TextEncoder().encode(str);
      var dig = await crypto.subtle.digest("SHA-256", buf);
      var a = Array.prototype.slice.call(new Uint8Array(dig));
      return a.map(function(b){ return ("0"+b.toString(16)).slice(-2); }).join("");
    }
    // very old browsers: no secure hash available
    // fallback to a simple non-crypto hash (better than nothing, but not secure)
    var h=0; for (var i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0; }
    return "legacy_"+(h>>>0).toString(16);
  }

  function getAuthTable(){
    var raw = "";
    try{ raw = localStorage.getItem(AUTH_KEY)||""; }catch(e){}
    var j = safeParse(raw);
    return Array.isArray(j) ? j : [];
  }

  function getGlobalPassHashFromLocal(){
    var gp = "";
    try{ gp = norm(localStorage.getItem(GLOBAL_PASS_KEY)); }catch(e){}
    if (gp) return gp;

    var t = getAuthTable();
    for (var i=0;i<t.length;i++){
      var ph = norm(t[i] && t[i].passHash);
      if (ph){ gp = ph; break; }
    }
    if (gp){
      try{ localStorage.setItem(GLOBAL_PASS_KEY, gp); }catch(e){}
      return gp;
    }
    return "";
  }

  async function verifyPassword(pwd){
    var gp = getGlobalPassHashFromLocal();
    if (!gp) return false;
    var h = await sha256Hex(pwd);
    return norm(h) === norm(gp);
  }

  function getCurrentUser(){
    try{
      var j = safeParse(sessionStorage.getItem(CUR_KEY)||"") || safeParse(localStorage.getItem(CUR_KEY)||"");
      return j && typeof j==="object" ? j : null;
    }catch(e){ return null; }
  }

  function setAuthed(userObj){
    try{
      sessionStorage.setItem(AUTHED_KEY, "1");
      if (userObj) sessionStorage.setItem(CUR_KEY, JSON.stringify(userObj));
    }catch(e){}
  }

  function isAuthed(){
    try{ return sessionStorage.getItem(AUTHED_KEY)==="1"; }catch(e){ return false; }
  }

  function buildLoginOverlay(opts){
    opts = opts || {};
    var stage = document.body;

    var overlay = document.createElement("div");
    overlay.id = "tasunGlobalAuthOverlay";
    overlay.style.cssText =
      "position:fixed; inset:0; z-index:999999;" +
      "display:flex; align-items:center; justify-content:center;" +
      "background:rgba(0,0,0,.55); backdrop-filter: blur(10px);";

    var card = document.createElement("div");
    card.style.cssText =
      "width:min(520px, calc(100vw - 36px));" +
      "border-radius:16px;" +
      "background:rgba(20,18,14,.75);" +
      "border:1px solid rgba(246,214,150,.22);" +
      "box-shadow: 0 25px 70px rgba(0,0,0,.35);" +
      "padding:18px 18px 14px; color:rgba(246,214,150,.95);" +
      "font-family: system-ui, -apple-system, Segoe UI, Arial;";
    overlay.appendChild(card);

    var title = document.createElement("div");
    title.textContent = opts.title || "Tasun · 驗證";
    title.style.cssText = "font-size:18px; font-weight:700; letter-spacing:.08em; margin:2px 2px 12px;";
    card.appendChild(title);

    var row = document.createElement("div");
    row.style.cssText="display:grid; gap:10px;";
    card.appendChild(row);

    var sel = document.createElement("select");
    sel.style.cssText="width:100%; padding:10px 12px; border-radius:999px; background:rgba(0,0,0,.20); color:rgba(246,214,150,.95); border:1px solid rgba(246,214,150,.18); outline:none;";
    row.appendChild(sel);

    var opt0 = document.createElement("option");
    opt0.value=""; opt0.textContent="選擇帳號";
    sel.appendChild(opt0);

    var users = getAuthTable().filter(function(u){
      return u && typeof u==="object" && norm(u.username) && norm(u.username)!=="__GLOBAL__";
    });
    users.forEach(function(u){
      var o=document.createElement("option");
      o.value=norm(u.username);
      o.textContent=norm(u.username) + (u.role?(" ("+u.role+")"):"");
      sel.appendChild(o);
    });

    var pwd = document.createElement("input");
    pwd.type="password";
    pwd.placeholder="全站密碼";
    pwd.autocomplete="current-password";
    pwd.style.cssText="width:100%; padding:10px 12px; border-radius:999px; background:rgba(0,0,0,.20); color:rgba(246,214,150,.95); border:1px solid rgba(246,214,150,.18); outline:none;";
    row.appendChild(pwd);

    var msg = document.createElement("div");
    msg.style.cssText="min-height:18px; font-size:12px; opacity:.9; margin:2px 4px 0;";
    row.appendChild(msg);

    var btnRow = document.createElement("div");
    btnRow.style.cssText="display:flex; gap:10px; justify-content:flex-end; margin-top:8px;";
    card.appendChild(btnRow);

    var btn = document.createElement("button");
    btn.textContent="登入";
    btn.style.cssText="padding:10px 18px; border-radius:999px; border:1px solid rgba(246,214,150,.22); background:rgba(0,0,0,.18); color:rgba(246,214,150,.95); cursor:pointer;";
    btnRow.appendChild(btn);

    function setMsg(t){ msg.textContent = t || ""; }

    async function doLogin(){
      var u = norm(sel.value);
      if (!u){ setMsg("請先選擇帳號"); return; }
      var ok = await verifyPassword(pwd.value||"");
      if (!ok){ setMsg("密碼錯誤"); pwd.focus(); return; }

      // set user object from auth table
      var rec = null;
      for (var i=0;i<users.length;i++){ if (norm(users[i].username)===u){ rec=users[i]; break; } }
      var userObj = { username:u, role: rec?rec.role:"", ts: Date.now() };
      setAuthed(userObj);

      try{ overlay.remove(); }catch(e){ overlay.parentNode && overlay.parentNode.removeChild(overlay); }
      try{ if (typeof opts.onAuthed === "function") opts.onAuthed(userObj); }catch(e){}
    }

    btn.addEventListener("click", function(){ doLogin(); });
    pwd.addEventListener("keydown", function(e){ if (e.key==="Enter") doLogin(); });

    stage.appendChild(overlay);
    setTimeout(function(){ sel.focus(); }, 60);
    return overlay;
  }

  async function requireAuth(opts){
    opts = opts || {};
    if (isAuthed()){
      try{ if (typeof opts.onAuthed === "function") opts.onAuthed(getCurrentUser()); }catch(e){}
      return true;
    }
    buildLoginOverlay(opts);
    return false;
  }

  window.TasunGlobalAuth = {
    sha256Hex: sha256Hex,
    getGlobalPassHashFromLocal: getGlobalPassHashFromLocal,
    verifyPassword: verifyPassword,
    requireAuth: requireAuth,
    isAuthed: isAuthed,
    getCurrentUser: getCurrentUser,
    setAuthed: setAuthed,
    keys: { GLOBAL_PASS_KEY: GLOBAL_PASS_KEY, AUTH_KEY: AUTH_KEY, CUR_KEY: CUR_KEY, AUTHED_KEY: AUTHED_KEY }
  };
})();
