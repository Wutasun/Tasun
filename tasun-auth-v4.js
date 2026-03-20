/* TasunAuthV4 (v4 FINAL)
 * - 先嘗試 Worker login（若你的 Worker 有 /api/tasun/login）
 * - 失敗則使用本地固定帳號（alex-admin / tasun-write / wu-read）
 * - 與 tasun-global-auth-v65.js 共用 CURRENT_KEY
 */
(function(global){
  'use strict';

  var CURRENT_KEY = 'tasunCurrentUser_v1';

  function setCurrent(user){
    try{ localStorage.setItem(CURRENT_KEY, JSON.stringify(user||null)); }catch(e){}
    if(global.TasunAuth && global.TasunAuth.setCurrent) {
      try{ global.TasunAuth.setCurrent(user||null); }catch(e){}
    }
  }

  function getCurrent(){
    try{ return JSON.parse(localStorage.getItem(CURRENT_KEY)||'null'); }catch(e){ return null; }
  }

  function normalizeRole(role){
    role = String(role||'').toLowerCase();
    if(role==='admin' || role==='write' || role==='read') return role;
    return 'read';
  }

  // 本地固定帳號
  var LOCAL_USERS = [
    { username:'alex',  password:'alex-admin',  role:'admin' },
    { username:'tasun', password:'tasun-write', role:'write' },
    { username:'wu',    password:'wu-read',    role:'read' }
  ];

  async function tryWorkerLogin(apiBase, username, password){
    if(!apiBase) throw new Error('no apiBase');
    var url = apiBase.replace(/\/$/,'') + '/api/tasun/login';
    var res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username: username, password: password })
    });
    if(!res.ok) throw new Error('login http '+res.status);
    var data = await res.json();
    // 允許多種回傳格式
    var u = data.user || data.data || data;
    if(!u || !u.username) throw new Error('bad login response');
    return {
      username: String(u.username),
      role: normalizeRole(u.role || u.permission || u.perm),
      token: u.token || data.token || null,
      updatedAt: Date.now()
    };
  }

  function localLogin(username, password){
    var u = LOCAL_USERS.find(x=>x.username===username && x.password===password);
    if(!u) return null;
    return { username:u.username, role:u.role, token:null, updatedAt:Date.now() };
  }

  async function login(opts){
    opts = opts||{};
    var username = String(opts.username||'').trim();
    var password = String(opts.password||'');
    var apiBase = String(opts.apiBase||global.TASUN_API_BASE||'');

    if(!username || !password) throw new Error('missing credentials');

    // 1) Worker
    try{
      var u1 = await tryWorkerLogin(apiBase, username, password);
      setCurrent(u1);
      return u1;
    }catch(e){
      // 2) local
      var u2 = localLogin(username, password);
      if(!u2) throw e;
      setCurrent(u2);
      return u2;
    }
  }

  function logout(){
    setCurrent(null);
  }

  global.TasunAuthV4 = {
    login: login,
    logout: logout,
    getCurrent: getCurrent
  };
})(window);
