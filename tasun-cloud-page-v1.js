/* tasun-cloud-page-v1.js (spec v1)
   - Auto mount TasunCloudKit using window.TASUN_CLOUD_V1
   - After apply -> refresh immediately (fn/event/reload/auto)
*/
(function(){
  "use strict";

  if(window.TasunCloudPageV1 && window.TasunCloudPageV1.__v === "1") return;

  const VER = "1";
  const CFG_KEY = "TASUN_CLOUD_V1";
  const RELOAD_GUARD_KEY = "tasun_cloud_reload_guard_v1";

  function withV(u){
    try{
      const f = window.__withV;
      if(typeof f === "function") return f(u);
    }catch(e){}
    return u;
  }

  function now(){ return Date.now(); }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(e){ return fallback; }
  }

  function loadScriptOnce(src){
    return new Promise((resolve)=>{
      try{
        const id = "tasun__" + String(src).replace(/[^a-z0-9]+/gi,"_");
        if(document.getElementById(id)) return resolve(true);
        const s = document.createElement("script");
        s.id = id;
        s.src = src;
        s.async = true;
        s.onload = ()=>resolve(true);
        s.onerror = ()=>resolve(false);
        document.head.appendChild(s);
      }catch(e){
        resolve(false);
      }
    });
  }

  function toFn(fnName){
    if(!fnName) return null;

    // 支援 "App.refresh" 這種 dotted path
    const path = String(fnName).split(".").map(x=>x.trim()).filter(Boolean);
    let cur = window;
    for(const p of path){
      if(cur && typeof cur === "object" && p in cur) cur = cur[p];
      else return null;
    }
    return (typeof cur === "function") ? cur : null;
  }

  function dispatchAppliedEvent(resourceKey, payload){
    try{
      const ev = new CustomEvent("tasun:cloud-applied", {
        detail: { resourceKey: String(resourceKey||""), payload: payload || null, t: now() }
      });
      window.dispatchEvent(ev);
    }catch(e){}
  }

  function doReloadOnce(){
    try{
      const ss = window.sessionStorage;
      const last = Number(ss.getItem(RELOAD_GUARD_KEY) || 0);
      const t = now();
      // 2.5 秒內最多 reload 一次，避免套用連鎖造成 reload 迴圈
      if(t - last < 2500) return false;
      ss.setItem(RELOAD_GUARD_KEY, String(t));
      location.reload();
      return true;
    }catch(e){
      try{ location.reload(); }catch(_){}
      return true;
    }
  }

  function smartRefresh(cfg, resourceKey, payload){
    const r = (cfg && cfg.refresh) ? cfg.refresh : { mode:"reload" };
    const mode = String(r.mode || "reload").toLowerCase();

    // 1) fn：最推薦（不閃、可保留狀態）
    if(mode === "fn"){
      const fn = toFn(r.fn);
      if(fn){
        try{ fn(payload); }catch(e){}
        dispatchAppliedEvent(resourceKey, payload);
        return;
      }
      // 找不到函式就退回 reload
      dispatchAppliedEvent(resourceKey, payload);
      doReloadOnce();
      return;
    }

    // 2) event：只丟事件，讓頁面自己接
    if(mode === "event"){
      dispatchAppliedEvent(resourceKey, payload);
      return;
    }

    // 3) auto：嘗試常見 refresh 函式，沒有就 reload
    if(mode === "auto"){
      const candidates = [
        "__onCloudApplied",
        "renderAll",
        "refreshAll",
        "rebuild",
        "rebuildAll",
        "App.refresh",
        "TasunApp.refresh"
      ];
      for(const name of candidates){
        const fn = toFn(name);
        if(fn){
          try{ fn(payload); }catch(e){}
          dispatchAppliedEvent(resourceKey, payload);
          return;
        }
      }
      dispatchAppliedEvent(resourceKey, payload);
      doReloadOnce();
      return;
    }

    // 4) reload：最保險，但會丟未儲存輸入
    dispatchAppliedEvent(resourceKey, payload);
    doReloadOnce();
  }

  function buildPayloadFromLocal(localKeys){
    const keys = Array.isArray(localKeys) ? localKeys.slice() : [];
    keys.sort((a,b)=>String(a).localeCompare(String(b), "zh-Hant"));
    const rows = [];
    for(let i=0;i<keys.length;i++){
      const k = String(keys[i] || "").trim();
      if(!k) continue;
      const v = localStorage.getItem(k);
      rows.push({ id: rows.length + 1, k, v: (v == null ? "" : String(v)) });
    }
    return { counter: rows.length, db: rows };
  }

  function applyPayloadToLocal(payload, localKeySet){
    if(!payload || !Array.isArray(payload.db)) return;
    for(const row of payload.db){
      const k = String(row && row.k || "").trim();
      if(!k) continue;
      if(localKeySet && !localKeySet.has(k)) continue;
      const v = (row && row.v == null) ? "" : String(row.v);
      if(localStorage.getItem(k) !== v){
        localStorage.setItem(k, v);
      }
    }
  }

  async function start(userCfg){
    const cfg = userCfg || window[CFG_KEY];
    if(!cfg || typeof cfg !== "object") return;

    const resourceKey = String(cfg.resourceKey || "").trim();
    if(!resourceKey) return;

    const localKeys = Array.isArray(cfg.localKeys) ? cfg.localKeys : [];
    const localKeySet = new Set(localKeys.map(k=>String(k)));

    const resourcesUrl = withV(String(cfg.resourcesUrl || "tasun-resources.json"));
    const appVer = String(cfg.appVer || window.TASUN_APP_VER || window.APP_VER || "").trim();

    // 載入 cloud kit
    const ok = await loadScriptOnce(withV("tasun-cloud-kit.js"));
    if(!ok || !window.TasunCloudKit || typeof window.TasunCloudKit.mount !== "function"){
      console.warn("[TasunCloudPageV1] TasunCloudKit missing");
      return;
    }

    // init（可重複呼叫；由 kit 自己做 idempotent）
    try{
      window.TasunCloudKit.init({
        appVer,
        resourcesUrl,
        ui: {
          enabled: true,
          hideLockButtons: true,
          position: "bottom-right"
        },
        lock: { enabled:false, auto:false }
      });
    }catch(e){}

    // mount
    try{
      const ctrl = window.TasunCloudKit.mount({
        resourceKey,
        pk: String(cfg.pk || "k"),
        idField: String(cfg.idField || "id"),
        counterField: String(cfg.counterField || "counter"),
        merge: cfg.merge || { conflictPolicy:"stash-remote", lock:"none" },
        watch: cfg.watch || { intervalSec: 10 },
        getLocal: ()=>buildPayloadFromLocal(localKeys),
        apply: (payload)=>{
          applyPayloadToLocal(payload, localKeySet);
          smartRefresh(cfg, resourceKey, payload);
        }
      });

      // 先拉一次（進頁就同步）
      try{ ctrl && ctrl.pullNow && ctrl.pullNow().catch(()=>{}); }catch(e){}

      // 掛到 window 方便除錯
      window.__tasunCloudCtrl__ = window.__tasunCloudCtrl__ || {};
      window.__tasunCloudCtrl__[resourceKey] = ctrl;

    }catch(e){
      console.warn("[TasunCloudPageV1] mount failed:", e);
    }
  }

  const api = {
    __v: VER,
    start,
    refreshNow: function(resourceKey){
      try{
        const c = window.__tasunCloudCtrl__ && window.__tasunCloudCtrl__[resourceKey];
        if(c && c.pullNow) return c.pullNow();
      }catch(e){}
      return Promise.resolve(false);
    }
  };

  window.TasunCloudPageV1 = api;

  // ✅自動啟動：只要頁面有 window.TASUN_CLOUD_V1 就會自動掛上
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", ()=>start(window[CFG_KEY]), { once:true });
  }else{
    start(window[CFG_KEY]);
  }
})();
