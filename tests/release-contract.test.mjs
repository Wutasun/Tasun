import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';

const script = path.resolve('publish-version_tasun_project_autoscan.mjs');
const files = ['汐東收發文明細表.html','汐東收發文登錄表.html','汐東文件統計表.html','汐東文件管理表.html'];
const workflowAliases=[['xidong-official-doc-detail','official-doc-detail','official_doc_detail'],['xidong-official-doc-register','official-doc-register','official_doc_register'],['xidong-official-doc-statistics','official-doc-statistics','official_doc_statistics'],['xidong-doc-manager','xidong_doc_manager']];
const build = '20261008_tasun_v5_xidong_docs_r1139_test_release';
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasun-release-test-'));
  t.after(() => fs.rmSync(dir, {recursive:true,force:true}));
  const write=(f,s)=>{fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.writeFileSync(path.join(dir,f),s);};
  write('.github/workflows/release-version.yml','name: test\n');
  write('publish-version_tasun_project_autoscan.mjs', fs.readFileSync(script));
  const v={version:build,cacheV:build,buildStamp:build,rebuildStamp:build,releaseSequence:1139,release:{releaseSequence:1139},pages:{},pageArtifactManifest:{},pageBuildStamp:{}};
  files.forEach((f,i)=>{
    const s=`<!DOCTYPE html><html><head><meta name="tasun-build-stamp" content="${build}" /><meta name="tasun-rebuild-stamp" content="${build}" /></head><body><script>const C={"PAGE_FILE":"${f}","PAGE_KEY":"page${i}","PAGE_ALIASES":["alias${i}"]};</script></body></html>`;
    write(f,s);
    const entry={file:f,version:build,cacheV:build,buildStamp:build,pageBuildStamp:build,rebuildStamp:build,releaseSequence:1139,sha256:sha(s),artifactSha256:sha(s),pageArtifactSha256:sha(s),htmlSha256:sha(s),digest:sha(s),bytes:Buffer.byteLength(s)};
    for(const k of [f,`page${i}`,`alias${i}`,...workflowAliases[i]])v.pages[k]={...entry};
    v.pageArtifactManifest[f]={...entry,keepBusinessMetadata:true};v.pageBuildStamp[f]=build;
  });
  write('tasun-version.json', JSON.stringify(v));
  write('TASUN_REBUILD',`version=${build}\nreleaseSequence=1139\n`);write('TASUN_REBUILD_STAMP',build+'\n');
  const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'}).toString().trim();
  git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('add','.');git('commit','-qm','base');
  const run=(args=[],changed='README.md')=>spawnSync(process.execPath,[script,...args],{cwd:dir,encoding:'utf8',env:{...process.env,TASUN_CHANGED_FILES:changed,TASUN_BEFORE_SHA:'',TASUN_HEAD_SHA:''}});
  return {dir,write,git,run,read:()=>JSON.parse(fs.readFileSync(path.join(dir,'tasun-version.json')))};
}
function assertRelease(f) {
  const v=f.read(),rank=Number(v.version.match(/r(\d+)/)[1]);
  assert.equal(v.releaseSequence,rank);assert.equal(v.release.releaseSequence,rank);
  for(const [i,file] of files.entries()) {
    const s=fs.readFileSync(path.join(f.dir,file)); const digest=sha(s);
    assert.ok(s.toString().includes(`content="${v.version}"`));
    for(const key of [file,`page${i}`,`alias${i}`]) {
      const e=v.pages[key];for(const k of ['version','cacheV','buildStamp','pageBuildStamp','rebuildStamp'])assert.equal(e[k],v.version,key+':'+k);
      for(const k of ['sha256','artifactSha256','pageArtifactSha256','htmlSha256','digest'])assert.equal(e[k],digest,key+':'+k);
      assert.equal(e.releaseSequence,rank);assert.equal(e.bytes,s.length);
    }
    assert.equal(v.pageArtifactManifest[file].sha256,digest);assert.equal(v.pageArtifactManifest[file].keepBusinessMetadata,true);
    assert.equal(v.pageBuildStamp[file],v.version);
  }
  assert.equal(fs.readFileSync(path.join(f.dir,'TASUN_REBUILD_STAMP'),'utf8').trim(),v.version);
  assert.match(fs.readFileSync(path.join(f.dir,'TASUN_REBUILD'),'utf8'),new RegExp(`releaseSequence=${rank}`));
}

