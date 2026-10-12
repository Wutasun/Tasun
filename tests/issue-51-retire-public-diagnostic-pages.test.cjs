'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const {spawnSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const RETIRED=[
  '汐東收發文明細表_雲端逐步測試_正式版.html',
  '捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html'
];

test('Issue #51 retires the R880 public diagnostic page',()=>{
  assert.equal(exists('汐東收發文明細表_雲端逐步測試_正式版.html'),false,'R880 public diagnostic page must be retired');
});

test('Issue #51 retires the R442 public diagnostic page',()=>{
  assert.equal(exists('捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html'),false,'R442 public diagnostic page must be retired');
});

test('Issue #51 preserves formal release authority',()=>{
  for(const rel of [
    '汐東收發文明細表.html',
    '汐東收發文登錄表.html',
    '汐東文件統計表.html',
    '汐東文件管理表.html',
    'tasun-version.json',
    'TASUN_REBUILD',
    'TASUN_REBUILD_STAMP',
    'publish-version_tasun_project_autoscan.mjs',
    '.github/workflows/release-version.yml'
  ]){
    assert.equal(exists(rel),true,rel+' must remain present');
  }
});

test('Issue #51 retired diagnostics are not manifest authorities',()=>{
  const manifest=read('tasun-version.json');
  for(const rel of RETIRED) assert.ok(!manifest.includes(rel),'manifest must not list '+rel);
});

test('Issue #51 active sources do not depend on retired diagnostics or public-direct markers',()=>{
  const markers=[
    ['__TASUN','TEST','PAGE','PUBLIC','DIRECT','OPEN__'].join('_'),
    ['__TASUN','CLOUD','STEP','TEST','AUTH','OPTIONAL__'].join('_')
  ];
  const activeExt=/\.(?:html?|js|mjs|cjs|json|ya?ml)$/i;
  const skip=['docs'+path.sep,'tests'+path.sep,'.git'+path.sep,'node_modules'+path.sep];
  const stack=[ROOT];
  while(stack.length){
    const dir=stack.pop();
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const abs=path.join(dir,ent.name);
      const rel=path.relative(ROOT,abs);
      if(skip.some(x=>rel===x.slice(0,-1)||rel.startsWith(x))) continue;
      if(ent.isDirectory()){stack.push(abs);continue;}
      if(RETIRED.includes(rel)) continue;
      if(!activeExt.test(ent.name)) continue;
      const txt=fs.readFileSync(abs,'utf8');
      for(const retired of RETIRED) assert.ok(!txt.includes(retired),rel+' must not depend on '+retired);
      for(const marker of markers) assert.ok(!txt.includes(marker),rel+' must not reintroduce retired diagnostic marker');
    }
  }
});

test('Issue #51 cleanup-only deleted diagnostic paths do not advance formal release identity',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tasun-issue51-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const mkdir=rel=>fs.mkdirSync(path.join(dir,rel),{recursive:true});
  const copy=rel=>{mkdir(path.dirname(rel));fs.copyFileSync(path.join(ROOT,rel),path.join(dir,rel));};
  copy('publish-version_tasun_project_autoscan.mjs');
  copy('tasun-version.json');
  copy('.github/workflows/release-version.yml');
  const before=fs.readFileSync(path.join(dir,'tasun-version.json'));
  const manifest=JSON.parse(before.toString('utf8'));
  const r=spawnSync(process.execPath,['publish-version_tasun_project_autoscan.mjs'],{
    cwd:dir,
    encoding:'utf8',
    env:{...process.env,TASUN_CHANGED_FILES:RETIRED.join('\n')}
  });
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/no formal page\/core\/manifest change; nothing to sync\./);
  const after=fs.readFileSync(path.join(dir,'tasun-version.json'));
  assert.deepEqual(after,before,'cleanup-only diagnostic deletion must not rewrite tasun-version.json');
  const next=JSON.parse(after.toString('utf8'));
  assert.equal(next.version,manifest.version);
  assert.equal(next.releaseSequence,manifest.releaseSequence);
});
