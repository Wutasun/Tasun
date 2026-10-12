const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const retired='tasun-store-dropbox.js';
const supported=['tasun-cloud-kit.js','tasun-cloudwrap-v4.js','tasun-api/worker.js','權限表.html','捷運汐東線事項記錄.html'];

function walk(dir){
  const out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules'].includes(ent.name)) continue;
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
function rel(p){return path.relative(ROOT,p).replaceAll('\\','/');}
function isLive(p){
  const r=rel(p);
  if(r.startsWith('docs/')) return false;
  if(r.startsWith('tests/')) return false;
  if(/\.(txt|md)$/i.test(r)) return false;
  return /\.(html?|js|mjs|cjs|json|ya?ml|toml)$/i.test(r);
}

test('Issue #67 legacy Dropbox store file is retired',()=>{
  assert.equal(fs.existsSync(path.join(ROOT,retired)),false,retired+' must be absent');
});

test('Issue #67 live runtime sources do not retain TasunDropboxStore authority',()=>{
  const needles=['tasun-store-dropbox.js','TasunDropboxStore'];
  const hits=[];
  for(const p of walk(ROOT).filter(isLive)){
    const text=fs.readFileSync(p,'utf8');
    for(const n of needles) if(text.includes(n)) hits.push(rel(p)+': '+n);
  }
  assert.deepEqual(hits,[],'live Dropbox store authority remains: '+JSON.stringify(hits));
});

test('Issue #67 current supported cloud authority remains present',()=>{
  for(const f of supported) assert.equal(fs.existsSync(path.join(ROOT,f)),true,f+' must remain present');
});
