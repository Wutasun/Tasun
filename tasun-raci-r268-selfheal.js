(function(){
  'use strict';
  if(window.__TASUN_RACI_R269_STATUS_SINGLE_AUTHORITY__) return;
  window.__TASUN_RACI_R269_STATUS_SINGLE_AUTHORITY__ = true;

  var G = window.__TASUN_GLOBALS__ || {};
  var STATE = {
    running:false,
    last:0,
    timers:Object.create(null),
    observer:null,
    cooldown:180,
    cloudChecked:false
  };

  function norm(v){ return String(v == null ? '' : v).trim(); }
  function q(sel, root){ return (root || document).querySelector(sel); }
  function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function debounce(key, fn, delay){
    clearTimeout(STATE.timers[key]);
    STATE.timers[key] = setTimeout(fn, delay || 120);
  }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(_e){ return null; } }

  function parseRows(raw){
    var x = safeJSON(raw || '');
    if(Array.isArray(x)) return x;
    if(x && Array.isArray(x.rows)) return x.rows;
    if(x && Array.isArray(x.db)) return x.db;
    if(x && Array.isArray(x.items)) return x.items;
    return [];
  }
  function rowKey(r){
    return norm(r && (r.uid || r.pk || r._uid || r.id || [r.stage,r.focus,r.project].join('|')));
  }
  function rowRev(r){
    var v = r && (r.rev || r.updatedAt || r.deletedAt || 0);
    var n = Number(v);
    return isFinite(n) ? n : (Date.parse(v) || 0);
  }
  function dedupeRows(rows){
    var map = Object.create(null);
    (rows || []).forEach(function(raw){
      if(!raw || typeof raw !== 'object') return;
      var r = Object.assign({}, raw);
      var key = rowKey(r);
      if(!key) return;
      if(!r.uid) r.uid = key;
      if(!r.pk) r.pk = r.uid;
      if(r.rev == null) r.rev = 0;
      if(!r.updatedAt) r.updatedAt = new Date().toISOString();
      if(r.deleted == null) r.deleted = false;
      var old = map[key];
      if(!old || rowRev(r) >= rowRev(old)) map[key] = r;
    });
    return Object.keys(map).map(function(k){ return map[k]; });
  }
  function localRows(){
    var storageKey = norm(G.STORAGE_KEY || 'tasunRACI_Simple_v2');
    var keys = [storageKey, 'tasunRACI_Simple_v2', 'tasunRACI_Simple_v1', 'tasunRACI_Simple_last_good_v117'];
    var rows = [];
    keys.forEach(function(k){
      try{ rows = rows.concat(parseRows(localStorage.getItem(k) || sessionStorage.getItem(k) || '')); }catch(_e){}
    });
    try{ if(Array.isArray(window.db)) rows = rows.concat(window.db); }catch(_e){}
    try{ if(Array.isArray(window.__TASUN_RACI_LAST_CLOUD_RAW_ROWS__)) rows = rows.concat(window.__TASUN_RACI_LAST_CLOUD_RAW_ROWS__); }catch(_e){}
    return dedupeRows(rows).filter(function(r){ return r && !r.deleted && !r._deleted && !r.systemRow && !r._system; });
  }
  function renderedCount(){
    var tableId = norm(G.TABLE_ID || 'raciTable');
    var tbody = q('#' + tableId + ' tbody') || q('tbody');
    if(!tbody) return 0;
    return qa('tr', tbody).filter(function(tr){
      var s = norm(tr.textContent).replace(/[\s\-—]/g,'');
      return !!s;
    }).length;
  }
  function storedCloudCount(){
    var keys = ['tasunRACI_Simple_cloud_status_v151','tasunRACI_Simple_cloud_status_v143','tasunRACI_Simple_cloud_status_v118'];
    for(var i=0;i<keys.length;i++){
      try{
        var row = safeJSON(localStorage.getItem(keys[i]) || '');
        var n = Number(row && (row.cloudCount != null ? row.cloudCount : (row.actualRows != null ? row.actualRows : row.count)));
        if(isFinite(n) && n > 0) return n;
      }catch(_e){}
    }
    return 0;
  }
  function actualCount(){
    return Math.max(
      localRows().length,
      renderedCount(),
      Number(window.__TASUN_RACI_LAST_RENDERED_COUNT__ || 0) || 0,
      storedCloudCount()
    );
  }

  function labelOf(name){
    return ({version:'版本', count:'筆數', cloud:'雲端', last:'最後', duplicate:'重複'})[name] || name;
  }
  function cleanRepeated(value, type){
    var s = norm(value).replace(/\s+/g,' ');
    if(type === 'count'){
      var m = s.match(/(\d+)\s*\/\s*(\d+)/);
      return m ? (m[1] + ' / ' + m[2]) : s;
    }
    if(type === 'cloud'){
      if(/同步異常|待同步|失敗|錯誤|離線/.test(s)) return s.match(/同步異常|待同步|失敗|錯誤|離線/)[0];
      if(/已同步/.test(s) && actualCount() > 0) return '已同步';
      if(/雲端無資料/.test(s)) return '雲端無資料';
      return '同步檢查中';
    }
    if(type === 'last'){
      if(/等待雲端資料/.test(s)) return '等待雲端資料';
      var m2 = s.match(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}/);
      if(m2) return m2[0];
      return s || '等待雲端資料';
    }
    return s;
  }
  function canonicalValue(name, oldValue){
    var count = actualCount();
    if(name === 'version'){
      return norm(window.__CACHE_V || window.TASUN_APP_VER || window.APP_VER || window.__TASUN_PAGE_BUILD_STAMP__ || (G && G.PAGE_BUILD_STAMP) || oldValue || '待版本檔');
    }
    if(name === 'count') return String(count) + ' / ' + String(count);
    if(name === 'cloud'){
      if(count > 0) return '已同步';
      return cleanRepeated(oldValue, 'cloud') === '雲端無資料' ? '雲端無資料' : '同步檢查中';
    }
    if(name === 'last'){
      if(count > 0) return new Date().toLocaleString('zh-TW', {hour12:false});
      return '等待雲端資料';
    }
    return cleanRepeated(oldValue, name);
  }
  function normalizeBadge(badge, name){
    if(!badge) return;
    var oldV = '';
    var oldNode = badge.querySelector('.v');
    oldV = oldNode ? oldNode.textContent : badge.textContent;
    var value = canonicalValue(name, oldV);
    var label = labelOf(name);
    var labelText = label + (name === 'cloud' ? '：' : '');
    var curK = badge.querySelector('.k');
    var curV = badge.querySelector('.v');

    if(!curK || !curV || norm(badge.childNodes.length) === '0'){
      badge.innerHTML = '<span class="k"></span><span class="v"></span>';
      curK = badge.querySelector('.k');
      curV = badge.querySelector('.v');
    }

    if(curK.textContent !== labelText) curK.textContent = labelText;
    if(curV.textContent !== value) curV.textContent = value;

    Array.prototype.slice.call(badge.childNodes).forEach(function(n){
      if(n.nodeType === 3 && norm(n.textContent)) n.textContent = '';
    });

    badge.setAttribute('data-r269-single-status','1');
    if(name === 'cloud') badge.classList.toggle('bad', /異常|待同步|失敗|錯誤|離線/.test(value));
  }
  function canonicalizeStatusBar(){
    if(STATE.running) return;
    STATE.running = true;
    try{
      var bars = qa('#statusBar, .raciStatusBar');
      var first = bars[0];
      bars.forEach(function(bar, idx){
        if(idx > 0 && bar !== first) bar.style.display = 'none';
      });
      if(!first){ STATE.running = false; return; }
      first.setAttribute('data-r269-single-authority','1');

      var keep = Object.create(null);
      qa('[data-badge]', first).forEach(function(badge){
        var name = norm(badge.getAttribute('data-badge'));
        if(keep[name]){
          badge.setAttribute('data-r269-hidden','1');
          badge.style.display = 'none';
          return;
        }
        keep[name] = badge;
        badge.removeAttribute('data-r269-hidden');
        if(name === 'duplicate'){
          if(norm(badge.style.display) === '') badge.style.display = 'none';
          return;
        }
        normalizeBadge(badge, name);
      });

      qa('#btnDupReport', first).forEach(function(btn){
        if(norm(btn.style.display) === '') btn.style.display = 'none';
      });
    }finally{
      STATE.running = false;
    }
  }

  function patchStatusWriters(){
    if(window.__TASUN_RACI_R269_STATUS_WRITERS_PATCHED__) return;
    window.__TASUN_RACI_R269_STATUS_WRITERS_PATCHED__ = true;
    ['setRaciBadge','updateRaciStatus','setCloudSyncStatus','setCloudStatusFromActual'].forEach(function(fn){
      if(typeof window[fn] !== 'function') return;
      var old = window[fn];
      window[fn] = function(){
        var ret = old.apply(this, arguments);
        setTimeout(canonicalizeStatusBar, 0);
        setTimeout(canonicalizeStatusBar, 120);
        return ret;
      };
    });
  }
  function installObserver(){
    if(STATE.observer) return;
    var bar = document.getElementById('statusBar') || document.querySelector('.raciStatusBar');
    if(!bar || typeof MutationObserver === 'undefined') return;
    STATE.observer = new MutationObserver(function(){
      debounce('statusMutation', canonicalizeStatusBar, 60);
    });
    STATE.observer.observe(bar, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['style','class','data-badge']});
  }
  function installDesktopLift(){
    if(document.getElementById('tasun-raci-r269-desktop-lift-style')) return;
    var st = document.createElement('style');
    st.id = 'tasun-raci-r269-desktop-lift-style';
    st.textContent = [
      '@media (min-width:821px){',
      '.topbar{padding-top:6px!important;padding-bottom:8px!important;}',
      '.topbar .brand{transform:translateY(-16px)!important;}',
      '.topbar .title{margin-top:-4px!important;}',
      '#btnSearch,#btnShowAll,#editMenuWrap{transform:translateY(-12px)!important;}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function ensureTableIdentity(){
    var table = document.getElementById((G && G.TABLE_ID) || 'raciTable') || document.querySelector('table');
    if(!table) return;
    table.id = (G && G.TABLE_ID) || 'raciTable';
    table.setAttribute('data-page-key', (G && G.PAGE_KEY) || 'raci-sxdh-simple');
    table.setAttribute('data-resource-key', (G && G.RESOURCE_KEY) || 'raci-sxdh-simple');
    table.setAttribute('data-db-name', (G && G.DB_NAME) || 'tasun_raci_sxdh_simple_db_v117');
    table.setAttribute('data-storage-key', (G && G.STORAGE_KEY) || 'tasunRACI_Simple_v2');
    table.setAttribute('data-has-individual-id','true');
  }
  function tightenTextControls(){
    qa('input[type="text"], input:not([type]), textarea').forEach(function(el){
      var old = String(el.value || '');
      var next = old.replace(/[\t\r\n\u3000]+/g,' ').replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g,'$1').replace(/\s{2,}/g,' ').trim();
      if(old !== next) el.value = next;
    });
    qa('select option').forEach(function(opt){
      var t = norm(opt.textContent).replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g,'$1').replace(/\s{2,}/g,' ');
      var v = norm(opt.value).replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g,'$1').replace(/\s{2,}/g,' ');
      if(opt.textContent !== t) opt.textContent = t;
      if(opt.value !== v) opt.value = v;
    });
  }
  function registerSelfHeal(){
    try{
      var core = window.TasunSelfHealV5 = window.TasunSelfHealV5 || {features:{},register:function(k,f){this.features[k]=f||{};}};
      if(typeof core.register === 'function'){
        core.register('raciStatusSingleAuthorityR269',{
          check:function(){ return true; },
          repair:function(){ canonicalizeStatusBar(); return true; },
          verify:function(){ return true; },
          coolDownMs:900,
          maxRetry:6
        });
        core.register('raciDesktopTitleButtonsLiftR269',{
          check:function(){ return !!document.getElementById('tasun-raci-r269-desktop-lift-style'); },
          repair:function(){ installDesktopLift(); return true; },
          verify:function(){ return !!document.getElementById('tasun-raci-r269-desktop-lift-style'); },
          coolDownMs:900,
          maxRetry:6
        });
      }
    }catch(_e){}
  }
  function controlledCloudKick(){
    if(window.__TASUN_RACI_R269_CLOUD_KICK_DONE__) return;
    window.__TASUN_RACI_R269_CLOUD_KICK_DONE__ = true;
    try{
      if(typeof window.__TASUN_RACI_CLOUD_ROUNDTRIP_DEDUPE__ === 'function'){
        window.__TASUN_RACI_CLOUD_ROUNDTRIP_DEDUPE__('r269-status-repair');
      }else if(typeof window.syncCloud === 'function'){
        window.syncCloud('r269-status-repair');
      }else if(typeof window.scheduleCloudSync === 'function'){
        window.scheduleCloudSync('r269-status-repair', 120);
      }
    }catch(_e){}
  }
  function run(reason){
    var t = Date.now();
    if((t - STATE.last) < STATE.cooldown && reason !== 'force') return;
    STATE.last = t;
    ensureTableIdentity();
    tightenTextControls();
    patchStatusWriters();
    installDesktopLift();
    registerSelfHeal();
    canonicalizeStatusBar();
    installObserver();
    window.__TASUN_RACI_R269_LAST_RUN__ = {reason:reason || 'manual', at:new Date().toISOString()};
  }

  function boot(){
    run('boot');
    controlledCloudKick();
    [150,500,1000,1800,3000,5000,8000,12000].forEach(function(ms){
      setTimeout(function(){ run('boot-'+ms); }, ms);
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true, passive:true});
  else boot();
  ['pageshow','resize','orientationchange','focus','visibilitychange'].forEach(function(ev){
    window.addEventListener(ev, function(){ debounce('run-'+ev, function(){ run(ev); }, 160); }, {passive:true});
  });
})();
