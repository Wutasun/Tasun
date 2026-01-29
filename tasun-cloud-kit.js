/* tasun-cloud-kit.js (Tasun Cloud Kit)
 * - Minimal public API:
 *   TasunCloudKit.init({ appVer, resourcesUrl, ui:{enabled, hideLockButtons, position} })
 *   TasunCloudKit.mount({ resourceKey, pk, idField, counterField, merge, watch, getLocal, apply })
 *
 * - NEW: ui.hideLockButtons
 *   true  => hide Lock/Unlock buttons (auto lock/write/release still works)
 *   false => show Lock/Unlock buttons (if ui.enabled)
 */
(function (window, document) {
  "use strict";

  var TasunCloudKit = window.TasunCloudKit || {};
  var KIT_VER = "20260129_01";

  var CFG = {
    appVer: "",
    resourcesUrl: "tasun-resources.json",
    ui: {
      enabled: true,
      hideLockButtons: false,
      position: "bottom-right" // bottom-right | bottom-left | top-right | top-left
    }
  };

  function isObj(x){ return !!x && typeof x === "object" && !Array.isArray(x); }
  function str(v){ return (v === undefined || v === null) ? "" : String(v); }
  function norm(v){ return str(v).trim(); }
  function jsonParse(s, fallback){ try{ return JSON.parse(s); }catch(e){ return fallback; } }

  // FNV-1a hash for change detection
  function fnv1a(s){
    s = str(s);
    var h = 0x811c9dc5;
    for(var i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8,"0");
  }

  // Safe fetch JSON
  async function fetchJSON(url, opt){
    var r = await fetch(url, opt || {});
    var t = await r.text();
    if(!r.ok){
      var err = new Error("HTTP " + r.status + " " + r.statusText);
      err.status = r.status;
      err.body = t;
      throw err;
    }
    return jsonParse(t, null);
  }

  function shallowClone(o){
    if(!isObj(o)) return o;
    var x = {};
    for(var k in o){ if(Object.prototype.hasOwnProperty.call(o,k)) x[k] = o[k]; }
    return x;
  }

  function now(){ return Date.now(); }

  // =============== UI ===============
  var UI = {
    el: null,
    statusEl: null,
    lockBtn: null,
    unlockBtn: null,
    syncBtn: null,
    mounted: false
  };

  function uiPosStyle(pos){
    var s = { top:"auto", left:"auto", right:"auto", bottom:"auto" };
    switch(pos){
      case "top-left": s.top="12px"; s.left="12px"; break;
      case "top-right": s.top="12px"; s.right="12px"; break;
      case "bottom-left": s.bottom="12px"; s.left="12px"; break;
      default: s.bottom="12px"; s.right="12px"; break;
    }
    return s;
  }

  function ensureUI(){
    if(!CFG.ui || !CFG.ui.enabled) return null;
    if(UI.mounted && UI.el) return UI;

    // style
    if(!document.getElementById("tasun-cloud-kit-ui-style")){
      var st = document.createElement("style");
      st.id = "tasun-cloud-kit-ui-style";
      st.textContent = `
#tasunCloudKitUI{
  position: fixed;
  z-index: 9998;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(246,214,150,.22);
  background: linear-gradient(180deg, rgba(14,18,16,.64), rgba(14,18,16,.38));
  box-shadow: 0 18px 50px rgba(0,0,0,.28);
  color: rgba(246,214,150,.96);
  font-family: system-ui, -apple-system, "Segoe UI", Arial, "Noto Sans TC", sans-serif;
  min-width: 210px;
  backdrop-filter: blur(2px);
}
#tasunCloudKitUI .row{
  display:flex; align-items:center; justify-content:space-between;
  gap:10px;
}
#tasunCloudKitUI .status{
  font-size: 12.5px;
  letter-spacing: .04em;
  text-shadow: 0 1px 1px rgba(0,0,0,.18);
  white-space: nowrap;
  opacity: .95;
}
#tasunCloudKitUI .btns{ display:flex; gap:8px; }
#tasunCloudKitUI button{
  appearance:none;
  border: 1px solid rgba(246,214,150,.20);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color: rgba(246,214,150,.98);
  border-radius: 999px;
  padding: 8px 10px;
  cursor: pointer;
  font-size: 12px;
  letter-spacing: .04em;
  box-shadow: 0 12px 22px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.22);
}
#tasunCloudKitUI button:disabled{ opacity:.45; cursor:not-allowed; box-shadow:none; }
#tasunCloudKitUI.hideLocks .lockBtn,
#tasunCloudKitUI.hideLocks .unlockBtn{
  display:none !important;
}
      `.trim();
      document.head.appendChild(st);
    }

    var el = document.createElement("div");
    el.id = "tasunCloudKitUI";
    var p = uiPosStyle(CFG.ui.position || "bottom-right");
    el.style.top = p.top; el.style.left = p.left; el.style.right = p.right; el.style.bottom = p.bottom;

    if(CFG.ui.hideLockButtons) el.classList.add("hideLocks");

    el.innerHTML = `
      <div class="row">
        <div class="status" id="tasunCloudKitStatus">雲端：初始化…</div>
        <div class="btns">
          <button class="lockBtn"   id="tasunCloudKitLockBtn"   type="button">鎖定</button>
          <button class="unlockBtn" id="tasunCloudKitUnlockBtn" type="button">解鎖</button>
          <button class="syncBtn"   id="tasunCloudKitSyncBtn"   type="button">同步</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    UI.el = el;
    UI.statusEl = document.getElementById("tasunCloudKitStatus");
    UI.lockBtn = document.getElementById("tasunCloudKitLockBtn");
    UI.unlockBtn = document.getElementById("tasunCloudKitUnlockBtn");
    UI.syncBtn = document.getElementById("tasunCloudKitSyncBtn");
    UI.mounted = true;

    return UI;
  }

  function uiSetStatus(msg){
    if(!UI || !UI.statusEl) return;
    UI.statusEl.textContent = msg;
  }

  function uiBindHandlers(ctrl){
    if(!UI || !UI.mounted) return;

    if(UI.lockBtn){
      UI.lockBtn.onclick = function(){
        ctrl.lock().catch(function(e){
          uiSetStatus("雲端：鎖定失敗");
        });
      };
    }
    if(UI.unlockBtn){
      UI.unlockBtn.onclick = function(){
        ctrl.unlock().catch(function(e){
          uiSetStatus("雲端：解鎖失敗");
        });
      };
    }
    if(UI.syncBtn){
      UI.syncBtn.onclick = function(){
        ctrl.pullNow().catch(function(e){
          uiSetStatus("雲端：同步失敗");
        });
      };
    }
  }

  // =============== Resources resolve ===============
  function normalizeResourceShape(raw, resourceKey){
    // Accept multiple shapes:
    // 1) { resources: { key: {...} } }
    // 2) { resources: [ { key, readUrl, writeUrl, ... } ] }
    // 3) { key: {...} }
    // 4) [ { key, ... } ]
    if(!raw) return null;

    var hit = null;

    function pickFromObj(obj){
      if(!isObj(obj)) return null;
      if(isObj(obj.resources) && isObj(obj.resources[resourceKey])) return obj.resources[resourceKey];
      if(isObj(obj[resourceKey])) return obj[resourceKey];
      return null;
    }

    hit = pickFromObj(raw);
    if(hit) return hit;

    if(Array.isArray(raw)){
      hit = raw.find(function(x){
        return isObj(x) && norm(x.key) === resourceKey;
      }) || null;
      if(hit) return hit;
    }

    if(isObj(raw) && Array.isArray(raw.resources)){
      hit = raw.resources.find(function(x){
        return isObj(x) && norm(x.key) === resourceKey;
      }) || null;
      if(hit) return hit;
    }

    return null;
  }

  async function loadResourcesDocument(){
    var url = norm(CFG.resourcesUrl) || "tasun-resources.json";

    try{
      return await fetchJSON(url, { cache: "no-store" });
    }catch(e){
      // soft fallback if someone typed ".json.json"
      if(/\.json\.json$/i.test(url)){
        var url2 = url.replace(/\.json\.json$/i, ".json");
        try{
          return await fetchJSON(url2, { cache: "no-store" });
        }catch(e2){}
      }
      throw e;
    }
  }

  // =============== Transport ===============
  function buildTransport(resource){
    // resource fields we try:
    // readUrl / writeUrl / lockUrl / unlockUrl
    // OR baseUrl + actions
    var readUrl   = norm(resource.readUrl || resource.read || resource.getUrl || resource.urlRead || "");
    var writeUrl  = norm(resource.writeUrl || resource.write || resource.putUrl || resource.urlWrite || "");
    var lockUrl   = norm(resource.lockUrl || resource.lock || "");
    var unlockUrl = norm(resource.unlockUrl || resource.unlock || "");

    var baseUrl = norm(resource.baseUrl || resource.endpoint || "");

    function withAction(u, action){
      if(!u) return "";
      try{
        var uu = new URL(u, document.baseURI);
        uu.searchParams.set("op", action);
        return uu.toString();
      }catch(e){
        // relative or malformed; do simple
        return u + (u.indexOf("?")>=0 ? "&" : "?") + "op=" + encodeURIComponent(action);
      }
    }

    if(!readUrl && baseUrl) readUrl = withAction(baseUrl, "read");
    if(!writeUrl && baseUrl) writeUrl = withAction(baseUrl, "write");
    if(!lockUrl && baseUrl) lockUrl = withAction(baseUrl, "lock");
    if(!unlockUrl && baseUrl) unlockUrl = withAction(baseUrl, "unlock");

    async function read(resourceKey){
      if(!readUrl) throw new Error("No readUrl for resource " + resourceKey);
      // allow either GET returning payload or {payload:...}
      var obj = await fetchJSON(readUrl, { cache:"no-store" });
      if(obj && isObj(obj) && ("payload" in obj)) return obj.payload;
      return obj;
    }

    async function write(resourceKey, payload, lockToken, owner){
      if(!writeUrl) throw new Error("No writeUrl for resource " + resourceKey);
      var body = {
        resourceKey: resourceKey,
        owner: owner || "",
        appVer: CFG.appVer || "",
        ts: now(),
        lockToken: lockToken || "",
        payload: payload
      };
      var obj = await fetchJSON(writeUrl, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(body)
      });
      // allow endpoint to return saved payload
      if(obj && isObj(obj) && ("payload" in obj)) return obj.payload;
      return payload;
    }

    async function lock(resourceKey, owner, ttlSec){
      if(!lockUrl) return { ok:true, supported:false };
      var body = {
        resourceKey: resourceKey,
        owner: owner || "",
        ttlSec: Number(ttlSec||30),
        ts: now()
      };
      var obj = await fetchJSON(lockUrl, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(body)
      });
      // expected: { ok:true, token:"...", until:123 } OR similar
      return obj || { ok:true };
    }

    async function unlock(resourceKey, owner, token){
      if(!unlockUrl) return { ok:true, supported:false };
      var body = { resourceKey: resourceKey, owner: owner||"", token: token||"", ts: now() };
      var obj = await fetchJSON(unlockUrl, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(body)
      });
      return obj || { ok:true };
    }

    return { read:read, write:write, lock:lock, unlock:unlock, urls:{readUrl,writeUrl,lockUrl,unlockUrl} };
  }

  // =============== Merge ===============
  function normalizePayload(payload){
    return (payload && isObj(payload)) ? payload : {};
  }

  function buildRowMap(rows, pk){
    var map = new Map();
    if(!Array.isArray(rows)) return map;
    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      if(!isObj(r)) continue;
      var k = norm(r[pk]);
      if(!k) continue;
      map.set(k, r);
    }
    return map;
  }

  function stableStringifyRow(row){
    // stable-ish stringify for conflict compare
    try{ return JSON.stringify(row); }catch(e){ return String(row); }
  }

  function mergeByDiff(basePayload, localPayload, remotePayload, opt){
    opt = opt || {};
    var pk = opt.pk;
    var idField = opt.idField;
    var counterField = opt.counterField;
    var conflictPolicy = norm(opt.conflictPolicy) || "stash-remote"; // stash-remote | remote-wins | local-wins

    basePayload = normalizePayload(basePayload);
    localPayload = normalizePayload(localPayload);
    remotePayload = normalizePayload(remotePayload);

    var baseRows   = Array.isArray(basePayload.db) ? basePayload.db : [];
    var localRows  = Array.isArray(localPayload.db) ? localPayload.db : [];
    var remoteRows = Array.isArray(remotePayload.db) ? remotePayload.db : [];

    var baseMap   = buildRowMap(baseRows, pk);
    var localMap  = buildRowMap(localRows, pk);
    var remoteMap = buildRowMap(remoteRows, pk);

    var conflicts = [];

    // diff: base -> local
    var deleted = [];
    var added = [];
    var updated = [];

    baseMap.forEach(function(v, k){
      if(!localMap.has(k)) deleted.push(k);
    });
    localMap.forEach(function(v, k){
      if(!baseMap.has(k)) added.push(k);
      else{
        var a = stableStringifyRow(baseMap.get(k));
        var b = stableStringifyRow(v);
        if(a !== b) updated.push(k);
      }
    });

    // apply local changes onto remote latest
    deleted.forEach(function(k){
      if(remoteMap.has(k)) remoteMap.delete(k);
    });

    function setRow(k, row){
      if(remoteMap.has(k)){
        var rr = remoteMap.get(k);
        var a = stableStringifyRow(rr);
        var b = stableStringifyRow(row);
        if(a !== b){
          // conflict (remote changed too, or just different)
          if(conflictPolicy === "remote-wins"){
            // keep remote
            conflicts.push({ pk:k, kind:"update", local:row, remote:rr, winner:"remote" });
            return;
          }
          // local-wins or stash-remote (default)
          if(conflictPolicy === "stash-remote"){
            conflicts.push({ pk:k, kind:"update", local:row, remote:rr, winner:"local" });
          }
          remoteMap.set(k, row);
          return;
        }
        // same -> no-op
        return;
      }else{
        remoteMap.set(k, row);
      }
    }

    updated.forEach(function(k){
      setRow(k, shallowClone(localMap.get(k)));
    });

    added.forEach(function(k){
      if(remoteMap.has(k)){
        // rare collision (same pk)
        var rr = remoteMap.get(k);
        var lr = localMap.get(k);
        if(conflictPolicy === "remote-wins"){
          conflicts.push({ pk:k, kind:"add-collision", local:lr, remote:rr, winner:"remote" });
          return;
        }
        conflicts.push({ pk:k, kind:"add-collision", local:lr, remote:rr, winner:"local" });
      }
      remoteMap.set(k, shallowClone(localMap.get(k)));
    });

    // rebuild rows array
    var mergedRows = Array.from(remoteMap.values());

    // ensure numeric ids stable; also update counter
    var maxId = 0;
    for(var i=0;i<mergedRows.length;i++){
      var n = Number(mergedRows[i] && mergedRows[i][idField]);
      if(Number.isFinite(n) && n > maxId) maxId = n;
    }

    var remoteCounter = Number(remotePayload[counterField] || 0);
    if(!Number.isFinite(remoteCounter)) remoteCounter = 0;
    var localCounter = Number(localPayload[counterField] || 0);
    if(!Number.isFinite(localCounter)) localCounter = 0;

    var mergedCounter = Math.max(remoteCounter, localCounter, maxId);

    mergedRows.sort(function(a,b){
      var aa = Number(a && a[idField] || 0);
      var bb = Number(b && b[idField] || 0);
      if(!Number.isFinite(aa)) aa = 0;
      if(!Number.isFinite(bb)) bb = 0;
      return aa - bb;
    });

    var merged = shallowClone(remotePayload);
    merged.db = mergedRows;
    merged[counterField] = mergedCounter;

    return { payload: merged, conflicts: conflicts };
  }

  function detectOwner(){
    try{
      var Core = window.TasunCore;
      if(Core && Core.Auth && typeof Core.Auth.current === "function"){
        var u = Core.Auth.current();
        if(u && u.username) return String(u.username);
      }
    }catch(e){}
    return "anon";
  }

  // =============== Public API ===============
  TasunCloudKit.init = function(cfg){
    cfg = cfg || {};
    if(isObj(cfg)){
      if("appVer" in cfg) CFG.appVer = norm(cfg.appVer);
      if("resourcesUrl" in cfg) CFG.resourcesUrl = norm(cfg.resourcesUrl) || CFG.resourcesUrl;
      if(isObj(cfg.ui)){
        CFG.ui = CFG.ui || {};
        if("enabled" in cfg.ui) CFG.ui.enabled = !!cfg.ui.enabled;
        if("hideLockButtons" in cfg.ui) CFG.ui.hideLockButtons = !!cfg.ui.hideLockButtons;
        if("position" in cfg.ui) CFG.ui.position = norm(cfg.ui.position) || CFG.ui.position;
      }
    }
    // create UI lazily later (after DOM ready) to avoid early body null
    return TasunCloudKit;
  };

  TasunCloudKit.mount = function(opts){
    opts = opts || {};
    var resourceKey  = norm(opts.resourceKey);
    var pk           = norm(opts.pk || "uid");
    var idField      = norm(opts.idField || "id");
    var counterField = norm(opts.counterField || "counter");
    var conflictPolicy = norm(opts.merge && opts.merge.conflictPolicy) || "stash-remote";
    var watchSec = Number(opts.watch && opts.watch.intervalSec);
    if(!Number.isFinite(watchSec) || watchSec < 3) watchSec = 0;

    var getLocal = (typeof opts.getLocal === "function") ? opts.getLocal : function(){ return {}; };
    var applyFn  = (typeof opts.apply === "function") ? opts.apply : function(){};

    var state = {
      resourceKey: resourceKey,
      pk: pk,
      idField: idField,
      counterField: counterField,
      conflictPolicy: conflictPolicy,
      owner: detectOwner(),
      lockToken: "",
      lockSupported: false,
      resourcesDoc: null,
      resource: null,
      transport: null,
      lastRemoteHash: "",
      lastAppliedPayload: null,
      pulling: false,
      saving: false,
      timer: 0
    };

    var readyResolve = null;
    var readyReject = null;
    var ready = new Promise(function(res, rej){ readyResolve=res; readyReject=rej; });

    function ensureUIOnDomReady(){
      if(!CFG.ui || !CFG.ui.enabled) return;
      var run = function(){
        try{
          ensureUI();
          uiBindHandlers(ctrl);
          uiSetStatus("雲端：初始化…");
        }catch(e){}
      };
      if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
      else run();
    }

    async function ensureResource(){
      if(state.transport && state.resource) return true;
      if(!resourceKey) throw new Error("mount() missing resourceKey");

      // UI mount if enabled
      ensureUIOnDomReady();

      uiSetStatus("雲端：載入資源…");

      var doc = await loadResourcesDocument();
      state.resourcesDoc = doc;

      var res = normalizeResourceShape(doc, resourceKey);
      if(!res) throw new Error("resourcesUrl 找不到 resourceKey: " + resourceKey);

      state.resource = res;
      state.transport = buildTransport(res);

      uiSetStatus("雲端：資源就緒");
      return true;
    }

    function stashConflicts(conflicts, remotePayload){
      if(!conflicts || conflicts.length === 0) return;
      try{
        var key = "tasunCloudKit_conflicts__" + resourceKey + "__" + now();
        localStorage.setItem(key, JSON.stringify({
          ts: now(),
          resourceKey: resourceKey,
          conflicts: conflicts,
          remoteSnapshot: remotePayload
        }));
      }catch(e){}
    }

    async function pull(){
      if(state.pulling) return;
      state.pulling = true;

      try{
        await ensureResource();

        uiSetStatus("雲端：同步中…");
        var remotePayload = await state.transport.read(resourceKey);
        remotePayload = normalizePayload(remotePayload);

        var h = fnv1a(JSON.stringify(remotePayload || {}));
        if(h !== state.lastRemoteHash){
          state.lastRemoteHash = h;
          state.lastAppliedPayload = shallowClone(remotePayload);
          applyFn(remotePayload, { source:"remote", conflicts: null });
        }
        uiSetStatus("雲端：已同步");
      }catch(e){
        uiSetStatus("雲端：同步失敗");
        throw e;
      }finally{
        state.pulling = false;
      }
    }

    async function lock(ttlSec){
      await ensureResource();
      var owner = detectOwner();
      state.owner = owner;

      try{
        var r = await state.transport.lock(resourceKey, owner, ttlSec || 30);
        state.lockSupported = !!(r && (r.supported !== false));
        if(r && (r.token || r.lockToken)) state.lockToken = norm(r.token || r.lockToken);
        uiSetStatus(r && r.ok === false ? "雲端：被鎖定" : "雲端：已鎖定");
        return r;
      }catch(e){
        uiSetStatus("雲端：鎖定失敗");
        throw e;
      }
    }

    async function unlock(){
      await ensureResource();
      var owner = detectOwner();
      state.owner = owner;

      try{
        var r = await state.transport.unlock(resourceKey, owner, state.lockToken || "");
        state.lockToken = "";
        uiSetStatus("雲端：已解鎖");
        return r;
      }catch(e){
        uiSetStatus("雲端：解鎖失敗");
        throw e;
      }
    }

    async function saveMerged(){
      if(state.saving) return;
      state.saving = true;

      try{
        await ensureResource();

        uiSetStatus("雲端：讀取遠端…");
        var remoteLatest = await state.transport.read(resourceKey);
        remoteLatest = normalizePayload(remoteLatest);

        var base = state.lastAppliedPayload || remoteLatest; // base for diff
        var local = normalizePayload(getLocal());

        uiSetStatus("雲端：合併中…");
        var merged = mergeByDiff(base, local, remoteLatest, {
          pk: pk,
          idField: idField,
          counterField: counterField,
          conflictPolicy: conflictPolicy
        });

        if(merged.conflicts && merged.conflicts.length){
          stashConflicts(merged.conflicts, remoteLatest);
        }

        // Auto lock/write/release (if lock endpoints exist)
        try{
          await lock(30);
        }catch(e){
          // if lock fails, still attempt write (some backends have no lock)
        }

        uiSetStatus("雲端：寫入中…");
        var savedPayload = await state.transport.write(resourceKey, merged.payload, state.lockToken || "", state.owner || "");
        savedPayload = normalizePayload(savedPayload);

        try{ await unlock(); }catch(e){}

        // apply locally
        state.lastAppliedPayload = shallowClone(savedPayload);
        state.lastRemoteHash = fnv1a(JSON.stringify(savedPayload || {}));
        applyFn(savedPayload, { source:"saveMerged", conflicts: merged.conflicts || null });

        uiSetStatus((merged.conflicts && merged.conflicts.length) ? "雲端：已同步（含衝突快照）" : "雲端：已同步");
        return savedPayload;
      }catch(e){
        uiSetStatus("雲端：寫入失敗");
        throw e;
      }finally{
        state.saving = false;
      }
    }

    function startWatch(){
      if(watchSec <= 0) return;
      if(state.timer) clearInterval(state.timer);
      state.timer = setInterval(function(){
        pull().catch(function(){});
      }, Math.max(3000, Math.floor(watchSec * 1000)));
    }

    var ctrl = {
      ready: ready,
      pullNow: pull,
      saveMerged: saveMerged,
      lock: lock,
      unlock: unlock,
      info: function(){
        return {
          ver: KIT_VER,
          appVer: CFG.appVer,
          resourceKey: resourceKey,
          pk: pk,
          idField: idField,
          counterField: counterField,
          urls: state.transport ? state.transport.urls : null
        };
      }
    };

    (async function boot(){
      try{
        await ensureResource();
        await pull();
        startWatch();
        readyResolve(true);
      }catch(e){
        // still resolve ready to keep app running if cloud fails
        try{ readyResolve(false); }catch(e2){}
      }
    })();

    return ctrl;
  };

  window.TasunCloudKit = TasunCloudKit;

})(window, document);
