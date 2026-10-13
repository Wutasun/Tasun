'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const ACTIVE_EXT=new Set(['.html','.htm','.js','.mjs','.cjs','.json','.yaml','.yml','.toml']);
const EXCLUDED_DIRS=new Set(['.git','node_modules','docs','tests']);
const STANDALONE_RESOURCES=/(^|[^A-Za-z0-9_-])resources\.json(?=$|[^A-Za-z0-9_.-])/;

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

test('Issue #73 Contract A: retired root resources.json is absent',()=>{
  assert.equal(fs.existsSync(path.join(ROOT,'resources.json')),false,'legacy root resources.json must be retired');
});

test('Issue #73 Contract B: live source has zero standalone resources.json consumers',()=>{
  const hits=[];
  for(const rel of walk()) if(STANDALONE_RESOURCES.test(executableContent(read(rel)))) hits.push(rel);
  assert.deepEqual(hits,[],'live source must not consume standalone root resources.json');
});

test('Issue #73 Contract C: tasun-resources.json remains the supported manifest authority',()=>{
  assert.equal(fs.existsSync(path.join(ROOT,'tasun-resources.json')),true,'supported tasun-resources.json must remain');
  for(const rel of ['tasun-cloud-kit.js','tasun-cloudwrap-v4.js','index.html','inline.js','tasun-api/index.html']){
    assert.match(read(rel),/tasun-resources\.json/,rel+' must continue consuming tasun-resources.json');
  }
  const publisher=read('publish-version_tasun_project_autoscan.mjs');
  assert.match(publisher,/CORE_FILES=new Set\([^\n]*tasun-resources\.json/,'publisher CORE_FILES must retain tasun-resources.json');
  assert.doesNotMatch(publisher,/CORE_FILES=new Set\([^\n]*(?<!tasun-)resources\.json/,'publisher CORE_FILES must not promote standalone root resources.json');
});
