'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const REPORT='汐東收發文三頁_R888_修復驗證報告.txt';
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

test('Issue #93 Contract A: stale R888 repair verification report is absent',()=>{
  assert.equal(fs.existsSync(path.join(ROOT,REPORT)),false,REPORT+' must be retired');
});

test('Issue #93 Contract B: current release and test authorities remain present',()=>{
  for(const rel of [
    'tasun-version.json',
    'publish-version_tasun_project_autoscan.mjs',
    '.github/workflows/release-version.yml',
    '.github/workflows/tasun-pr-checks.yml',
    'docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md'
  ]){
    const abs=path.join(ROOT,rel);
    assert.equal(fs.existsSync(abs),true,rel+' must remain');
    assert.equal(fs.statSync(abs).isFile(),true,rel+' must remain a regular file');
  }
  const version=JSON.parse(read('tasun-version.json'));
  const build=String(version.version||version.build||'');
  const seq=Number(version.releaseSequence??version.release?.releaseSequence);
  assert.match(build,/r\d+_/i,'formal release build identity must remain valid');
  assert.equal(Number.isFinite(seq),true,'releaseSequence must remain numeric');
  assert.equal(seq>=1155,true,'releaseSequence must not regress below R1155 implementation baseline');

  const checks=read('.github/workflows/tasun-pr-checks.yml');
  assert.match(checks,/Run release and runtime regression tests/);
  assert.match(checks,/Generate disposable exact release and verify without publishing/);
});

test('Issue #93 Contract C: no live consumer of stale R888 report exists',()=>{
  const hits=[];
  const direct=/汐東收發文三頁_R888_修復驗證報告\.txt/;
  const join=/path\.(?:join|resolve)\([^\n)]*汐東收發文三頁_R888_修復驗證報告\.txt[^\n)]*\)/;
  for(const rel of walk()){
    const text=executableContent(read(rel));
    if(direct.test(text)||join.test(text)) hits.push(rel);
  }
  assert.deepEqual(hits,[],'live source/config must not consume '+REPORT);

  for(const rel of [
    '汐東收發文明細表.html',
    '汐東收發文登錄表.html',
    '汐東文件統計表.html',
    '汐東文件管理表.html'
  ]){
    assert.equal(fs.existsSync(path.join(ROOT,rel)),true,rel+' formal page must remain');
  }
});
