/* tasun-cloud-kit.js
 * Tasun Cloud Kit (Minimal Wrapper)
 * - Unified: Dropbox JSON store + lock + watch + status bar
 * - Auto-merge write strategy (multi-user add won't overwrite)
 * - No page UI changes required (status bar injected)
 *
 * Requires: window.TasunDropboxStore (your tasun-store-dropbox.js)
 */
(function (window, document) {
  "use strict";

  var Kit = window.TasunCloudKit || {};
  var KIT_VER = "20260129_01";

  // -----------------------------
  // Small utils
  // -----------------------------
  function str(v){ return (v === undefined || v === null) ? "" : String(v); }
  function now(){ return Date.now(); }
  function clamp(n,a,b){ n=Number(n)||0; return Math.max(a, Math.min(b, n)); }
  function jsonParse(s,f){ try { return JSON.parse(s); } catch(e){ return f; } }
  function uuid(){
    var a = Math.random().toString(16).slice(2);
    return "id_" + Date.now().toString(16) + "_" + a;
  }
  function toDateYMD(v){
    // Keep simple: accept "YYYY-MM-DD" or ISO; fallback today local.
    var s = str(v).trim();
    if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s) {
      var d = new Date(s);
      if (!isNaN(d.getTime())) {
        var y = d.getFullYear();
        var m = String(d.getMonth()+1).padStart(2,"0");
        var dd = String(d.getDate()).padStart(2,"0");
        return y + "-" + m + "-" + dd;
      }
    }
    var t = new Date();
    return t.getFullYear() + "-" + String(t.getMonth()+1).padStart(2,"0") + "-" + String(t.getDate()).padStart(2,"0");
  }
  function splitAttach(s){
    // split by newline/comma/space; keep urls/paths as tokens
    s = str(s).trim();
    if(!s) return [];
    return s
      .split(/\r?\n|,|，|;|；/g)
      .map(function(x){ return str(x).trim(); })
      .filter(function(x){ return !!x; });
  }
  function uniq(arr){
    var m = Object.create(null);
    var out = [];
    for(var i=0;i<(arr||[]).length;i++){
      var k = str(arr[i]).trim();
      if(!k) continue;
      if(m[k]) continue;
      m[k]=1; out.push(k);
    }
    return out;
  }

  // -----------------------------
  // Config + user
  // -----------------------------
  var _cfg = {
    appVer: "",                 // unified app version (cache-bust)
    resourcesUrl: "tasun-resources.json",
    tokenKey: "tasun_dropbox_token_v1",
    getToken: null,
    getUser: null,
    onStatus: null,
    watchIntervalSec: 8,
    autoWatch: true,
    autoLockMode: "onSave",     // "manual" | "onSave" | "onOpen"
    retryWriteTimes: 3,
    retryDelayMs: 500,
    // read-only roles
    writableRoles: ["admin", "write"]
  };

  function emitStatus(type, msg, detail){
    try { if(typeof _cfg.onStatus === "function") _cfg.onStatus(type, msg, detail || null); } catch(e){}
    // also update UI bar if exists
    try { _uiSet(type, msg); } catch(e2){}
  }

  function getUser(){
    // Priority: cfg.getUser -> TasunAuth -> localStorage current user -> anonymous
    try {
      if (typeof _cfg.getUser === "function") {
        var u = _cfg.getUser();
        if (u && typeof u === "object") return u;
      }
    } catch(e){}
    try {
      if (window.TasunAuth && typeof window.TasunAuth.getUser === "function") {
        var u2 = window.TasunAuth.getUser();
        if (u2 && typeof u2 === "object") return u2;
      }
    } catch(e2){}
    try {
      // common keys in your system
      var raw = localStorage.getItem("tasunCurrentUser_v1") || localStorage.getItem("tasun_current_user") || "";
      var obj = jsonParse(raw, null);
      if (obj && typeof obj === "object") return obj;
    } catch(e3){}
    return { username: "anonymous", role: "read" };
  }

  function canWrite(){
    // allow page hard override: <body data-tasun-readonly="1">
    try{
      var ro = document.body && document.body.getAttribute("data-tasun-readonly");
      if (ro === "1" || ro === "true") return false;
    } catch(e){}
    var u = getUser() || {};
    var r = str(u.role || u.permission || "read").trim().toLowerCase();
    for (var i=0;i<_cfg.writableRoles.length;i++){
      if (r === _cfg.writableRoles[i]) return true;
    }
    return false;
  }

  // -----------------------------
  // Minimal Status Bar (no UI rewrite)
  // -----------------------------
  var _ui = null;
  function _uiEnsure(){
    if (_ui) return _ui;

    var bar = document.createElement("div");
    bar.id = "tasunCloudBar";
    bar.innerHTML = '' +
      '<div class="tcb-left">' +
        '<span class="tcb-dot"></span>' +
        '<span class="tcb-title">Cloud</span>' +
        '<span class="tcb-msg" id="tcbMsg">ready</span>' +
      '</div>' +
      '<div class="tcb-mid" id="tcbMid"></div>' +
      '<div class="tcb-right">' +
        '<button type="button" class="tcb-btn" id="tcbBtnLock">取得鎖</button>' +
        '<button type="button" class="tcb-btn" id="tcbBtnUnlock">釋放鎖</button>' +
        '<button type="button" class="tcb-btn" id="tcbBtnRefresh">刷新</button>' +
      '</div>';

    var css = document.createElement("style");
    css.textContent = `
#tasunCloudBar{
  position:fixed; left:12px; right:12px; bottom:12px;
  z-index:99999;
  display:flex; align-items:center; justify-content:space-between;
  gap:10px;
  padding:8px 10px;
  border-radius:14px;
  background: rgba(10,12,14,.68);
  border: 1px solid rgba(246,211,122,.26);
  backdrop-filter: blur(10px);
  color: rgba(240,240,240,.92);
  font: 12px/1.2 "Noto Sans TC", system-ui, -apple-system, "Segoe UI", Arial;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
#tasunCloudBar .tcb-left{ display:flex; align-items:center; gap:8px; min-width: 180px; }
#tasunCloudBar .tcb-title{ font-weight:700; color: rgba(246,211,122,.92); letter-spacing:.5px; }
#tasunCloudBar .tcb-msg{ opacity:.9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 520px; }
#tasunCloudBar .tcb-dot{ width:8px; height:8px; border-radius:99px; background: rgba(140,220,140,.9); box-shadow:0 0 10px rgba(140,220,140,.5); }
#tasunCloudBar .tcb-mid{ opacity:.82; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#tasunCloudBar .tcb-right{ display:flex; gap:8px; }
#tasunCloudBar .tcb-btn{
  border-radius:12px;
  padding:6px 10px;
  border:1px solid rgba(246,211,122,.22);
  background: rgba(255,255,255,.06);
  color: rgba(246,211,122,.92);
  cursor:pointer;
}
#tasunCloudBar .tcb-btn:hover{ background: rgba(255,255,255,.10); }
#tasunCloudBar .tcb-btn:active{ transform: translateY(1px); }
    `.trim();

    document.head.appendChild(css);
    document.body.appendChild(bar);

    _ui = {
      el: bar,
      msg: bar.querySelector("#tcbMsg"),
      mid: bar.querySelector("#tcbMid"),
      dot: bar.querySelector(".tcb-dot"),
      btnLock: bar.querySelector("#tcbBtnLock"),
      btnUnlock: bar.querySelector("#tcbBtnUnlock"),
      btnRefresh: bar.querySelector("#tcbBtnRefresh")
    };
    return _ui;
  }

  function _uiSet(type, msg){
    var ui = _uiEnsure();
    if (!ui) return;
    ui.msg.textContent = str(msg || "");
    // dot color
    var c = "rgba(140,220,140,.9)"; // ok
    if (type === "warn") c = "rgba(245,200,90,.95)";
    if (type === "error") c = "rgba(245,90,90,.95)";
    ui.dot.style.background = c;
    ui.dot.style.boxShadow = "0 0 10px " + c.replace(")", ",.45)").replace("rgba","rgba");
  }

  function _uiSetMid(text){
    var ui = _uiEnsure();
    if (!ui) return;
    ui.mid.textContent = str(text || "");
  }

  // -----------------------------
  // Merge Profiles
  // -----------------------------
  var Profiles = {};

  // ✅ 事項記錄：主鍵 id；項次自動重編；附件自動去重合併；登錄日期自動補
  Profiles.issueLogV1 = {
    pk: "id",
    seqField: "項次",
    columns: ["項次","記事內容","工種","系統","附件","備註","登錄日期"],
    normalizeRow: function (row, user) {
      row = (row && typeof row === "object") ? row : {};

      if (!row.id) row.id = uuid();

      // defaults
      if (row["記事內容"] === undefined) row["記事內容"] = "";
      if (row["工種"] === undefined) row["工種"] = "";
      if (row["系統"] === undefined) row["系統"] = "";
      if (row["附件"] === undefined) row["附件"] = "";
      if (row["備註"] === undefined) row["備註"] = "";
      row["登錄日期"] = toDateYMD(row["登錄日期"]);

      // system fields (won't affect UI)
      if (!row._createdAt) row._createdAt = now();
      row._updatedAt = now();
      row._updatedBy = str(user && user.username) || "unknown";
      row._updatedRole = str(user && user.role) || "read";

      // normalize attachments (string <-> array)
      var a1 = Array.isArray(row._attachments) ? row._attachments : splitAttach(row["附件"]);
      a1 = uniq(a1);
      row._attachments = a1;
      row["附件"] = a1.join("\n");

      return row;
    },
    mergeRow: function (baseRow, incomingRow) {
      // default: incoming overwrites base for user fields
      // keep _createdAt if base exists
      var out = Object.assign({}, baseRow || {});
      var keepCreatedAt = out._createdAt;

      // copy all incoming keys
      for (var k in incomingRow) {
        if (!Object.prototype.hasOwnProperty.call(incomingRow, k)) continue;
        out[k] = incomingRow[k];
      }

      if (keepCreatedAt) out._createdAt = keepCreatedAt;

      // merge attachments union (so two people edit "附件" won't lose items)
      var aBase = Array.isArray(baseRow && baseRow._attachments) ? baseRow._attachments : splitAttach(baseRow && baseRow["附件"]);
      var aIn   = Array.isArray(incomingRow && incomingRow._attachments) ? incomingRow._attachments : splitAttach(incomingRow && incomingRow["附件"]);
      var aOut = uniq([].concat(aBase||[], aIn||[]));
      out._attachments = aOut;
      out["附件"] = aOut.join("\n");

      return out;
    },
    reindex: function (db) {
      // re-number 項次 in array order (keeps your UI ordering behavior)
      db = Array.isArray(db) ? db : [];
      for (var i=0;i<db.length;i++){
        try { db[i]["項次"] = i + 1; } catch(e){}
      }
      return db;
    }
  };

  function getProfile(nameOrObj){
    if (!nameOrObj) return Profiles.issueLogV1;
    if (typeof nameOrObj === "string") return Profiles[nameOrObj] || Profiles.issueLogV1;
    if (typeof nameOrObj === "object") return nameOrObj;
    return Profiles.issueLogV1;
  }

  // -----------------------------
  // Auto-merge write core
  // -----------------------------
  async function autoMergeWrite(Store, resourceKey, localPayload, opts){
    opts = opts || {};
    var profile = getProfile(opts.profile || "issueLogV1");
    var user = getUser();
    var tries = clamp(opts.retryTimes || _cfg.retryWriteTimes, 1, 10);
    var delay = clamp(opts.retryDelayMs || _cfg.retryDelayMs, 100, 2000);

    for (var attempt=1; attempt<=tries; attempt++){
      // 1) Read latest
      var r = await Store.read(resourceKey, { preferCache: false });
      var latest = r.payload || {};
      var latestRev = r.rev || "";

      // 2) Merge db arrays by pk
      var baseDb = Array.isArray(latest.db) ? latest.db.slice() : [];
      var incomingDb = Array.isArray(localPayload && localPayload.db) ? localPayload.db.slice() : [];

      // normalize + index
      var pk = profile.pk || "id";
      var map = Object.create(null);
      for (var i=0;i<baseDb.length;i++){
        var br = profile.normalizeRow ? profile.normalizeRow(baseDb[i], user) : baseDb[i];
        var id = str(br && br[pk]).trim();
        if (id) map[id] = { row: br, idx: i };
        baseDb[i] = br;
      }

      // apply incoming
      for (var j=0;j<incomingDb.length;j++){
        var ir = profile.normalizeRow ? profile.normalizeRow(incomingDb[j], user) : incomingDb[j];
        var iid = str(ir && ir[pk]).trim();
        if (!iid) { ir[pk] = uuid(); iid = ir[pk]; }

        if (map[iid]) {
          // update in place (keep position)
          var pos = map[iid].idx;
          var mergedRow = profile.mergeRow ? profile.mergeRow(baseDb[pos], ir) : Object.assign({}, baseDb[pos], ir);
          baseDb[pos] = mergedRow;
          map[iid].row = mergedRow;
        } else {
          // append new (multi-user adds won't be lost)
          baseDb.push(ir);
          map[iid] = { row: ir, idx: baseDb.length - 1 };
        }
      }

      // reindex seq
      if (profile.reindex) baseDb = profile.reindex(baseDb);

      // 3) Build merged payload (preserve latest meta but update)
      var merged = Object.assign({}, latest);
      merged.db = baseDb;
      merged.meta = merged.meta && typeof merged.meta === "object" ? merged.meta : {};
      merged.meta.updatedAt = new Date().toISOString();
      merged.meta.updatedBy = str(user.username || "unknown");
      merged.meta.updatedRole = str(user.role || "read");
      merged.meta.kitVer = KIT_VER;

      // 4) Try write (optimistic rev update)
      try {
        var wr = await Store.write(resourceKey, merged, { rev: latestRev, requireLock: true });
        return { ok: true, rev: wr.rev || "", payload: merged, sourceRev: latestRev, attempt: attempt };
      } catch (e) {
        var msg = str(e && e.message);
        // conflict / update failure -> retry by re-read + re-merge
        if (attempt < tries) {
          emitStatus("warn", "合併寫入衝突，重試 " + attempt + "/" + tries, { error: msg });
          await new Promise(function(res){ setTimeout(res, delay); });
          continue;
        }
        throw e;
      }
    }
    throw new Error("autoMergeWrite failed.");
  }

  // -----------------------------
  // Manager per page/resource
  // -----------------------------
  function createManager(resourceKey, options){
    options = options || {};
    var Store = window.TasunDropboxStore;
    if (!Store) throw new Error("Missing window.TasunDropboxStore. Please load tasun-store-dropbox.js first.");

    var st = {
      resourceKey: resourceKey,
      profile: options.profile || "issueLogV1",
      payload: null,
      rev: "",
      watchStop: null,
      lastChangeAt: 0
    };

    function updateMid(){
      var u = getUser();
      var ro = canWrite() ? "editable" : "read-only";
      var lockState = (Store.lock && Store.lock.isHolding && Store.lock.isHolding(resourceKey)) ? "🔒已鎖" : "🔓未鎖";
      _uiSetMid("[" + ro + "] " + lockState + " · " + (u.username||"") + " (" + (u.role||"") + ") · " + resourceKey + (st.rev ? (" · rev " + st.rev) : ""));
      // auto hide lock buttons if read-only
      var ui = _uiEnsure();
      var showLockBtns = canWrite();
      try { ui.btnLock.style.display = showLockBtns ? "" : "none"; } catch(e){}
      try { ui.btnUnlock.style.display = showLockBtns ? "" : "none"; } catch(e2){}
    }

    async function open(){
      _uiEnsure();
      updateMid();

      emitStatus("info", "讀取雲端資料…");
      var r = await Store.read(resourceKey, { preferCache: false });
      st.payload = r.payload;
      st.rev = r.rev || "";
      st.lastChangeAt = now();

      emitStatus("info", "已載入 (" + (r.source||"") + ")");
      updateMid();

      // auto watch
      if (_cfg.autoWatch !== false) {
        st.watchStop = Store.watch(resourceKey, {
          intervalSec: options.watchIntervalSec || _cfg.watchIntervalSec,
          onChange: async function(info){
            // reload & notify
            var rr = await Store.read(resourceKey, { preferCache: false });
            st.payload = rr.payload;
            st.rev = rr.rev || "";
            st.lastChangeAt = now();
            emitStatus("info", "偵測到雲端更新，已同步");
            updateMid();
            try {
              window.dispatchEvent(new CustomEvent("tasun:cloud-sync", { detail: { resourceKey: resourceKey, rev: st.rev, payload: st.payload } }));
            } catch(e){}
            if (typeof options.onRemoteSync === "function") {
              try { options.onRemoteSync(st.payload, { rev: st.rev }); } catch(e2){}
            }
          }
        });
      }

      // auto lock on open (optional)
      if (_cfg.autoLockMode === "onOpen" && canWrite()) {
        try { await acquireLock(); } catch(e){}
      }

      // wire UI buttons
      var ui = _uiEnsure();
      ui.btnRefresh.onclick = function(){ refresh().catch(function(){}); };
      ui.btnLock.onclick = function(){ acquireLock().catch(function(){}); };
      ui.btnUnlock.onclick = function(){ releaseLock().catch(function(){}); };

      // notify first payload
      if (typeof options.onReady === "function") {
        try { options.onReady(st.payload, { rev: st.rev }); } catch(e3){}
      }
      return st.payload;
    }

    async function refresh(){
      emitStatus("info", "刷新…");
      var r = await Store.read(resourceKey, { preferCache: false });
      st.payload = r.payload;
      st.rev = r.rev || "";
      st.lastChangeAt = now();
      emitStatus("info", "已刷新");
      updateMid();
      return st.payload;
    }

    async function acquireLock(){
      if (!canWrite()) { emitStatus("warn", "read-only：不可取得鎖"); return false; }
      var res = Store.resolve ? Store.resolve(resourceKey) : null;
      if (!res || !res.lock || !res.lock.path) { emitStatus("warn", "此資源未設定 lock.path"); return false; }

      emitStatus("info", "取得鎖…");
      var owner = Store.ownerFromUser ? Store.ownerFromUser(getUser()) : { username: (getUser().username||"unknown"), role:(getUser().role||"read"), device: navigator.userAgent };
      await Store.lock.acquire(resourceKey, owner, { ttlSec: 90, waitMs: 8000, retryDelayMs: 650 });
      emitStatus("info", "已取得鎖");
      updateMid();
      return true;
    }

    async function releaseLock(){
      if (!canWrite()) { emitStatus("warn", "read-only：不可釋放鎖"); return false; }
      emitStatus("info", "釋放鎖…");
      await Store.lock.release(resourceKey);
      emitStatus("info", "已釋放鎖");
      updateMid();
      return true;
    }

    async function save(localPayload){
      if (!canWrite()) throw new Error("read-only：不可寫入");
      localPayload = localPayload && typeof localPayload === "object" ? localPayload : st.payload;

      // auto lock on save (default)
      if (_cfg.autoLockMode === "onSave") {
        if (!Store.lock.isHolding(resourceKey)) await acquireLock();
      }

      emitStatus("info", "合併寫入中…");
      var out = await autoMergeWrite(Store, resourceKey, localPayload, { profile: st.profile, retryTimes: _cfg.retryWriteTimes });
      st.payload = out.payload;
      st.rev = out.rev || "";
      st.lastChangeAt = now();

      emitStatus("info", "寫入完成（已合併）");
      updateMid();

      try {
        window.dispatchEvent(new CustomEvent("tasun:cloud-saved", { detail: { resourceKey: resourceKey, rev: st.rev, payload: st.payload } }));
      } catch(e){}

      return { rev: st.rev, payload: st.payload };
    }

    function getPayload(){ return st.payload; }

    async function destroy(){
      try { if (st.watchStop) st.watchStop(); } catch(e){}
      try { st.watchStop = null; } catch(e2){}
      if (Store.lock && Store.lock.isHolding && Store.lock.isHolding(resourceKey)) {
        try { await Store.lock.release(resourceKey); } catch(e3){}
      }
    }

    return {
      open: open,
      refresh: refresh,
      save: save,
      acquireLock: acquireLock,
      releaseLock: releaseLock,
      getPayload: getPayload,
      destroy: destroy
    };
  }

  // -----------------------------
  // Kit.init / expose
  // -----------------------------
  Kit.init = function(options){
    options = options || {};
    _cfg.appVer = str(options.appVer || window.TASUN_APP_VER || window.__CACHE_V || "").trim();
    _cfg.resourcesUrl = str(options.resourcesUrl || _cfg.resourcesUrl).trim();
    _cfg.tokenKey = str(options.tokenKey || _cfg.tokenKey).trim();
    _cfg.getToken = (typeof options.getToken === "function") ? options.getToken : null;
    _cfg.getUser = (typeof options.getUser === "function") ? options.getUser : null;
    _cfg.onStatus = (typeof options.onStatus === "function") ? options.onStatus : null;

    _cfg.watchIntervalSec = Number(options.watchIntervalSec) || _cfg.watchIntervalSec;
    _cfg.autoWatch = (options.autoWatch !== false);
    _cfg.autoLockMode = str(options.autoLockMode || _cfg.autoLockMode);

    _cfg.retryWriteTimes = Number(options.retryWriteTimes) || _cfg.retryWriteTimes;
    _cfg.retryDelayMs = Number(options.retryDelayMs) || _cfg.retryDelayMs;

    if (Array.isArray(options.writableRoles)) _cfg.writableRoles = options.writableRoles;

    if (!window.TasunDropboxStore) {
      throw new Error("Missing TasunDropboxStore. Load tasun-store-dropbox.js first.");
    }

    // forward init to Store
    window.TasunDropboxStore.init({
      appVer: _cfg.appVer,
      resourcesUrl: _cfg.resourcesUrl,
      tokenKey: _cfg.tokenKey,
      getToken: _cfg.getToken || undefined,
      getUser: _cfg.getUser || undefined,
      onStatus: function(type,msg,detail){
        emitStatus(type, msg, detail);
      }
    });

    Kit.version = KIT_VER;
    Kit.cfg = Object.assign({}, _cfg);
    emitStatus("info", "TasunCloudKit init " + KIT_VER, { appVer: _cfg.appVer });
    return Kit;
  };

  Kit.open = function(resourceKey, options){
    return createManager(resourceKey, options || {});
  };

  Kit.profiles = Profiles;
  window.TasunCloudKit = Kit;

})(window, document);
