'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const LEGACY=['tasun-guard.js','tasun-security.js','tasun-cloudwrap.js'];
const CURRENT=['tasun-auth-v4.js','tasun-cloudwrap-v4.js','tasun-guard-v5.js','tasun-boot.js','tasun-global-core.js'];

test('Issue #41 retires dormant legacy authority files',()=>{
  for(const rel of LEGACY){
    assert.equal(exists(rel),false,`${rel} must be retired`);
  }
});

test('Issue #41 preserves current v4/v5 authority files',()=>{
  for(const rel of CURRENT){
    assert.equal(exists(rel),true,`${rel} must remain present`);
  }
  const auth=read('tasun-auth-v4.js');
  assert.ok(auth.includes('global.TasunAuthV4'));
  const cloud=read('tasun-cloudwrap-v4.js');
  assert.ok(cloud.includes('global.TasunCloudWrapV4 = api'));
  assert.ok(cloud.includes('getPageResource'));
  const guard=read('tasun-guard-v5.js');
  assert.ok(guard.length>0);
  const boot=read('tasun-boot.js');
  assert.ok(boot.includes('TasunSelfHealV5'));
});

test('Issue #41 has no active dependency on retired legacy filenames',()=>{
  const skipPrefixes=['docs'+path.sep,'tests'+path.sep,'.git'+path.sep];
  const stack=[ROOT];
  while(stack.length){
    const dir=stack.pop();
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const abs=path.join(dir,ent.name);
      const rel=path.relative(ROOT,abs);
      if(skipPrefixes.some(p=>rel===p.slice(0,-1)||rel.startsWith(p))) continue;
      if(ent.isDirectory()){ stack.push(abs); continue; }
      if(!/\.(?:html?|js|mjs|cjs|json|ya?ml)$/i.test(ent.name)) continue;
      if(LEGACY.includes(rel)) continue;
      const text=fs.readFileSync(abs,'utf8');
      for(const token of LEGACY){
        assert.ok(!text.includes(token),`${rel} must not depend on ${token}`);
      }
    }
  }
});

test('Issue #41 does not reintroduce legacy security/session authorities',()=>{
  const skipPrefixes=['docs'+path.sep,'tests'+path.sep,'.git'+path.sep];
  const stack=[ROOT];
  const forbidden=['tasunSessionAuth_v1','window.TasunSecurity','window.tasunLogin'];
  while(stack.length){
    const dir=stack.pop();
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const abs=path.join(dir,ent.name);
      const rel=path.relative(ROOT,abs);
      if(skipPrefixes.some(p=>rel===p.slice(0,-1)||rel.startsWith(p))) continue;
      if(ent.isDirectory()){ stack.push(abs); continue; }
      if(!/\.(?:html?|js|mjs|cjs)$/i.test(ent.name)) continue;
      if(LEGACY.includes(rel)) continue;
      const text=fs.readFileSync(abs,'utf8');
      for(const token of forbidden){
        assert.ok(!text.includes(token),`${rel} must not introduce ${token}`);
      }
    }
  }
});
