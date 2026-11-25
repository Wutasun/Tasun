'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', '捷運汐止東湖線-施工查驗管控表.html'), 'utf8');
const script = html.match(/<script\s+id="tasun-inspection-control-r560-app">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(script, 'inspection control app script exists');

test('R1202 抽查項目 shows a visible dropdown toggle and keeps the textarea editable', () => {
  assert.match(script, /<textarea id="'\+esc\(id\)\+'" aria-autocomplete="list"/);
  assert.match(script, /<button class="column-suggestion-toggle" type="button" data-column-suggestion-toggle="'\+esc\(f\)\+'" aria-label="顯示抽查項目下拉選項" aria-expanded="false">▼<\/button>/);
  assert.match(script, /var suggestionToggle=ev\.target[\s\S]{0,1100}renderFieldSuggestionsR1201\(toggleField,"",true\)/);
  assert.match(script, /function renderFieldSuggestionsR1201\(field, query, forceOpen\)[\s\S]{0,850}uniqueTableColumnOptionsR575\(field,state\.rows\)/);
  assert.match(script, /可直接輸入、編輯及複製文字/);
  assert.match(script, /if\(suggestion\)[\s\S]{0,350}input\.value=suggestion\.getAttribute\("data-suggestion-value"\)/);
});

test('R1202 sorts by immutable registration time before sequence number and edit timestamp', () => {
  const helper = script.match(/function registrationTimeR1202\(row\)\{[\s\S]*?\n    \}\n    function registrationOrderR1202\(rows\)\{[\s\S]*?\n    \}/)?.[0];
  assert.ok(helper, 'registration-order helpers exist');
  const order = new Function(`${helper}; return registrationOrderR1202;`)();
  const rows = [
    { uid: `ic-${(100).toString(36)}-edited`, '項次': 1, updatedAt: 900 },
    { uid: `ic-${(200).toString(36)}-later`, '項次': 2, updatedAt: 201 },
    { uid: 'legacy-row', '項次': 3, updatedAt: 250 },
    { uid: `ic-${(300).toString(36)}-new`, '項次': '', updatedAt: 300 }
  ];
  assert.deepEqual(order(rows).map(row => row.uid), [
    `ic-${(100).toString(36)}-edited`,
    `ic-${(200).toString(36)}-later`,
    'legacy-row',
    `ic-${(300).toString(36)}-new`
  ]);
  assert.match(script, /return registrationOrderR1202\(Object\.keys\(bySig\)\.map\(function\(k\)\{ return bySig\[k\]; \}\)\)/);
  assert.match(script, /if\(state\.formMode==="edit"[\s\S]{0,250}updatedAt:t, rev:t, deleted:false/);
});

test('R1202 leaves row schema, page resource, permissions, and script syntax intact', () => {
  assert.match(html, /data-resource-key="sxdh-inspection-control"/);
  assert.match(html, /data-db-name="tasun_sxdh_inspection_control_idb_v1"/);
  assert.match(script, /function canEdit\(/);
  assert.doesNotMatch(script, /createdAt\s*:/);
  assert.doesNotThrow(() => new Function(script));
});
