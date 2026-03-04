/* =========================================================
 * tasun-security.js  (All-site Security Loader)  [STANDARD v1.2]
 * - Global password (cloud-synced hash) gate for ALL pages
 * - Session-based auth: closing browser => re-login required
 * - Child pages: auto-redirect to index.html with ?next=...
 * - Index page: should perform login and set sessionStorage('tasunSessionAuth_v1')
 * - Password never stored in plain text; only passHash (SHA-256 hex)
 *
 * Storage keys:
 * - localStorage.tasunGlobalPassHash_v1  : global pass hash (SHA-256 hex)
 * - sessionStorage.tasunSessionAuth_v1   : {passHash,user,role,ts}
 * ========================================================= */
(function () {
  "use strict";

  var GLOBAL_HASH_KEY = "tasunGlobalPassHash_v1";
  var SESSION_KEY     = "tasunSessionAuth_v1";
  var INDEX_FILE      = "index.html";

  function norm(s){ return (s===undefined||s===null) ? "" : String(s).trim(); }

  function getIndexUrl() {
    var base = location.href.split("#")[0];
    base = base.split("?")[0];
    return base.replace(/[^\/]+$/, INDEX_FILE);
  }

  function getNextUrl(){ return location.href; }

  function redirectToIndex(reason) {
    try {
      var idx = getIndexUrl();
      var u = new URL(idx, location.href);
      u.searchParams.set("next", getNextUrl());
      if (reason) u.searchParams.set("reason", String(reason));
      // carry v=
      try {
        var cur = new URL(location.href);
        var v = cur.searchParams.get("v");
        if (v && !u.searchParams.get("v")) u.searchParams.set("v", v);
      } catch(e){}
      location.replace(u.toString());
    } catch(e) {
      location.href = INDEX_FILE;
    }
  }

  function readGlobalHash() {
    try { return norm(localStorage.getItem(GLOBAL_HASH_KEY)); } catch(e){ return ""; }
  }

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch(e){ return null; }
  }

  function isIndexPage(){
    var p = (location.pathname||"").toLowerCase();
    return p.endsWith("/" + INDEX_FILE.toLowerCase()) || p.endsWith("/index.htm") || p.endsWith("/index.html") || p.endsWith("/");
  }

  // Expose minimal helpers for pages/index to use (no UI changes)
  window.TasunSecurity = {
    keys: { GLOBAL_HASH_KEY: GLOBAL_HASH_KEY, SESSION_KEY: SESSION_KEY },
    readGlobalHash: readGlobalHash,
    readSession: readSession,
    setSessionAuthed: function(passHash, user, role){
      try {
        var obj = { passHash: norm(passHash), user: norm(user), role: norm(role), ts: Date.now() };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj));
      } catch(e){}
    },
    clearSession: function(){
      try { sessionStorage.removeItem(SESSION_KEY); } catch(e){}
    },
    redirectToIndex: redirectToIndex
  };

  // Guard only on non-index pages
  if (!isIndexPage()) {
    var globalHash = readGlobalHash();
    if (!globalHash) { redirectToIndex("no-global-passhash"); return; }

    var sess = readSession();
    var sessHash = sess && sess.passHash ? norm(sess.passHash) : "";
    if (!sessHash || sessHash !== globalHash) { redirectToIndex("need-login"); return; }
  }
})();
