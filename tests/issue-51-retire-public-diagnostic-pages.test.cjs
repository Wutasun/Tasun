'use strict';

const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const R880='汐東收發文明細表_雲端逐步測試_正式版.html';
const R442='捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html';
const RETIRED=[R880,R442];
const LINEAGE=[
  R880,
  'xidong-official-doc-detail-cloud-step-test',
  '汐東收發文明細表_雲端逐步測試_正式版_R492.html',
  '汐東收發文明細表_雲端逐步測試_正式版_R493.html',
  '汐東收發文明細表_雲端逐步測試_正式版_R494.html',
  '汐東收發文明細表_雲端逐步測試_正式版_R495.html',
  '汐東收發文明細表_雲端逐步測試_正式版_R496.html',
  '汐東收發文明細表_雲端逐步測試_正式版_R497.html',
  '汐東收發文明細表_雲端逐步測試_正式版_R498.html',
  '汐東收發文明細表_雲端逐步測試_正式版_R499.html',
  '汐東收發文明細表_雲端逐步測試_正式版_R501.html'
];
const FORMAL=[
  ['汐東收發文明細表.html',['xidong-official-doc-detail','official-doc-detail','official_doc_detail']],
  ['汐東收發文登錄表.html',['xidong-official-doc-register','official-doc-register','official_doc_register']],
  ['汐東文件統計表.html',['xidong-official-doc-statistics','official-doc-statistics','official_doc_statistics']],
  ['汐東文件管理表.html',['xidong-doc-manager','xidong_doc_manager']]
];

function manifest(){
  return JSON.parse(read('tasun-version.json'));
}

function assertDiagnosticAuthorityAbsent(j){
  const pages=j.pages||{};
  for(const key of LINEAGE) assert.equal(Object.hasOwn(pages,key),false,'retired manifest pages key must be absent: '+key);
  for(const [key,entry] of Object.entries(pages)){
    if(!entry||typeof entry!=='object') continue;
    assert.notEqual(entry.file,R880,key+' must not point file at retired R880 diagnostic');
    assert.notEqual(entry.redirectTo,R880,key+' must not redirect to retired R880 diagnostic');
    assert.notEqual(entry.canonicalTestPage,R880,key+' must not canonicalize to retired R880 diagnostic');
    assert.notEqual(entry.pageKey,'xidong-official-doc-detail-cloud-step-test',key+' must not retain retired diagnostic pageKey');
    assert.notEqual(entry.file,R442,key+' must not point file at retired R442 diagnostic');
  }
}

test('Issue #51 Option A2 retires both public diagnostic HTML files',()=>{
  for(const rel of RETIRED) assert.equal(exists(rel),false,rel+' must be retired');
});

test('Issue #51 Option A2 retires diagnostic manifest authority and redirect lineage',()=>{
  assertDiagnosticAuthorityAbsent(manifest());
});

test('Issue #51 Option A2 preserves formal four-page authority at the root build',()=>{
  const j=manifest();
  assert.match(String(j.version||''),/_r\d+_/);
  assert.equal(j.releaseSequence,Number(String(j.version).match(/_r(\d+)_/)[1]));
  for(const [file,aliases] of FORMAL){
    assert.equal(exists(file),true,file+' must remain present');
    for(const key of [file,...aliases]){
      const entry=j.pages?.[key];
      assert.ok(entry,key+' manifest authority must remain');
      assert.equal(entry.file,file,key+' must point to '+file);
      assert.equal(entry.version,j.version,key+' must remain at the root formal build');
      assert.equal(entry.releaseSequence,j.releaseSequence,key+' sequence must remain coherent');
    }
  }
  for(const rel of ['TASUN_REBUILD','TASUN_REBUILD_STAMP','publish-version_tasun_project_autoscan.mjs','.github/workflows/release-version.yml']){
    assert.equal(exists(rel),true,rel+' must remain present');
  }
});

test('Issue #51 Option A2 has no active retired-page consumer; one dormant TRUSTED_FILES literal is allowed',()=>{
  const markerA=['__TASUN','TEST','PAGE','PUBLIC','DIRECT','OPEN__'].join('_');
  const markerB=['__TASUN','CLOUD','STEP','TEST','AUTH','OPTIONAL__'].join('_');
  const activeExt=/\.(?:html?|js|mjs|cjs|json|ya?ml)$/i;
  const skip=['docs'+path.sep,'tests'+path.sep,'.git'+path.sep,'node_modules'+path.sep];
  const formalDetail='汐東收發文明細表.html';
  const stack=[ROOT];
  while(stack.length){
    const dir=stack.pop();
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const abs=path.join(dir,ent.name);
      const rel=path.relative(ROOT,abs);
      if(skip.some(x=>rel===x.slice(0,-1)||rel.startsWith(x))) continue;
      if(ent.isDirectory()){stack.push(abs);continue;}
      if(!activeExt.test(ent.name)) continue;
      const txt=fs.readFileSync(abs,'utf8');
      if(rel==='tasun-version.json') continue;
      assert.ok(!txt.includes(R442),rel+' must not consume retired R442 diagnostic');
      if(rel===formalDetail){
        const count=txt.split(R880).length-1;
        assert.equal(count,1,'formal detail may retain exactly one dormant compatibility literal');
        const at=txt.indexOf(R880);
        const context=txt.slice(Math.max(0,at-500),at+R880.length+200);
        assert.match(context,/TRUSTED_FILES=/,'allowed R880 literal must remain inside TRUSTED_FILES compatibility list');
      }else{
        assert.ok(!txt.includes(R880),rel+' must not consume retired R880 diagnostic');
      }
      assert.ok(!txt.includes(markerA),rel+' must not reintroduce public-direct diagnostic marker');
      assert.ok(!txt.includes(markerB),rel+' must not reintroduce auth-optional diagnostic marker');
    }
  }
});

test('Issue #51 Option A2 metadata-only publisher keeps formal build and sequence and does not restore retired authority',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tasun-issue51-a2-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const mkdir=rel=>fs.mkdirSync(path.join(dir,rel),{recursive:true});
  const copy=rel=>{mkdir(path.dirname(rel));fs.copyFileSync(path.join(ROOT,rel),path.join(dir,rel));};

  for(const rel of [
    'publish-version_tasun_project_autoscan.mjs',
    'tasun-version.json',
    'TASUN_REBUILD',
    'TASUN_REBUILD_STAMP',
    '.github/workflows/release-version.yml',
    ...FORMAL.map(x=>x[0])
  ]) copy(rel);

  const before=JSON.parse(fs.readFileSync(path.join(dir,'tasun-version.json'),'utf8'));
  const beforeBuild=before.version;
  const beforeSequence=before.releaseSequence;
  assertDiagnosticAuthorityAbsent(before);

  const r=spawnSync(process.execPath,['publish-version_tasun_project_autoscan.mjs'],{
    cwd:dir,
    encoding:'utf8',
    env:{...process.env,TASUN_CHANGED_FILES:'tasun-version.json',TASUN_BEFORE_SHA:'',TASUN_HEAD_SHA:''}
  });

  assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
  const after=JSON.parse(fs.readFileSync(path.join(dir,'tasun-version.json'),'utf8'));
  assert.equal(after.version,beforeBuild,'metadata-only cleanup must keep the formal build');
  assert.equal(after.releaseSequence,beforeSequence,'metadata-only cleanup must keep releaseSequence');
  assertDiagnosticAuthorityAbsent(after);
  assert.match(r.stdout,/read-only four-page release verification passed:/);
});
