'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const ACTIVE_EXT=new Set(['.html','.htm','.js','.mjs','.cjs','.json','.yaml','.yml','.toml']);
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

test('Issue #84 Contract A: orphan root workflows file is absent',()=>{
  assert.equal(
    fs.existsSync(path.join(ROOT,'workflows')),
    false,
    'orphan root workflows file must be retired'
  );
});

test('Issue #84 Contract B: canonical GitHub Actions workflow authority remains present',()=>{
  for(const rel of [
    '.github/workflows/release-version.yml',
    '.github/workflows/r1144-tests.yml',
    '.github/workflows/tasun-pr-checks.yml'
  ]){
    const abs=path.join(ROOT,rel);
    assert.equal(fs.existsSync(abs),true,rel+' must remain');
    assert.equal(fs.statSync(abs).isFile(),true,rel+' must remain a regular file');
  }
  if(fs.existsSync(path.join(ROOT,'workflows'))){
    assert.equal(fs.statSync(path.join(ROOT,'workflows')).isDirectory(),false,'root workflows must not become a directory authority');
  }
});

test('Issue #84 Contract C: no live root-workflows authority consumer exists',()=>{
  const hits=[];
  const patterns=[
    /(?:^|[^A-Za-z0-9_.-])\.\/workflows(?:$|[^A-Za-z0-9_.-])/m,
    /path\.(?:join|resolve)\(\s*ROOT\s*,\s*['"]workflows['"]\s*\)/,
    /(?:^|[^A-Za-z0-9_.-])\/workflows(?:$|[^A-Za-z0-9_.-])/m
  ];
  for(const rel of walk()){
    const text=executableContent(read(rel));
    if(patterns.some(rx=>rx.test(text))) hits.push(rel);
  }
  assert.deepEqual(hits,[],'live source/config must not treat root workflows as authority');

  const publisher=read('publish-version_tasun_project_autoscan.mjs');
  assert.match(
    publisher,
    /\.github\/workflows\/release-version\.yml/,
    'publisher must retain canonical release workflow path'
  );
});
