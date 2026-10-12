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

const RETIRED=['TASUN_REBUILD.txt','SHA256SUMS.txt'];
const CANONICAL=['tasun-version.json','TASUN_REBUILD','TASUN_REBUILD_STAMP'];
const ACTIVE_EXT=/\.(?:html?|js|mjs|cjs|json|ya?ml)$/i;

test('Issue #48 retires unmanaged generic release sidecars',()=>{
  for(const rel of RETIRED){
    assert.equal(exists(rel),false,rel+' must be retired');
  }
});

test('Issue #48 preserves canonical release authority files',()=>{
  for(const rel of CANONICAL){
    assert.equal(exists(rel),true,rel+' must remain present');
  }
  const publisher=read('publish-version_tasun_project_autoscan.mjs');
  assert.match(publisher,/const REBUILD_FILE="TASUN_REBUILD";/);
  assert.match(publisher,/const REBUILD_STAMP_FILE="TASUN_REBUILD_STAMP";/);
  assert.match(publisher,/const GENERATED=new Set\(\[VERSION_FILE,REBUILD_FILE,REBUILD_STAMP_FILE\]\)/);
  for(const rel of RETIRED){
    assert.ok(!publisher.includes(rel),'publisher must not adopt '+rel);
  }
});

test('Issue #48 keeps retired sidecars out of active release/runtime authority',()=>{
  const skipPrefixes=['docs'+path.sep,'tests'+path.sep,'.git'+path.sep];
  const stack=[ROOT];
  while(stack.length){
    const dir=stack.pop();
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const abs=path.join(dir,ent.name);
      const rel=path.relative(ROOT,abs);
      if(skipPrefixes.some(p=>rel===p.slice(0,-1)||rel.startsWith(p))) continue;
      if(ent.isDirectory()){ stack.push(abs); continue; }
      if(RETIRED.includes(rel)) continue;
      if(!ACTIVE_EXT.test(ent.name)) continue;
      const text=fs.readFileSync(abs,'utf8');
      for(const token of RETIRED){
        assert.ok(!text.includes(token),rel+' must not depend on '+token);
      }
    }
  }
});

test('Issue #48 exact release workflow still verifies only canonical release evidence',()=>{
  const workflow=read('.github/workflows/release-version.yml');
  assert.ok(workflow.includes('TASUN_REBUILD_STAMP'));
  assert.ok(workflow.includes('TASUN_REBUILD'));
  assert.ok(workflow.includes('tasun-version.json'));
  assert.ok(workflow.includes('GitHub Pages exact four-page release confirmed'));
  for(const rel of RETIRED){
    assert.ok(!workflow.includes(rel),'workflow must not make '+rel+' authoritative');
  }
});

test('Issue #48 cleanup-only deleted sidecars do not advance formal release identity',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tasun-issue48-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const mkdir=rel=>fs.mkdirSync(path.join(dir,rel),{recursive:true});
  const copy=rel=>{mkdir(path.dirname(rel));fs.copyFileSync(path.join(ROOT,rel),path.join(dir,rel));};
  copy('publish-version_tasun_project_autoscan.mjs');
  copy('tasun-version.json');
  copy('.github/workflows/release-version.yml');
  const before=fs.readFileSync(path.join(dir,'tasun-version.json'));
  const manifest=JSON.parse(before.toString('utf8'));
  const beforeBuild=manifest.version;
  const beforeSequence=manifest.releaseSequence;
  const r=spawnSync(process.execPath,['publish-version_tasun_project_autoscan.mjs'],{
    cwd:dir,
    encoding:'utf8',
    env:{...process.env,TASUN_CHANGED_FILES:'TASUN_REBUILD.txt\\nSHA256SUMS.txt'}
  });
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/no formal page\/core\/manifest change; nothing to sync\./);
  const after=fs.readFileSync(path.join(dir,'tasun-version.json'));
  assert.deepEqual(after,before,'cleanup-only sidecar deletion must not rewrite tasun-version.json');
  const afterManifest=JSON.parse(after.toString('utf8'));
  assert.equal(afterManifest.version,beforeBuild);
  assert.equal(afterManifest.releaseSequence,beforeSequence);
});
