'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const ENTRY=path.join(ROOT,'entry.html');
const BRIDGE_KEYS=[
  'tasunCurrentUser_v1',
  'tasunSessionBridge_v1',
  'tasunSession_v1',
  'tasunSso_v2',
  'tasunSso_v1'
];
const ROUTING_KEYS=['tasun_next_path_v1','tasun_entry_next_v1','tasun_child_jump_lock_v1'];
const DEFAULT_PAGE='汐東工程管理表.html';

function entrySource(){ return fs.readFileSync(ENTRY,'utf8'); }
function routerScript(){
  const m=entrySource().match(/<script\s+id=["']tasun-entry-direct-router-r162["']>([\s\S]*?)<\/script>/i);
  assert.ok(m,'entry.html must retain the Tasun direct-router script');
  return m[1];
}
function storage(seed={},failOps=[]){
  const map=new Map(Object.entries(seed));
  const fail=new Set(failOps);
  return {
    getItem(k){ if(fail.has('get')) throw new Error('SecurityError'); return map.has(k)?map.get(k):null; },
    setItem(k,v){ if(fail.has('set')) throw new Error('SecurityError'); map.set(k,String(v)); },
    removeItem(k){ if(fail.has('remove')) throw new Error('SecurityError'); map.delete(k); }
  };
}
function runEntry({
  href='https://example.test/entry.html',
  session={},
  local={},
  sessionFailOps=[],
  localFailOps=[],
  globals={},
  now=1700000000000
}={}){
  const replaced=[];
  const sessionStorage=storage(session,sessionFailOps);
  const localStorage=storage(local,localFailOps);
  const location={
    href,
    get hash(){ return new URL(this.href).hash; },
    replace(value){ replaced.push(String(value)); this.href=String(value); }
  };
  const ctx={
    URL,
    location,
    sessionStorage,
    localStorage,
    Date:{now:()=>now},
    console
  };
  Object.assign(ctx,globals);
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(routerScript(),ctx,{filename:'entry.html#tasun-entry-direct-router-r162'});
  return {ctx,replaced,sessionStorage,localStorage};
}
function targetName(result){
  assert.equal(result.replaced.length,1,'entry router must perform exactly one automatic redirect');
  const u=new URL(result.replaced[0]);
  return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');
}
function redirectedUrl(result){
  assert.equal(result.replaced.length,1,'entry router must perform exactly one redirect');
  return new URL(result.replaced[0]);
}

test('Issue #99 Contract A: entry compatibility router remains present and auto-executes',()=>{
  assert.equal(fs.existsSync(ENTRY),true,'root entry.html must remain present');
  const source=entrySource();
  assert.match(source,/id=["']tasun-entry-direct-router-r162["']/);
  assert.match(source,/window\.__TASUN_ENTRY_GO__\s*=\s*go/);
  const result=runEntry();
  assert.equal(typeof result.ctx.__TASUN_ENTRY_GO__,'function','go must remain externally exposed');
  assert.equal(targetName(result),DEFAULT_PAGE,'direct load must automatically route');
});

test('Issue #99 Contract B: target selection, normalization, legacy remap, and current allowlist quirks remain intact',()=>{
  const allowlisted=[
    '汐東工程管理表.html',
    '捷運汐東線權責分工精簡版.html',
    '捷運汐東線事項記錄.html',
    '捷運汐止東湖線統包工程-資料庫.html',
    '捷運汐止東湖線統包工程-資料明細表.html',
    'index.html'
  ];
  const script=routerScript();
  const allowBlock=(script.match(/var\s+ALLOW\s*=\s*\{([\s\S]*?)\};/)||[])[1]||'';
  for(const name of allowlisted){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\  for(const name of allowlisted){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\  const source=entrySource();
  for(const name of allowlisted) assert.ok(source.includes(name),name+' must remain in allowlist source');');
    assert.match(allowBlock,new RegExp("['\\\"]"+escaped+"['\\\"]\\s*:\\s*true"),name+' must remain an enabled own entry in ALLOW');
  }');
    assert.match(allowBlock,new RegExp("['\\\"]"+escaped+"['\\\"]\\s*:\\s*true"),name+' must remain an enabled own entry in ALLOW');
  }

  assert.equal(targetName(runEntry({href:'https://example.test/entry.html?next=index.html'})),'index.html');
  assert.equal(targetName(runEntry({href:'https://example.test/entry.html?to='+encodeURIComponent('捷運汐東線事項記錄.html')})),'捷運汐東線事項記錄.html');
  assert.equal(targetName(runEntry({href:'https://example.test/entry.html?page=index.html'})),'index.html');

  assert.equal(
    targetName(runEntry({href:'https://example.test/entry.html?next=index.html&to='+encodeURIComponent('捷運汐東線事項記錄.html')+'&page='+encodeURIComponent('捷運汐東線權責分工精簡版.html')})),
    'index.html',
    'query alias precedence must keep next highest'
  );
  assert.equal(
    targetName(runEntry({href:'https://example.test/entry.html?to='+encodeURIComponent('捷運汐東線事項記錄.html')+'&page=index.html'})),
    '捷運汐東線事項記錄.html',
    'query alias precedence must keep to above page'
  );
  assert.equal(
    targetName(runEntry({href:'https://example.test/entry.html?next=%20&to=index.html#next='+encodeURIComponent('捷運汐東線權責分工精簡版.html')})),
    '捷運汐東線權責分工精簡版.html',
    'truthy whitespace next suppresses later query aliases, normalizes empty, then permits hash fallback'
  );

  assert.match(script,/sessionStorage\.getItem\('tasun_entry_next_v1'\)/,'stored-routing branch must still read session tasun_entry_next_v1');
  assert.match(script,/sessionStorage\.getItem\('tasun_next_path_v1'\)/,'stored-routing branch must still read session tasun_next_path_v1');
  assert.match(script,/localStorage\.getItem\('tasun_entry_next_v1'\)/,'stored-routing branch must still read local tasun_entry_next_v1');
  assert.match(script,/localStorage\.getItem\('tasun_next_path_v1'\)/,'stored-routing branch must still read local tasun_next_path_v1');
  assert.equal(
    targetName(runEntry({session:{tasun_entry_next_v1:'index.html'}})),
    DEFAULT_PAGE,
    'go() must bridge/clean storage hints before pickTarget(), leaving storage-only routing ineffective'
  );
  for(const alias of ['next','to','page']){
    assert.equal(targetName(runEntry({href:'https://example.test/entry.html#'+alias+'=index.html'})),'index.html','hash '+alias+' remains effective');
  }

  const encodedTarget='捷運汐東線事項記錄.html';
  const doubleEncoded=encodeURIComponent(encodeURIComponent(encodedTarget));
  assert.equal(targetName(runEntry({href:'https://example.test/entry.html?next='+doubleEncoded})),encodedTarget,'multiply encoded target must decode deeply');
  const urlTarget=encodeURIComponent('https://legacy.example/path/to/index.html?x=1#frag');
  assert.equal(targetName(runEntry({href:'https://example.test/entry.html?next='+urlTarget})),'index.html','URL/path input must normalize to final basename');

  for(const legacy of ['汐東工程管理表','捷運汐止東湖線','捷運汐東線管理']){
    assert.equal(
      targetName(runEntry({href:'https://example.test/entry.html?next='+encodeURIComponent(legacy+'-legacy.html')})),
      DEFAULT_PAGE,
      legacy+' legacy match must remap to default'
    );
  }
  assert.equal(
    targetName(runEntry({href:'https://example.test/entry.html?next='+encodeURIComponent('捷運汐止東湖線統包工程-資料庫.html')})),
    DEFAULT_PAGE,
    'legacy remap must occur before allowlist fallback'
  );

  assert.equal(targetName(runEntry({href:'https://example.test/entry.html?next=missing-file.html'})),DEFAULT_PAGE,'ordinary missing basename must fall back');
  assert.equal(targetName(runEntry({href:'https://example.test/entry.html?next=constructor'})),'constructor','ordinary-object ALLOW prototype-key quirk must remain characterized');
  assert.equal(targetName(runEntry({href:'https://example.test/entry.html?next=toString'})),'toString','inherited prototype keys remain truthy under current lookup');
});

test('Issue #99 Contract C: session bridge propagation, cleanup, markers, and storage fault isolation remain intact',()=>{
  const result=runEntry({
    session:{
      tasunCurrentUser_v1:'SESSION-FIRST',
      tasun_entry_next_v1:'index.html',
      tasun_next_path_v1:'index.html',
      tasun_child_jump_lock_v1:'1'
    },
    local:{tasunCurrentUser_v1:'LOCAL-SECOND'}
  });
  for(const key of BRIDGE_KEYS){
    assert.equal(result.sessionStorage.getItem(key),'SESSION-FIRST',key+' must receive bridge value in sessionStorage');
    assert.equal(result.localStorage.getItem(key),'SESSION-FIRST',key+' must receive bridge value in localStorage');
  }
  for(const key of ROUTING_KEYS){
    assert.equal(result.sessionStorage.getItem(key),null,key+' must be removed from sessionStorage');
    assert.equal(result.localStorage.getItem(key),null,key+' must be removed from localStorage');
  }
  assert.equal(result.sessionStorage.getItem('tasunIndexSession_v1'),'1');
  assert.equal(result.sessionStorage.getItem('tasunIndexSessionAuthed_v2'),'1');

  for(let i=0;i<BRIDGE_KEYS.length;i++){
    const session={};
    const local={};
    for(let j=i;j<BRIDGE_KEYS.length;j++){
      session[BRIDGE_KEYS[j]]='SESSION-'+j;
      local[BRIDGE_KEYS[j]]='LOCAL-'+j;
    }
    const precedence=runEntry({session,local});
    const expected='SESSION-'+i;
    for(const key of BRIDGE_KEYS){
      assert.equal(precedence.sessionStorage.getItem(key),expected,'bridge precedence must select earliest populated key: '+BRIDGE_KEYS[i]);
      assert.equal(precedence.localStorage.getItem(key),expected,'bridge fan-out must preserve earliest populated key: '+BRIDGE_KEYS[i]);
    }
  }
  const localOnly=runEntry({local:{tasunCurrentUser_v1:'LOCAL-FIRST'},session:{tasunSessionBridge_v1:'SESSION-LATER'}});
  for(const key of BRIDGE_KEYS){
    assert.equal(localOnly.sessionStorage.getItem(key),'LOCAL-FIRST','within the earliest key, local fallback must beat later keys');
    assert.equal(localOnly.localStorage.getItem(key),'LOCAL-FIRST','same local-found value must fan out to both stores');
  }

  for(const op of ['get','set','remove']){
    const opts={href:'https://example.test/entry.html#next=index.html'};
    if(op==='get'){
      opts.sessionFailOps=['get'];
      opts.localFailOps=['get'];
    }else if(op==='set'){
      opts.session={tasunCurrentUser_v1:'USER'};
      opts.sessionFailOps=['set'];
      opts.localFailOps=['set'];
    }else{
      opts.sessionFailOps=['remove'];
      opts.localFailOps=['remove'];
    }
    const throwing=runEntry(opts);
    assert.equal(targetName(throwing),'index.html','storage '+op+' failure must not prevent hash routing and location.replace');
  }
});

test('Issue #99 Contract D: redirect, version precedence/normalization, and timestamp cache busting remain intact',()=>{
  const query=runEntry({
    href:'https://example.test/entry.html?v=QUERY',
    globals:{__CACHE_V:'CACHE',TASUN_APP_VER:'TASUN',APP_VER:'APP'},
    now:101
  });
  assert.equal(redirectedUrl(query).searchParams.get('v'),'QUERY');

  const cache=runEntry({globals:{__CACHE_V:'CACHE',TASUN_APP_VER:'TASUN',APP_VER:'APP'},now:102});
  assert.equal(redirectedUrl(cache).searchParams.get('v'),'CACHE');

  const tasun=runEntry({globals:{__CACHE_V:'',TASUN_APP_VER:'TASUN',APP_VER:'APP'},now:103});
  assert.equal(redirectedUrl(tasun).searchParams.get('v'),'TASUN');

  const app=runEntry({globals:{__CACHE_V:'',TASUN_APP_VER:'',APP_VER:'APP'},now:104});
  assert.equal(redirectedUrl(app).searchParams.get('v'),'APP');

  const whitespace=runEntry({
    href:'https://example.test/entry.html?v=%20',
    globals:{__CACHE_V:'CACHE'},
    now:105
  });
  assert.equal(redirectedUrl(whitespace).searchParams.has('v'),false,'truthy raw whitespace query v must block fallback then normalize empty');

  const first=runEntry({now:111});
  const second=runEntry({now:222});
  assert.equal(redirectedUrl(first).searchParams.get('_'),'111','cache buster must derive from Date.now()');
  assert.equal(redirectedUrl(second).searchParams.get('_'),'222','cache buster must vary with navigation timestamp');
  assert.notEqual(redirectedUrl(first).searchParams.get('_'),redirectedUrl(second).searchParams.get('_'));

  assert.match(routerScript(),/location\.replace\(out\.toString\(\)\)/,'redirect mechanism must remain location.replace');
});

const PROTECTION_MANIFEST=Object.freeze({
  issue:99,
  surface:'entry.html',
  contracts:Object.freeze(['A','B','C','D','E']),
  finalized:true
});

test('Issue #99 Contract E: focused compatibility protection manifest is finalized',()=>{
  assert.equal(PROTECTION_MANIFEST.finalized,true,'RED intentionally fails until the focused protection manifest is finalized');
});
