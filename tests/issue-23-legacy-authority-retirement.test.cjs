'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const LEGACY_PUBLISHER='publish-version_tasun_project.mjs';
const LEGACY_LOADER='tasun-version-loade.js';
const ACTIVE_PUBLISHER='publish-version_tasun_project_autoscan.mjs';
const ACTIVE_LOADER='tasun-version-loader.js';
const VERSION_FILE='tasun-version.json';
const WORKFLOW='.github/workflows/release-version.yml';

test('Issue #23 retires dormant executable legacy authorities',()=>{
  assert.equal(exists(LEGACY_PUBLISHER),false,`${LEGACY_PUBLISHER} must be retired`);
  assert.equal(exists(LEGACY_LOADER),false,`${LEGACY_LOADER} must be retired`);
});

test('Issue #23 keeps the active Exact Auto Release authority intact',()=>{
  assert.equal(exists(ACTIVE_PUBLISHER),true);
  const workflow=read(WORKFLOW);
  const publisher=read(ACTIVE_PUBLISHER);
  assert.ok(workflow.includes('node publish-version_tasun_project_autoscan.mjs'));
  assert.ok(workflow.includes('publish-version_tasun_project_autoscan.mjs --verify-only'));
  assert.ok(publisher.includes('const VERSION_FILE="tasun-version.json"'));
  assert.ok(publisher.includes('const WORKFLOW_FILE=".github/workflows/release-version.yml"'));
});

test('Issue #23 keeps the page-entry-only version loader authority intact',()=>{
  assert.equal(exists(ACTIVE_LOADER),true);
  const loader=read(ACTIVE_LOADER);
  assert.ok(loader.includes('var VERSION_JSON_URL = "tasun-version.json"'));
  assert.ok(loader.includes('page-entry-only authority'));
  assert.ok(loader.includes('window.__TASUN_VERSION_AUTHORITY_MODE__ = "page_entry_only_r456"'));
  assert.ok(loader.includes('pickPageEntry'));
});

test('Issue #23 keeps tasun-version.json as the sole formal version source',()=>{
  assert.equal(exists(VERSION_FILE),true);
  const version=JSON.parse(read(VERSION_FILE));
  assert.equal(version.officialVersionSource,VERSION_FILE);
  assert.equal(version.release?.script,ACTIVE_PUBLISHER);
  assert.equal(version.release?.workflow,WORKFLOW);
});

test('Issue #23 has no active workflow/runtime reference to retired filenames',()=>{
  const activeAuthorityPaths=[
    WORKFLOW,
    ACTIVE_PUBLISHER,
    ACTIVE_LOADER,
    'tasun-boot.js',
    'tasun-core.js',
    'tasun-global-core.js',
    'tasun-resources.json',
    'tests/release-contract.test.mjs'
  ];
  for(const rel of activeAuthorityPaths){
    if(!exists(rel)) continue;
    const text=read(rel);
    assert.ok(!text.includes(LEGACY_PUBLISHER),`${rel} must not reference ${LEGACY_PUBLISHER}`);
    assert.ok(!text.includes(LEGACY_LOADER),`${rel} must not reference ${LEGACY_LOADER}`);
  }
});
