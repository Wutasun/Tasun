'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const MUTATORS=['inject-index-login-v3.js','guard-all-html-security-v3.js'];
const V3_RUNTIME=['tasun-auth-v3.js','tasun-cloudwrap-v3.js','tasun-guard-v3.js'];
const CURRENT=['tasun-auth-v4.js','tasun-boot.js','tasun-guard-v5.js'];

test('Issue #38 retires dormant v3 repository mutators',()=>{
  for(const rel of MUTATORS){
    assert.equal(exists(rel),false,`${rel} must be retired`);
  }
});

test('Issue #38 keeps obsolete v3 runtime files absent',()=>{
  for(const rel of V3_RUNTIME){
    assert.equal(exists(rel),false,`${rel} must remain absent`);
  }
});

test('Issue #38 preserves current v4/v5 authority files',()=>{
  for(const rel of CURRENT){
    assert.equal(exists(rel),true,`${rel} must remain present`);
  }
  const auth=read('tasun-auth-v4.js');
  assert.ok(auth.includes('global.TasunAuthV4'));
  assert.ok(auth.includes('login:login'));
  assert.ok(auth.includes('getToken:getToken'));
  const boot=read('tasun-boot.js');
  assert.ok(boot.includes('TasunSelfHealV5'));
  const guard=read('tasun-guard-v5.js');
  assert.ok(guard.length>0);
});

test('Issue #38 has no active runtime/workflow dependency on retired mutators',()=>{
  const forbidden=['inject-index-login-v3.js','guard-all-html-security-v3.js'];
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
      if(MUTATORS.includes(rel)) continue;
      const text=fs.readFileSync(abs,'utf8');
      for(const token of forbidden){
        assert.ok(!text.includes(token),`${rel} must not depend on ${token}`);
      }
    }
  }
});
