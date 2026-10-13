'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const TARGET='schema_v3.sql';
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

test('Issue #96 Contract A: stale root schema_v3.sql is absent',()=>{
  assert.equal(fs.existsSync(path.join(ROOT,TARGET)),false,TARGET+' must be retired');
});

test('Issue #96 Contract B: current schema and migration authorities remain present',()=>{
  for(const rel of [
    'tasun-api/schema_v4.sql',
    'tasun-api/schema.sql',
    'tasun-api/migrations/0001_init.sql',
    'tasun-api/worker.js'
  ]){
    const abs=path.join(ROOT,rel);
    assert.equal(fs.existsSync(abs),true,rel+' must remain');
    assert.equal(fs.statSync(abs).isFile(),true,rel+' must remain a regular file');
  }
  assert.match(read('tasun-api/schema_v4.sql'),/Stable v4 schema/i,'schema_v4.sql must remain the v4 D1 authority');

  const checks=read('.github/workflows/tasun-pr-checks.yml');
  assert.match(checks,/Run release and runtime regression tests/);
  assert.match(checks,/Generate disposable exact release and verify without publishing/);
});

test('Issue #96 Contract C: no live consumer of root schema_v3.sql exists',()=>{
  const hits=[];
  const direct=/(^|[^A-Za-z0-9_])schema_v3\.sql([^A-Za-z0-9_]|$)/;
  const rootPath=/(?:^|[\/"'])schema_v3\.sql(?:$|[\/"'])/;
  const join=/path\.(?:join|resolve)\([^\n)]*schema_v3\.sql[^\n)]*\)/;

  for(const rel of walk()){
    if(rel===TARGET) continue;
    const text=executableContent(read(rel));
    if(direct.test(text)||rootPath.test(text)||join.test(text)) hits.push(rel);
  }
  assert.deepEqual(hits,[],'live source/config must not consume root '+TARGET);

  for(const rel of [
    'tasun-api/schema_v4.sql',
    'tasun-api/schema.sql',
    'tasun-api/migrations/0001_init.sql',
    'tasun-api/worker.js'
  ]){
    assert.equal(fs.existsSync(path.join(ROOT,rel)),true,rel+' must remain authoritative/present');
  }
});
