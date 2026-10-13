'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'..');
const FORBIDDEN_PREFIX='tasun-api/';

function readJson(rel,root=ROOT){
  return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
}
function forbiddenAuthorities(manifest){
  return Object.entries(manifest.pages||{})
    .filter(([,entry])=>entry&&typeof entry==='object'&&String(entry.file||'').startsWith(FORBIDDEN_PREFIX))
    .map(([key,entry])=>({key,file:String(entry.file||'')}));
}

test('Issue #76 current manifest contains no non-deployed tasun-api page authority',()=>{
  const manifest=readJson('tasun-version.json');
  assert.deepEqual(forbiddenAuthorities(manifest),[],'non-deployed Pages authorities remain');
});

test('Issue #76 publisher cannot reintroduce tasun-api page authority when source HTML changes',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tasun-issue76-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const mkdir=rel=>fs.mkdirSync(path.dirname(path.join(dir,rel)),{recursive:true});
  const copy=rel=>{mkdir(rel);fs.copyFileSync(path.join(ROOT,rel),path.join(dir,rel));};

  for(const rel of [
    'publish-version_tasun_project_autoscan.mjs',
    'tasun-version.json',
    'TASUN_REBUILD',
    'TASUN_REBUILD_STAMP',
    '.github/workflows/release-version.yml',
    '汐東收發文明細表.html',
    '汐東收發文登錄表.html',
    '汐東文件統計表.html',
    '汐東文件管理表.html',
    'tasun-api/index.html'
  ]) copy(rel);

  const manifest=readJson('tasun-version.json',dir);
  for(const key of Object.keys(manifest.pages||{})){
    const entry=manifest.pages[key];
    if(entry&&typeof entry==='object'&&String(entry.file||'').startsWith(FORBIDDEN_PREFIX)) delete manifest.pages[key];
  }
  if(manifest.pageArtifactManifest) delete manifest.pageArtifactManifest['tasun-api/index.html'];
  if(manifest.pageBuildStamp&&typeof manifest.pageBuildStamp==='object') delete manifest.pageBuildStamp['tasun-api/index.html'];
  fs.writeFileSync(path.join(dir,'tasun-version.json'),JSON.stringify(manifest,null,2)+'\n');

  const r=spawnSync(process.execPath,['publish-version_tasun_project_autoscan.mjs'],{
    cwd:dir,
    encoding:'utf8',
    env:{...process.env,TASUN_CHANGED_FILES:'tasun-api/index.html',TASUN_BEFORE_SHA:'',TASUN_HEAD_SHA:''}
  });
  assert.equal(r.status,0,r.stdout+'\n'+r.stderr);

  const after=readJson('tasun-version.json',dir);
  assert.deepEqual(forbiddenAuthorities(after),[],'publisher must not restore tasun-api page authority');
  assert.equal(Object.hasOwn(after.pageArtifactManifest||{},'tasun-api/index.html'),false,'publisher must not add tasun-api artifact manifest');
  assert.equal(Object.hasOwn(after.pageBuildStamp||{},'tasun-api/index.html'),false,'publisher must not add tasun-api page build stamp');

  for(const file of ['汐東收發文明細表.html','汐東收發文登錄表.html','汐東文件統計表.html','汐東文件管理表.html']){
    assert.ok(after.pages?.[file],file+' formal authority must remain');
  }
});

test('Issue #76 active Pages packaging excludes tasun-api source directory',()=>{
  const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/release-version.yml'),'utf8');
  assert.match(workflow,/--exclude\s+["']tasun-api\/["']/,'active Pages packaging must continue excluding tasun-api/');
});
