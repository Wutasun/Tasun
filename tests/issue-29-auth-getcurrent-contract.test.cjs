'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const CORE='tasun-auth-v4.js';
const PAGES=['tasun-api/index.html','名詞解釋.html'];

test('Issue #29 current auth core exports canonical getCurrent API',()=>{
  assert.equal(exists(CORE),true);
  const text=read(CORE);
  assert.ok(text.includes('getCurrent:getCurrent'));
  assert.ok(!text.includes('getCurrentUser:getCurrentUser'));
});

test('Issue #29 migrates stale TasunAuthV4 getCurrentUser callers',()=>{
  for(const rel of PAGES){
    assert.equal(exists(rel),true,`${rel} must exist`);
    const text=read(rel);
    assert.ok(text.includes('TasunAuthV4.getCurrent'),`${rel} must use TasunAuthV4.getCurrent`);
    assert.ok(!text.includes('TasunAuthV4.getCurrentUser'),`${rel} must not use TasunAuthV4.getCurrentUser`);
  }
});

test('Issue #29 preserves storage/session-first fallback contracts',()=>{
  const api=read('tasun-api/index.html');
  assert.ok(api.includes("tasunCurrentUser_v1"));
  assert.ok(api.includes("tasunSessionBridge_v1"));
  assert.ok(api.indexOf("tasunSessionBridge_v1") < api.indexOf("TasunAuthV4.getCurrent"));

  const glossary=read('名詞解釋.html');
  assert.ok(glossary.includes('AUTH_BRIDGE_KEYS'));
  assert.ok(glossary.includes('TasunGlobalCore.getCurrentUser'));
  assert.ok(glossary.indexOf('AUTH_BRIDGE_KEYS') < glossary.indexOf('TasunAuthV4.getCurrent'));
  assert.ok(glossary.indexOf('TasunAuthV4.getCurrent') < glossary.indexOf('TasunGlobalCore.getCurrentUser'));
});
