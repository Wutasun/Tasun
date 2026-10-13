'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const ACTIVE_EXT=new Set(['.html','.htm','.js','.mjs','.cjs','.json','.yaml','.yml','.toml','.sql']);
const EXCLUDED_DIRS=new Set(['.git','node_modules','docs','tests']);
const SNAPSHOT='ISSUE41_RELEASE_INFO.txt';

function walk(dir=ROOT,rel=''){
  const out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.isDirectory()&&EXCLUDED_DIRS.has(ent.name)) continue;
    const abs=path.join(dir,ent.name);
    const next=rel?path.join(rel,ent.name):ent.name;
    if(ent.isDirectory()) out.push(...walk(abs,next));
    else if(ACTIVE_EXT.has(path.extname(ent.name).toLowerCase())) out.push(next);
  }
  return out;
}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}
function executableContent(text){
  return String(text)
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/\/\*[\s\S]*?\*\//g,'')
    .split(/\r?\n/)
    .filter(line=>!line.trimStart().startsWith('//'))
    .join('\n');
}

test('Issue #87 Contract A: stale Issue #41 release snapshot is absent',()=>{
  assert.equal(
    fs.existsSync(path.join(ROOT,SNAPSHOT)),
    false,
    SNAPSHOT+' must be retired'
  );
});

test('Issue #87 Contract B: current release authority remains present',()=>{
  for(const rel of [
    'tasun-version.json',
    'publish-version_tasun_project_autoscan.mjs',
    '.github/workflows/release-version.yml'
  ]){
    const abs=path.join(ROOT,rel);
    assert.equal(fs.existsSync(abs),true,rel+' must remain');
    assert.equal(fs.statSync(abs).isFile(),true,rel+' must remain a regular file');
  }

  const version=JSON.parse(read('tasun-version.json'));
  const build=String(version.version||version.build||'');
  const seq=Number(version.releaseSequence??version.release?.releaseSequence);
  assert.match(build,/r\d+_/i,'tasun-version.json must retain a formal release build identity');
  assert.equal(Number.isFinite(seq),true,'releaseSequence must remain numeric');
  assert.equal(seq>=1155,true,'releaseSequence must not regress below the approved R1155 implementation baseline');
});

test('Issue #87 Contract C: no live consumer of stale snapshot exists',()=>{
  const hits=[];
  const direct=new RegExp(SNAPSHOT.replace(/[.*+?^$()|[\]\\]/g,'\\$&'));
  const join=/path\.(?:join|resolve)\([^\n)]*ISSUE41_RELEASE_INFO\.txt[^\n)]*\)/;

  for(const rel of walk()){
    const text=executableContent(read(rel));
    if(direct.test(text)||join.test(text)) hits.push(rel);
  }
  assert.deepEqual(hits,[],'live source/config must not consume '+SNAPSHOT);

  assert.equal(fs.existsSync(path.join(ROOT,'publish-version_tasun_project_autoscan.mjs')),true);
  assert.equal(fs.existsSync(path.join(ROOT,'.github/workflows/release-version.yml')),true);
});
