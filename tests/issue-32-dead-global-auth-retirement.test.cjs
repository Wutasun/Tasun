'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const API='tasun-api/index.html';
const LEGACY='tasun-global-auth.js';
const CORE='tasun-auth-v4.js';

test('Issue #32 removes dead legacy/global token fallback from tasun-api',()=>{
  assert.equal(exists(API),true);
  const text=read(API);
  assert.ok(!text.includes('window.TasunGlobalAuth'),'tasun-api/index.html must not probe window.TasunGlobalAuth');
  assert.ok(!text.includes('window.tasunGlobalAuth'),'tasun-api/index.html must not probe window.tasunGlobalAuth');
  assert.ok(!text.includes('window.TASUN_AUTH'),'tasun-api/index.html must not probe window.TASUN_AUTH');
});

test('Issue #32 keeps canonical token and cookie fallbacks intact',()=>{
  const text=read(API);
  assert.ok(text.includes('TasunAuthV4.getToken'),'tasun-api/index.html must retain TasunAuthV4.getToken');
  for(const key of ['tasun_bearer_token','tasun_token','token','tasun_auth_token']){
    assert.ok(text.includes(key),`tasun-api/index.html must retain cookie fallback key ${key}`);
  }
});

test('Issue #32 retires dormant tasun-global-auth.js',()=>{
  assert.equal(exists(LEGACY),false,`${LEGACY} must be retired`);
});

test('Issue #32 keeps current auth core token contract intact',()=>{
  assert.equal(exists(CORE),true);
  const text=read(CORE);
  assert.ok(text.includes('getToken:getToken'));
  assert.ok(text.includes('mirrorToken'));
  assert.ok(text.includes('global.TasunAuthV4'));
});
