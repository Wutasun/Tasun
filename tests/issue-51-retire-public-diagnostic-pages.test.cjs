'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));

test('Issue #51 retires the R880 public diagnostic page',()=>{
  assert.equal(exists('汐東收發文明細表_雲端逐步測試_正式版.html'),false,'R880 public diagnostic page must be retired');
});

test('Issue #51 retires the R442 public diagnostic page',()=>{
  assert.equal(exists('捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html'),false,'R442 public diagnostic page must be retired');
});

test('Issue #51 preserves formal release authority',()=>{
  for(const rel of [
    '汐東收發文明細表.html',
    '汐東收發文登錄表.html',
    '汐東文件統計表.html',
    '汐東文件管理表.html',
    'tasun-version.json',
    'TASUN_REBUILD',
    'TASUN_REBUILD_STAMP',
    'publish-version_tasun_project_autoscan.mjs',
    '.github/workflows/release-version.yml'
  ]){
    assert.equal(exists(rel),true,rel+' must remain present');
  }
});
