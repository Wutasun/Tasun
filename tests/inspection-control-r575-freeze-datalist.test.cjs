'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', '捷運汐止東湖線-施工查驗管控表.html'), 'utf8');
const script = html.match(/<script\s+id="tasun-inspection-control-r560-app">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(script, 'inspection control app script exists');

test('R575 freezes the first five columns while retaining two-axis table scrolling', () => {
  assert.match(html, /id="tableWrap"/);
  assert.match(html, /\.tableWrap\{[^}]*overflow:auto/);
  assert.match(html, /th:nth-child\(-n\+5\),td:nth-child\(-n\+5\)\{position:sticky;\}/);
  assert.match(html, /th:nth-child\(1\),td:nth-child\(1\)\{left:0\}/);
  assert.match(html, /th:nth-child\(2\),td:nth-child\(2\)\{left:58px\}/);
  assert.match(html, /th:nth-child\(3\),td:nth-child\(3\)\{left:148px\}/);
  assert.match(html, /th:nth-child\(4\),td:nth-child\(4\)\{left:260px\}/);
  assert.match(html, /th:nth-child\(5\),td:nth-child\(5\)\{left:470px/);
  assert.match(html, /data-tasun-frozen-leading-columns="5"/);
  assert.match(script, /inspectionControlR575FrozenLeadingColumnsAndContractorSelfCheckDatalist/);
});

test('R575 contractor self-check suggestions come only from distinct active values in that column', () => {
  assert.match(script, /var FORM_DATA_DATALIST_FIELDS_R575 = \["自主檢查表編號\(統包\)"\]/);
  assert.match(script, /if\(FORM_DATA_DATALIST_FIELDS_R575\.indexOf\(field\)>=0\) return uniqueTableColumnOptionsR575\(field,state\.rows\)/);
  assert.match(script, /if\(FORM_DATA_DATALIST_FIELDS_R575\.indexOf\(field\)>=0\) input\.setAttribute\("data-options-source","active-table-column-unique-r575"\)/);
  assert.match(script, /type="text" list="'\+esc\(id\)\+'-options"/);
  assert.match(script, /sourceOnly\?''\:'<button type="button" data-add-form-option=/);
  assert.match(script, /選項來源：自主檢查表編號\(統包\)欄資料去重；可直接輸入、編輯及複製文字/);

  const helper = script.match(/function uniqueTableColumnOptionsR575\(field, rows\)\{[\s\S]*?\n    \}/)?.[0];
  assert.ok(helper, 'column-only distinct value helper exists');
  const options = new Function('cjk', `${helper}; return uniqueTableColumnOptionsR575;`)(value => String(value ?? '').trim());
  assert.deepEqual(options('自主檢查表編號(統包)', [
    { '自主檢查表編號(統包)': 'X-001' },
    { '自主檢查表編號(統包)': 'X-001' },
    { '自主檢查表編號(統包)': 'X-002' },
    { '自主檢查表編號(統包)': 'DELETED', deleted: true },
    { '抽查申請單編號': 'OTHER-COLUMN' },
    null
  ]), ['X-001', 'X-002']);
});

test('R575 preserves page data identity and embedded script syntax', () => {
  assert.match(html, /data-resource-key="sxdh-inspection-control"/);
  assert.match(html, /data-db-name="tasun_sxdh_inspection_control_idb_v1"/);
  assert.doesNotThrow(() => new Function(script));
});
