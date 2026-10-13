const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const retired='resources.json';
const current='tasun-resources.json';
const supported=[
  'tasun-cloud-kit.js',
  'tasun-cloudwrap-v4.js',
  'index.html',
  'inline.js',
  'tasun-api/index.html'
];
const standaloneQuoted=/(['\"])resources\.json\1/;

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

test('Issue #73 legacy root resources manifest is retired',()=>{
  assert.equal(fs.existsSync(path.join(ROOT,retired)),false,retired+' must be absent');
});

test('Issue #73 live runtime sources contain no standalone root resources.json reference',()=>{
  const hits=[];
  for(const p of walk(ROOT).filter(isLive)){
    const text=fs.readFileSync(p,'utf8');
    if(standaloneQuoted.test(text)) hits.push(rel(p));
  }
  assert.deepEqual(hits,[],'standalone root resources.json references remain: '+JSON.stringify(hits));
});

test('Issue #73 supported tasun-resources authority remains present and consumed',()=>{
  assert.equal(fs.existsSync(path.join(ROOT,current)),true,current+' must remain present');
  for(const file of supported){
    const text=fs.readFileSync(path.join(ROOT,file),'utf8');
    assert.ok(text.includes(current),file+' must continue to reference '+current);
  }
  const publisher=fs.readFileSync(path.join(ROOT,'publish-version_tasun_project_autoscan.mjs'),'utf8');
  assert.ok(publisher.includes(current),'publisher must retain '+current+' as current authority');
  assert.equal(standaloneQuoted.test(publisher),false,'publisher must not promote standalone root resources.json');
});
