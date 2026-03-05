/* Tasun Cloud Kit v4-stable (minimal, merge-first)
   目標：
   - 多人/多設備資料版本一致（pull + merge-save）
   - 不改既有 UI：僅提供右下角小工具
   - 若 resources 未設定/無法連線：不阻斷本地功能

   需要 tasun-resources.json 內對應 resourceKey 的 read/merge/health。
   資料格式：payload = { db:[{id,k,v,...}], counter:n }
*/
(function(){
  'use strict';

  const Kit = {};

  let _cfg = {
    appVer: '',
    resourcesUrl: 'tasun-resources.json',
    ui: { enabled:true, position:'bottom-right', hideLockButtons:true },
    lock: { enabled:false, auto:false }
  };

  let _resources = null;
  let _ui = null;

  function jsonParse(s, fb){ try{ return JSON.parse(s); }catch(_){ return fb; } }

  async function fetchJson(url, opts){
    const r = await fetch(url, Object.assign({ cache:'no-store', credentials:'include' }, opts||{}));
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  }

  function withV(u){
    try{
      if(window.TasunCore && typeof window.TasunCore.withV === 'function') return window.TasunCore.withV(u);
      if(typeof window.__withV === 'function') return window.__withV(u);
    }catch(_){ }
    return String(u||'');
  }

  async function loadResources(){
    if(_resources) return _resources;
    const url = withV(_cfg.resourcesUrl || 'tasun-resources.json');
    _resources = await fetchJson(url);
    return _resources;
  }

  function pickEndpoints(resourceKey){
    const r = _resources || {};
    const res = (r.resources && r.resources[resourceKey]) ? r.resources[resourceKey] : null;
    if(!res) return null;
    return {
      health: res.health || (r.apiBase ? (r.apiBase.replace(/\/$/,'') + '/health') : ''),
      read: res.read,
      merge: res.merge
    };
  }

  function ensureUI(){
    if(!_cfg.ui || !_cfg.ui.enabled) return null;
    if(_ui) return _ui;

    const wrap = document.createElement('div');
    wrap.id = 'tasunCloudKitUI';
    wrap.style.position = 'fixed';
    wrap.style.zIndex = '9999';
    wrap.style.right = '14px';
    wrap.style.bottom = '14px';
    wrap.style.display = 'flex';
    wrap.style.gap = '8px';
    wrap.style.alignItems = 'center';

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.textContent = '☁ 同步';
    pill.style.borderRadius = '999px';
    pill.style.padding = '10px 12px';
    pill.style.border = '1px solid rgba(246,211,122,0.55)';
    pill.style.background = 'rgba(0,0,0,0.28)';
    pill.style.color = 'rgba(255,232,175,0.95)';
    pill.style.fontWeight = '800';
    pill.style.letterSpacing = '.08em';
    pill.style.cursor = 'pointer';
    pill.style.backdropFilter = 'blur(8px)';
    pill.style.webkitBackdropFilter = 'blur(8px)';

    const dot = document.createElement('span');
    dot.textContent = '●';
    dot.style.fontSize = '10px';
    dot.style.opacity = '.75';

    const msg = document.createElement('span');
    msg.textContent = '本地';
    msg.style.fontSize = '12px';
    msg.style.opacity = '.82';
    msg.style.color = 'rgba(255,232,175,0.90)';
    msg.style.textShadow = '0 6px 14px rgba(0,0,0,0.40)';

    pill.appendChild(document.createTextNode(' '));
    pill.appendChild(dot);

    wrap.appendChild(pill);
    wrap.appendChild(msg);

    function setState(state, text){
      // state: ok | warn | off | work
      if(state === 'ok') dot.style.color = 'rgba(120,255,160,0.95)';
      else if(state === 'warn') dot.style.color = 'rgba(255,210,120,0.95)';
      else if(state === 'work') dot.style.color = 'rgba(160,210,255,0.95)';
      else dot.style.color = 'rgba(255,120,120,0.90)';
      msg.textContent = text || '';
    }

    _ui = { wrap, pill, msg, setState };

    try{ document.body.appendChild(wrap); }catch(_){ }
    return _ui;
  }

  function nowIso(){
    try{ return new Date().toISOString(); }catch(_){ return ''; }
  }

  // 合併策略：以 pk(k) 為主，v 以 updatedAt/newer 為準；若 v 是字串，直接以「最後寫入」為新。
  function mergePayload(localPayload, remotePayload, pkField){
    const lp = localPayload && typeof localPayload === 'object' ? localPayload : { db:[] };
    const rp = remotePayload && typeof remotePayload === 'object' ? remotePayload : { db:[] };
    const pk = String(pkField || 'k');

    const map = new Map();

    function ingest(src){
      const db = Array.isArray(src.db) ? src.db : [];
      for(const row of db){
        if(!row) continue;
        const key = String(row[pk] || row.k || '').trim();
        if(!key) continue;
        const cur = map.get(key);
        if(!cur){ map.set(key, row); continue; }
        const a = Number(cur.updatedAt || cur.ts || 0);
        const b = Number(row.updatedAt || row.ts || 0);
        if(b && a){
          if(b >= a) map.set(key, row);
        }else{
          // 沒有時間戳：用 remote 覆蓋 local（避免丟失多人修改）
          map.set(key, row);
        }
      }
    }

    ingest(lp);
    ingest(rp);

    const out = Array.from(map.values());
    out.sort((x,y)=>String(x[pk]||'').localeCompare(String(y[pk]||''), 'zh-Hant'));

    // id/counter 重建
    out.forEach((r,i)=>{ if(r) r.id = i+1; });

    return { db: out, counter: out.length, mergedAt: nowIso() };
  }

  Kit.init = function(cfg){
    try{ _cfg = Object.assign(_cfg, cfg||{}); }catch(_){ }
    ensureUI();
  };

  Kit.mount = function(opts){
    opts = opts || {};

    const state = {
      resourceKey: String(opts.resourceKey || '').trim(),
      pk: String(opts.pk || 'k'),
      getLocal: typeof opts.getLocal === 'function' ? opts.getLocal : (()=>({db:[],counter:0})),
      apply: typeof opts.apply === 'function' ? opts.apply : (()=>{}),
      watch: opts.watch || { intervalSec: 10 },
      __readOnly__: false,
      _timer: 0,
      _busy: false,
      _lastRemote: null,
      _lastPullAt: 0
    };

    const ui = ensureUI();

    async function health(ep){
      if(!ep || !ep.health) return false;
      try{
        await fetch(ep.health, { cache:'no-store', credentials:'include' });
        return true;
      }catch(_){ return false; }
    }

    async function readRemote(ep){
      if(!ep || !ep.read) return null;
      return await fetchJson(ep.read, { method:'GET' });
    }

    async function mergeSave(ep, mergedPayload){
      if(!ep || !ep.merge) throw new Error('no merge endpoint');
      return await fetchJson(ep.merge, {
        method:'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({ payload: mergedPayload, client: { at: nowIso(), appVer: _cfg.appVer || '' } })
      });
    }

    async function pullNow(){
      if(state._busy) return;
      state._busy = true;
      if(ui) ui.setState('work', '同步中…');

      try{
        await loadResources();
        const ep = pickEndpoints(state.resourceKey);
        if(!ep){
          if(ui) ui.setState('off', '未設定雲端');
          return;
        }

        const ok = await health(ep);
        if(!ok){
          if(ui) ui.setState('warn', '離線 / 未授權');
          return;
        }

        const remote = await readRemote(ep);
        state._lastRemote = remote;
        state._lastPullAt = Date.now();

        // apply remote → local（由頁面決定如何寫入 localStorage）
        try{ state.apply(remote); }catch(_){ }

        if(ui) ui.setState('ok', '已同步');
      }catch(e){
        if(ui) ui.setState('warn', '同步失敗');
      }finally{
        state._busy = false;
      }
    }

    async function saveMerged(params){
      params = params || {};
      if(state.__readOnly__) return;
      if(state._busy) return;
      state._busy = true;
      if(ui) ui.setState('work', '上傳中…');

      try{
        await loadResources();
        const ep = pickEndpoints(state.resourceKey);
        if(!ep){
          if(ui) ui.setState('off', '未設定雲端');
          return;
        }
        const ok = await health(ep);
        if(!ok){
          if(ui) ui.setState('warn', '離線 / 未授權');
          return;
        }

        // 先讀 remote，再 merge，再寫 merge
        const localPayload = state.getLocal();
        const remote = await readRemote(ep);
        const merged = mergePayload(localPayload, remote, state.pk);

        await mergeSave(ep, merged);

        // 寫完再 pull 一次確保一致
        try{ state.apply(merged); }catch(_){ }

        if(ui) ui.setState('ok', '已上傳');
      }catch(e){
        if(ui) ui.setState('warn', '上傳失敗');
      }finally{
        state._busy = false;
      }
    }

    function startWatch(){
      const sec = Math.max(5, Number(state.watch && state.watch.intervalSec || 10));
      clearInterval(state._timer);
      state._timer = setInterval(()=>{ pullNow().catch(()=>{}); }, sec*1000);
    }

    if(ui){
      ui.pill.addEventListener('click', ()=>{
        if(state.__readOnly__) pullNow().catch(()=>{});
        else saveMerged({ mode:'merge', lock:false }).catch(()=>{});
      });
    }

    // public controller
    const ctrl = {
      pullNow,
      saveMerged,
      startWatch,
      __readOnly__: false
    };

    // 自動 watch
    try{ startWatch(); }catch(_){ }

    return ctrl;
  };

  window.TasunCloudKit = window.TasunCloudKit || Kit;
})();
