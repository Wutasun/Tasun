'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const LEGACY='tasun-global-auth-v65.js';
const ACTIVE='tasun-auth-v4.js';

const PAGES=[
  '權限表.html',
  '工程資料查詢.html',
  '工程資料登錄.html',
  '工程資料明細表.html',
  '捷運汐止東湖線統包工程-資料明細表查詢.html',
  '捷運汐止東湖線統包工程-資料明細表登錄.html'
];

test('Issue #26 removes stale tasun-global-auth-v65 references from all approved pages',()=>{
  for(const rel of PAGES){
    assert.equal(exists(rel),true,`${rel} must exist`);
    const text=read(rel);
    assert.ok(!text.includes(LEGACY),`${rel} must not reference ${LEGACY}`);
  }
});

test('Issue #26 keeps tasun-auth-v4 on all approved pages',()=>{
  for(const rel of PAGES){
    const text=read(rel);
    assert.ok(text.includes(ACTIVE),`${rel} must retain ${ACTIVE}`);
  }
});

test('Issue #26 does not recreate the missing v65 auth asset',()=>{
  assert.equal(exists(LEGACY),false,`${LEGACY} must remain absent`);
});

test('Issue #26 keeps the current auth core contract intact',()=>{
  assert.equal(exists(ACTIVE),true);
  const auth=read(ACTIVE);
  assert.ok(auth.includes('global.TasunAuthV4'));
  assert.ok(auth.includes("var CURRENT_KEY='tasunCurrentUser_v1'"));
  assert.ok(auth.includes("var SESSION_KEY='tasunSession_v1'"));
  assert.ok(auth.includes("var SESSION_BRIDGE_KEY='tasunSessionBridge_v1'"));
  assert.ok(auth.includes('mirrorToken'));
  assert.ok(auth.includes('bridgeCurrentToChild'));
});

test('Issue #26 introduces no TasunGlobalAuthV65 consumer on approved pages',()=>{
  for(const rel of PAGES){
    assert.ok(!read(rel).includes('TasunGlobalAuthV65'),`${rel} must not consume TasunGlobalAuthV65`);
  }
});
