/* Tasun Auth v4 (sessionStorage, browser-session scoped) */
(() => {
  const KEY = "tasunAuthSession_v4";
  const now = () => Date.now();
  const safeJSON = (s) => { try{ return JSON.parse(s); }catch(e){ return null; } };
  const get = () => safeJSON(sessionStorage.getItem(KEY) || "null");
  const set = (obj) => sessionStorage.setItem(KEY, JSON.stringify(obj||{}));
  const clear = () => sessionStorage.removeItem(KEY);

  async function api(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body||{})
    });
    const j = await res.json().catch(() => ({ ok:false, error:"BAD_JSON" }));
    if (!res.ok && j && j.ok !== true) throw new Error(j.error || ("HTTP_"+res.status));
    return j;
  }

  async function login(username, password, apiBase) {
    const base = apiBase || "";
    const j = await api(base + "/api/tasun/login", { username, password });
    if (!j || !j.ok) throw new Error(j?.error || "LOGIN_FAIL");
    // store in sessionStorage only (closes with browser)
    set({
      user: j.user,
      role: j.role,
      token: j.token,
      exp: j.exp || (now()+ 8*60*60*1000),
      issuedAt: now(),
      apiBase: base
    });
    return j;
  }

  function isValidSession(s) {
    if (!s || !s.user || !s.token) return false;
    if (s.exp && now() > Number(s.exp)) return false;
    return true;
  }

  async function ensure(apiBase) {
    const s = get();
    if (isValidSession(s)) return s;
    clear();
    return null;
  }

  window.TasunAuthV4 = {
    KEY,
    get,
    set,
    clear,
    login,
    ensure,
    isValidSession
  };
})();
