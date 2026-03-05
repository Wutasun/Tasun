/* Tasun Guard v4: require login for all pages (except index.html) */
(() => {
  const KEY = "tasunAuthSession_v4";
  const safeJSON = (s) => { try{ return JSON.parse(s); }catch(e){ return null; } };
  const sess = safeJSON(sessionStorage.getItem(KEY) || "null");
  const now = Date.now();
  const valid = sess && sess.user && sess.token && (!sess.exp || now <= Number(sess.exp));
  if (!valid) {
    // redirect to index with next
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    const base = (location.pathname.split("/").slice(0,-1).join("/") || ".") + "/";
    location.replace(base + "index.html?next=" + next);
  }
})();