test('verify-only rejects stale sequence without changing any tracked bytes',t=>{
  const f=fixture(t),v=f.read();v.releaseSequence=1122;f.write('tasun-version.json',JSON.stringify(v));
  const before=f.git('diff');const r=f.run(['--verify-only']);
  assert.notEqual(r.status,0,r.stdout);assert.equal(f.git('diff'),before);
});
test('verify-only rejects stale secondary digest even when primary digest matches',t=>{
  const f=fixture(t),v=f.read();v.pages.alias0.htmlSha256='stale';f.write('tasun-version.json',JSON.stringify(v));
  assert.notEqual(f.run(['--verify-only']).status,0);
});
test('verify-only valid artifacts are read-only even when a page is selected',t=>{
  const f=fixture(t),before=f.git('status','--porcelain');const r=f.run(['--verify-only'],files[0]);
  assert.equal(r.status,0,r.stderr);assert.equal(f.git('status','--porcelain'),before);
});
test('Chinese Git paths trigger a coherent four-page release',t=>{
  const f=fixture(t);fs.appendFileSync(path.join(f.dir,files[0]),'<!-- business change -->');f.git('add','.');f.git('commit','-qm','change');
  const r=f.run([], '');assert.equal(r.status,0,r.stderr);assert.notEqual(f.read().version,build,r.stdout);assertRelease(f);
  const before=f.git('diff');const verified=f.run(['--verify-only'],'');assert.equal(verified.status,0,verified.stderr);assert.equal(f.git('diff'),before);
});
test('legacy quoted changed-file input is decoded, not skipped',t=>{
  const f=fixture(t);fs.appendFileSync(path.join(f.dir,files[0]),'<!-- change -->');f.git('add','.');f.git('commit','-qm','change');
  const quoted=f.git('diff','--name-only','HEAD^','HEAD');assert.ok(quoted.startsWith('"'));
  const r=f.run([],quoted);assert.equal(r.status,0,r.stderr);assert.notEqual(f.read().version,build,r.stdout);assertRelease(f);
});
test('core-only release refreshes all four document aliases and manifests',t=>{
  const f=fixture(t),r=f.run([],'.github/workflows/release-version.yml');assert.equal(r.status,0,r.stderr);assertRelease(f);
});
test('manifest-only repair keeps the declared build and repairs metadata',t=>{
  const f=fixture(t),v=f.read();v.releaseSequence=1122;v.release.releaseSequence=1066;v.pages.alias0.htmlSha256='stale';f.write('tasun-version.json',JSON.stringify(v));
  const r=f.run([],'tasun-version.json');assert.equal(r.status,0,r.stderr);assert.equal(f.read().version,build);assertRelease(f);
});
test('invalid manifest fails instead of discarding existing metadata',t=>{
  const f=fixture(t);f.write('tasun-version.json','{invalid');const r=f.run([],files[0]);assert.notEqual(r.status,0);assert.equal(fs.readFileSync(path.join(f.dir,'tasun-version.json'),'utf8'),'{invalid');
});
test('missing required workflow aliases fail verification and are restored by generation',t=>{
 const f=fixture(t);const v=f.read();delete v.pages.official_doc_detail;delete v.pages['xidong-doc-manager'];delete v.pages.xidong_doc_manager;f.write('tasun-version.json',JSON.stringify(v));
 assert.notEqual(f.run(['--verify-only']).status,0,'missing mandatory aliases must fail');
 const r=f.run([],'tasun-version.json');assert.equal(r.status,0,r.stderr);
 for(const alias of ['official_doc_detail','xidong-doc-manager','xidong_doc_manager'])assert.ok(f.read().pages[alias],alias);
});
test('a single manually advanced page releases the entire group at that manual build',t=>{
 const f=fixture(t),next=build.replace('r1139','r1140');
 f.write(files[0],fs.readFileSync(path.join(f.dir,files[0]),'utf8').replaceAll(build,next));f.git('add','.');f.git('commit','-qm','manual version');
 const r=f.run([],files[0]);assert.equal(r.status,0,r.stderr);assert.equal(f.read().version,next);assertRelease(f);
});
test('conflicting manually advanced builds fail without overwriting files',t=>{
 const f=fixture(t);files.slice(0,2).forEach((file,i)=>f.write(file,fs.readFileSync(path.join(f.dir,file),'utf8').replaceAll(build,build.replace('r1139',`r${1140+i}`))));f.git('add','.');f.git('commit','-qm','conflicting manual versions');
 const before=f.git('status','--porcelain'),r=f.run([],files.slice(0,2).join('\n'));assert.notEqual(r.status,0);assert.equal(f.git('status','--porcelain'),before);
});
test('artifact manifest size is verified as well as alias size',t=>{
 const f=fixture(t),v=f.read();v.pageArtifactManifest[files[0]].sizeBytes=1;f.write('tasun-version.json',JSON.stringify(v));assert.notEqual(f.run(['--verify-only']).status,0);
});
for (const missing of [false,true]) test(`same primary build repairs ${missing?'missing':'stale'} secondary marker`,t=>{
 const f=fixture(t),file=files[0],original=fs.readFileSync(path.join(f.dir,file),'utf8');
 f.write(file,original.replace(/<meta name="tasun-rebuild-stamp"[^>]*>/,missing?'':'<meta name="tasun-rebuild-stamp" content="stale" />'));
 const r=f.run([],'tasun-version.json');assert.equal(r.status,0,r.stderr);
 assert.ok(fs.readFileSync(path.join(f.dir,file),'utf8').includes(`<meta name="tasun-rebuild-stamp" content="${build}" />`));assertRelease(f);
});
test('verify rejects contradictory embedded markers even with matching artifact digests',t=>{
 const f=fixture(t),file=files[0],s=fs.readFileSync(path.join(f.dir,file),'utf8').replace(/<meta name="tasun-rebuild-stamp"[^>]*>/,'<meta name="tasun-rebuild-stamp" content="stale" />');f.write(file,s);
 const v=f.read();for(const e of [...Object.values(v.pages).filter(e=>e.file===file),v.pageArtifactManifest[file]]){for(const k of ['sha256','artifactSha256','pageArtifactSha256','htmlSha256','digest'])e[k]=sha(s);e.bytes=Buffer.byteLength(s);}f.write('tasun-version.json',JSON.stringify(v));
 assert.notEqual(f.run(['--verify-only']).status,0);
});

test('normalization preserves embedded marker parser and repairs actual stamp comments',t=>{
 const f=fixture(t),file=files[0],parser=String.raw`<script>const marker=/TASUN_REBUILD_STAMP:([^\s<]+)/;</script>`;
 fs.appendFileSync(path.join(f.dir,file),parser+'<!-- TASUN_REBUILD_STAMP:stale -->');
 const r=f.run([],'tasun-version.json');assert.equal(r.status,0,r.stderr);
 const s=fs.readFileSync(path.join(f.dir,file),'utf8');assert.ok(s.includes(parser));assert.ok(s.includes('<!-- TASUN_REBUILD_STAMP:'+build+' -->'));
});
