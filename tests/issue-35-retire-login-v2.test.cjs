'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const LEGACY='tasun-login-v2.js';
const CORE='tasun-auth-v4.js';

test('Issue #35 retires dormant tasun-login-v2.js',()=>{
  assert.equal(exists(LEGACY),false,`${LEGACY} must be retired`);
});

test('Issue #35 keeps canonical TasunAuthV4 contract intact',()=>{
  assert.equal(exists(CORE),true);
  const text=read(CORE);
  assert.ok(text.includes('login:login'));
  assert.ok(text.includes('getCurrent:getCurrent'));
  assert.ok(text.includes('getToken:getToken'));
  assert.ok(text.includes('global.TasunAuthV4'));
});

test('Issue #35 has no active runtime dependency on retired login-v2 authority',()=>{
  const skipPrefixes=['docs'+path.sep,'tests'+path.sep,'.git'+path.sep];
  const stack=[ROOT];
  const forbidden=['tasun-login-v2.js','tasunAuthSession_v2','tasunAuth.login','__TASUN_AUTH_FETCH__'];
  while(stack.length){
    const dir=stack.pop();
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const abs=path.join(dir,ent.name);
      const rel=path.relative(ROOT,abs);
      if(skipPrefixes.some(p=>rel===p.slice(0,-1)||rel.startsWith(p))) continue;
      if(ent.isDirectory()){ stack.push(abs); continue; }
      if(!/\.(?:html?|js|mjs|cjs|json)$/i.test(ent.name)) continue;
      if(rel===LEGACY) continue;
      const text=fs.readFileSync(abs,'utf8');
      for(const token of forbidden){
        assert.ok(!text.includes(token),`${rel} must not reference ${token}`);
      }
    }
  }
});
