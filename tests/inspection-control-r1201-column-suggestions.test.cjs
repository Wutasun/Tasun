'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', '捷運汐止東湖線-施工查驗管控表.html'), 'utf8');
const script = html.match(/<script\s+id="tasun-inspection-control-r560-app">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(script, 'inspection control app script exists');

test('R1201 keeps editable multiline 抽查項目 and provides unique suggestions from that column', () => {
  assert.match(script, /var FORM_COLUMN_SUGGESTION_FIELDS_R1201 = \["抽查項目"\]/);
  assert.match(script, /if\(FORM_COLUMN_SUGGESTION_FIELDS_R1201\.indexOf\(field\)>=0\) return uniqueTableColumnOptionsR575\(field,state\.rows\)/);
  assert.match(script, /<textarea id="'\+esc\(id\)\+'" aria-autocomplete="list" aria-controls="'\+esc\(id\)\+'-suggestions"/);
  assert.match(script, /id="'\+esc\(id\)\+'-suggestions" role="listbox"/);
  assert.match(script, /data-options-source="active-table-column-unique-r1201"/);
  assert.match(script, /document\.addEventListener\("input",function\(ev\)\{ if\(ev\.target && ev\.target\.id==="f抽查項目"\)/);
  assert.match(script, /data-column-suggestion/);
  assert.match(script, /可直接輸入、編輯及複製文字/);

  const helper = script.match(/function uniqueTableColumnOptionsR575\(field, rows\)\{[\s\S]*?\n    \}/)?.[0];
  assert.ok(helper, 'column-only distinct value helper exists');
  const options = new Function('cjk', `${helper}; return uniqueTableColumnOptionsR575;`)(value => String(value ?? '').trim());
  assert.deepEqual(options('抽查項目', [
    { '抽查項目': '項目 B' },
    { '抽查項目': '項目 A' },
    { '抽查項目': '項目 A' },
    { '抽查項目': '已刪除', deleted: true },
    { '抽查系統': '其他欄位' },
    null
  ]), ['項目 A', '項目 B']);
});

test('R1201 all existing add-option dialogs use editable inputs with same-column unique datalist options', () => {
  assert.match(script, /<input id="addOptionInput" type="text" autocomplete="off" list="addOptionInput-options"/);
  assert.match(script, /<datalist id="addOptionInput-options"><\/datalist>/);
  assert.match(script, /function fillAddOptionSuggestionsR1201\(field\)\{[\s\S]*?uniqueTableColumnOptionsR575\(field,state\.rows\)/);
  assert.match(script, /fillAddOptionSuggestionsR1201\(field\);/);
  assert.match(script, /input\.setAttribute\("data-options-source","active-table-column-unique-r1201"\)/);
  assert.match(script, /仍可直接輸入、編輯及複製/);
  assert.match(script, /if\(FORM_DROPDOWN_FIELDS_R570\.indexOf\(field\)<0\)\{ toast\("此欄位不是可新增選項的下拉欄位。"\)/);
});

test('R1201 preserves data identity, fields, permissions, and embedded script syntax', () => {
  assert.match(html, /data-resource-key="sxdh-inspection-control"/);
  assert.match(html, /data-db-name="tasun_sxdh_inspection_control_idb_v1"/);
  assert.match(html, /function canEdit\(/);
  assert.match(html, /var FIELDS = \["項次", "查驗類別", "抽查申請單申請日期", "抽查申請單編號", "抽查項目"/);
  assert.doesNotThrow(() => new Function(script));
});
