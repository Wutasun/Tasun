const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const retiredFile='tasun-next-fix.js';
const retiredGlobal='__TASUN_NEXT_FIX__';
const loaderFiles=['index.html','inline.js','tasun-api/index.html'];
const supportedLoaderCalls=[
  "loadOnce('tasun-cloudwrap-v4', window.__withV('tasun-cloudwrap-v4.js'))",
  "loadOnce('tasun-auth-v4', window.__withV('tasun-auth-v4.js'))",
  "loadOnce('tasun-guard-v5', window.__withV('tasun-guard-v5.js'))"
];

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
function isLiveRuntimeSource(p){
  const r=rel(p);
  if(r.startsWith('docs/')) return false;
  if(r.startsWith('tests/')) return false;
  if(/\.(txt|md)$/i.test(r)) return false;
  return /\.(html?|js|mjs|cjs|json|ya?ml|toml)$/i.test(r);
}

test('Issue #70 retired next-fix file is absent',()=>{
  assert.equal(fs.existsSync(path.join(ROOT,retiredFile)),false,retiredFile+' must be absent');
});

test('Issue #70 live runtime sources contain no retired file/global references',()=>{
  const needles=[retiredFile,retiredGlobal];
  const hits=[];
  for(const p of walk(ROOT).filter(isLiveRuntimeSource)){
    const text=fs.readFileSync(p,'utf8');
    for(const needle of needles){
      if(text.includes(needle)) hits.push(rel(p)+': '+needle);
    }
  }
  assert.deepEqual(hits,[],'retired next-fix authority remains: '+JSON.stringify(hits));
});

test('Issue #70 supported bootstrap loader chain remains present and ordered',()=>{
  for(const file of loaderFiles){
    const text=fs.readFileSync(path.join(ROOT,file),'utf8');
    const positions=supportedLoaderCalls.map(call=>text.indexOf(call));
    for(let i=0;i<supportedLoaderCalls.length;i++){
      assert.notEqual(positions[i],-1,file+' must retain executable '+supportedLoaderCalls[i]);
    }
    assert.ok(positions[0] < positions[1] && positions[1] < positions[2],
      file+' must preserve cloudwrap -> auth -> guard order');
  }
});
