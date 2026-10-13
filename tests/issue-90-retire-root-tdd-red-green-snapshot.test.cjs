'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const SNAPSHOT='TDD_RED_GREEN.txt';
const ACTIVE_EXT=new Set(['.html','.htm','.js','.mjs','.cjs','.json','.yaml','.yml','.toml','.sql']);
const EXCLUDED_DIRS=new Set(['.git','node_modules','docs','tests']);

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

test('Issue #90 Contract A: stale root TDD_RED_GREEN snapshot is absent',()=>{
  assert.equal(
    fs.existsSync(path.join(ROOT,SNAPSHOT)),
    false,
    SNAPSHOT+' must be retired'
  );
});

test('Issue #90 Contract B: current TDD and governance authorities remain present',()=>{
  for(const rel of [
    '.github/workflows/tasun-pr-checks.yml',
    'docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md'
  ]){
    const abs=path.join(ROOT,rel);
    assert.equal(fs.existsSync(abs),true,rel+' must remain');
    assert.equal(fs.statSync(abs).isFile(),true,rel+' must remain a regular file');
  }
  const tests=fs.readdirSync(path.join(ROOT,'tests')).filter(name=>/\.(?:cjs|mjs|js)$/.test(name));
  assert.equal(tests.length>0,true,'current regression tests must remain present');

  const prChecks=read('.github/workflows/tasun-pr-checks.yml');
  assert.match(prChecks,/Run release and runtime regression tests/,'PR checks must keep regression suite execution');
  assert.match(prChecks,/Generate disposable exact release and verify without publishing/,'PR checks must keep disposable exact-release verification');
});

test('Issue #90 Contract C: no live consumer of stale TDD snapshot exists',()=>{
  const hits=[];
  const direct=/TDD_RED_GREEN\.txt/;
  const join=/path\.(?:join|resolve)\([^\n)]*TDD_RED_GREEN\.txt[^\n)]*\)/;

  for(const rel of walk()){
    const text=executableContent(read(rel));
    if(direct.test(text)||join.test(text)) hits.push(rel);
  }
  assert.deepEqual(hits,[],'live source/config must not consume '+SNAPSHOT);

  for(const rel of [
    'tasun-version.json',
    'publish-version_tasun_project_autoscan.mjs',
    '.github/workflows/release-version.yml'
  ]){
    assert.equal(fs.existsSync(path.join(ROOT,rel)),true,rel+' release authority must remain');
  }
});
