'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, '捷運汐止東湖線-施工查驗管控表.html'), 'utf8');
const expected = [
  '項次', '查驗類別', '抽查申請單申請日期', '抽查申請單編號', '抽查項目', '抽查系統',
  '抽查紀錄表編號', '自主檢查表編號(統包)', '檢查位置', '檢查日期', '檢查結果',
  '缺失改善通知書', '承辦人', '附件', '紙本存放位置'
];

function appSource() {
  const match = html.match(/<script\s+id="tasun-inspection-control-r560-app">([\s\S]*?)<\/script>/i);
  assert.ok(match, 'inspection control app script is present');
  return match[1];
}

test('R574 keeps the table, form, exports, and imports on the requested field order', () => {
  const fields = html.match(/var FIELDS = (\[[^\n]+\]);/);
  assert.ok(fields);
  assert.deepEqual(JSON.parse(fields[1]), expected);
  assert.match(html, /<th>抽查申請單申請日期<\/th><th>抽查申請單編號<\/th><th>抽查項目<\/th><th>抽查系統<\/th><th>抽查紀錄表編號<\/th><th>自主檢查表編號<br>\(統包\)<\/th>/);
  assert.match(appSource(), /var FORM_FIELDS_ORDER_R572 = FIELD_ORDER_R571\.filter\(function\(f\)\{ return f !== "項次"; \}\);/);
  assert.match(appSource(), /FIELDS\.forEach\(function\(f,idx\)\{[\s\S]{0,180}positionalFields\.indexOf\(f\)/);
  assert.match(html, /自主檢查表編號\(統包\)/);
});

test('R574 dropdown suggestions remain editable and copyable text inputs', () => {
  const source = appSource();
  assert.match(source, /type="text" list="'\+esc\(id\)\+'-options"/);
  assert.match(source, /<datalist id="'\+esc\(id\)\+'-options"><\/datalist>/);
  assert.match(source, /可直接輸入、編輯及複製文字/);
  assert.match(source, /input\.setAttribute\("data-options-source","active-table-rows-unique-plus-added-r574"\)/);
  assert.match(source, /input\.value=cur/);
  assert.match(source, /inspectionControlR574EditableCopyableDropdownInputs/);
  assert.doesNotMatch(source, /var sel=formFieldElR570\(field\);[\s\S]{0,180}sel\.innerHTML=opts/);
});

test('R574 keeps R571 headerless Excel files mapped to their original field names', () => {
  const source = appSource();
  assert.match(source, /var LEGACY_FIELDS_ORDER_R571 = \[/);
  assert.match(source, /cells\.length===LEGACY_FIELDS_ORDER_R571\.length \? LEGACY_FIELDS_ORDER_R571 : FIELDS/);
  assert.match(source, /arr\.length===LEGACY_FIELDS_ORDER_R571\.length \? LEGACY_FIELDS_ORDER_R571 : FIELDS/);
  assert.match(source, /positionalFields\.indexOf\(f\)/);
});

test('R574 preserves additive row data without changing resource or IndexedDB identity', () => {
  const source = appSource();
  assert.match(html, /data-resource-key="sxdh-inspection-control"/);
  assert.match(html, /data-db-name="tasun_sxdh_inspection_control_idb_v1"/);
  assert.match(source, /function normRow\(x\)\{[\s\S]{0,560}var r=Object\.assign\(\{\}, x\);[\s\S]{0,700}FIELDS\.forEach\(function\(f\)\{ if\(r\[f\] === undefined \|\| r\[f\] === null\) r\[f\] = ""; \}\)/);
  assert.match(source, /function formData\(\)\{[\s\S]{0,260}r\[f\]=el\?cjk\(el\.value\):""/);
});

test('R574 embedded application script parses', () => {
  assert.doesNotThrow(() => new Function(appSource()));
});
