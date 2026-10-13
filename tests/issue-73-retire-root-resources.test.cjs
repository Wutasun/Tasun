'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');

test('Issue #73 retires orphan legacy root resources.json while preserving tasun-resources.json',()=>{
  assert.equal(
    fs.existsSync(path.join(ROOT,'resources.json')),
    false,
    'legacy root resources.json must be retired'
  );
  assert.equal(
    fs.existsSync(path.join(ROOT,'tasun-resources.json')),
    true,
    'supported tasun-resources.json must remain'
  );
});
