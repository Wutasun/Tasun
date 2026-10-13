'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'..');

function readJson(rel,root=ROOT){
  return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
}
function isForbiddenPath(value){
  return String(value||'').replace(/\\/g,'/').split('/').includes('tasun-api');
}
function forbiddenAuthorities(manifest){
  return Object.entries(manifest.pages||{})
    .filter(([,entry])=>entry&&typeof entry==='object'&&isForbiddenPath(entry.file))
    .map(([key,entry])=>({key,file:String(entry.file||'')}));
}
function copyFixture(dir,rel,target=rel){
  const dest=path.join(dir,target);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(path.join(ROOT,rel),dest);
}
function cleanForbiddenMetadata(manifest){
  for(const key of Object.keys(manifest.pages||{})){
    const entry=manifest.pages[key];
    if(entry&&typeof entry==='object'&&isForbiddenPath(entry.file)) delete manifest.pages[key];
  }
  for(const key of Object.keys(manifest.pageArtifactManifest||{})){
    if(isForbiddenPath(key)) delete manifest.pageArtifactManifest[key];
  }
  for(const key of Object.keys(manifest.pageBuildStamp||{})){
    if(isForbiddenPath(key)) delete manifest.pageBuildStamp[key];
  }
}

test('Issue #76 current manifest contains no non-deployed tasun-api page authority',()=>{
  const manifest=readJson('tasun-version.json');
  assert.deepEqual(forbiddenAuthorities(manifest),[],'non-deployed Pages authorities remain');
  assert.deepEqual(
    Object.keys(manifest.pageArtifactManifest||{}).filter(isForbiddenPath),
    [],
    'non-deployed artifact authorities remain'
  );
  assert.deepEqual(
    Object.keys(manifest.pageBuildStamp||{}).filter(isForbiddenPath),
    [],
    'non-deployed page build authorities remain'
  );
});

for(const changedPath of ['tasun-api/index.html','nested/tasun-api/index.html']){
  test(`Issue #76 publisher cannot reintroduce excluded authority for ${changedPath}`,t=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tasun-issue76-'));
    t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));

    for(const rel of [
      'publish-version_tasun_project_autoscan.mjs',
      'tasun-version.json',
      'TASUN_REBUILD',
      'TASUN_REBUILD_STAMP',
      '.github/workflows/release-version.yml',
      '汐東收發文明細表.html',
      '汐東收發文登錄表.html',
      '汐東文件統計表.html',
      '汐東文件管理表.html'
    ]) copyFixture(dir,rel);
    copyFixture(dir,'tasun-api/index.html',changedPath);

    const manifest=readJson('tasun-version.json',dir);
    cleanForbiddenMetadata(manifest);
    fs.writeFileSync(path.join(dir,'tasun-version.json'),JSON.stringify(manifest,null,2)+'\n');

    const r=spawnSync(process.execPath,['publish-version_tasun_project_autoscan.mjs'],{
      cwd:dir,
      encoding:'utf8',
      env:{...process.env,TASUN_CHANGED_FILES:changedPath,TASUN_BEFORE_SHA:'',TASUN_HEAD_SHA:''}
    });
    assert.equal(r.status,0,r.stdout+'\n'+r.stderr);

    const after=readJson('tasun-version.json',dir);
    assert.deepEqual(forbiddenAuthorities(after),[],'publisher must not restore tasun-api page authority');
    assert.deepEqual(
      Object.keys(after.pageArtifactManifest||{}).filter(isForbiddenPath),
      [],
      'publisher must not restore tasun-api artifact authority'
    );
    assert.deepEqual(
      Object.keys(after.pageBuildStamp||{}).filter(isForbiddenPath),
      [],
      'publisher must not restore tasun-api page build authority'
    );

    for(const file of ['汐東收發文明細表.html','汐東收發文登錄表.html','汐東文件統計表.html','汐東文件管理表.html']){
      assert.ok(after.pages?.[file],file+' formal authority must remain');
    }
  });
}

test('Issue #76 active Pages packaging excludes tasun-api source directory',()=>{
  const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/release-version.yml'),'utf8');
  assert.match(workflow,/--exclude\s+["']tasun-api\/["']/,'active Pages packaging must continue excluding tasun-api/');
});
