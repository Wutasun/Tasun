'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, '捷運汐止東湖線-施工查驗管控表.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'tasun-api', 'worker_tasun.js'), 'utf8');
const script = html.match(/<script\s+id="tasun-inspection-control-r560-app">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(script, 'inspection control app script exists');

test('R1202 抽查項目 shows a visible dropdown toggle and keeps the textarea editable', () => {
  assert.match(script, /<textarea id="'\+esc\(id\)\+'" aria-autocomplete="list"/);
  assert.match(script, /<button class="column-suggestion-toggle" type="button" data-column-suggestion-toggle="'\+esc\(f\)\+'" aria-label="顯示抽查項目下拉選項" aria-expanded="false">▼<\/button>/);
  assert.match(script, /var suggestionToggle=ev\.target[\s\S]{0,1100}renderFieldSuggestionsR1201\(toggleField,"",true\)/);
  assert.match(script, /function renderFieldSuggestionsR1201\(field, query, forceOpen\)[\s\S]{0,850}uniqueTableColumnOptionsR575\(field,state\.rows\)/);
  assert.match(script, /可直接輸入、編輯及複製文字/);
});

test('R1203 sorts by registration time and preserves assigned item numbers on local saves', () => {
  const helper = script.match(/function registrationTimeR1202\(row\)\{[\s\S]*?\n    \}\n    function registrationOrderR1202\(rows\)\{[\s\S]*?\n    \}/)?.[0];
  assert.ok(helper, 'registration-order helpers exist');
  const order = new Function(`${helper}; return registrationOrderR1202;`)();
  const rows = [
    { uid: 'edited-first', '項次': 8, createdAt: 100, updatedAt: 900 },
    { uid: 'later', '項次': 9, createdAt: 200, updatedAt: 201 }
  ];
  assert.deepEqual(order(rows).map(row => row.uid), ['edited-first', 'later']);
  assert.match(script, /function renumber\(rows\)[\s\S]{0,550}row\["項次"\]=\+\+max/);
  assert.match(script, /return registrationOrderR1202\(ordered\)/);
  assert.match(script, /createdAt:t, updatedAt:t, rev:t/);
});

test('only administrators see and submit the item number editor', () => {
  assert.match(script, /if\(isAdmin\(\) && state\.formMode==="edit"\) fields\.unshift\("項次"\)/);
  assert.match(script, /if\(isAdmin\(\) && state\.formMode==="edit"\)\{ var itemNumber=qs\("#f項次"\)/);
  assert.match(script, /if\(state\.formMode==="edit" && isAdmin\(\) && Object\.prototype\.hasOwnProperty\.call\(data,"項次"\)\)/);
  assert.match(script, /state\.formMode=row \? "edit" : "add"; state\.formUid=row \? row\.uid : "";\s*buildForm\(\)/);
  assert.match(worker, /resourceKey === INSPECTION_RESOURCE_KEY[\s\S]{0,140}prepareInspectionRowsForMerge\(env, incomingRows, me\.r, now\)/);
});

test('Worker preserves existing numbers for write users, allocates new numbers, and permits unique admin edits', async () => {
  const helper = worker.match(/async function prepareInspectionRowsForMerge\(env, incomingRows, role, now = Date\.now\(\)\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(helper, 'inspection merge guard exists');
  const prepare = new Function('INSPECTION_RESOURCE_KEY', 'hydrateRow', 'materialVersionWins', 'norm', `return ${helper};`)(
    'sxdh-inspection-control',
    row => ({ resourceKey: row.resourceKey, uid: row.uid, ...JSON.parse(row.data), updatedAt: row.updatedAt, rev: row.rev, deleted: !!row.deleted }),
    (incoming, existing) => Number(incoming.updatedAt || 0) > Number(existing.updatedAt || 0) || (Number(incoming.updatedAt || 0) === Number(existing.updatedAt || 0) && Number(incoming.rev || 0) >= Number(existing.rev || 0)),
    value => String(value || '').trim()
  );
  const makeEnv = stored => ({ DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: stored.map(row => ({ resourceKey: 'sxdh-inspection-control', uid: row.uid, data: JSON.stringify(row), updatedAt: row.updatedAt, rev: row.rev, deleted: row.deleted })) }) }) }) } });
  const stored = [{ uid: 'old', '項次': 4, createdAt: 100, updatedAt: 100, rev: 100, deleted: false }];
  const guarded = await prepare(makeEnv(stored), [
    { uid: 'old', '項次': 99, createdAt: 100, updatedAt: 200, rev: 200, deleted: false },
    { uid: 'new', '項次': 1, createdAt: 200, updatedAt: 200, rev: 200, deleted: false }
  ], 'write', 300);
  assert.deepEqual(guarded.map(row => [row.uid, row['項次']]), [['old', 4], ['new', 5]]);
  assert.equal(guarded[0].createdAt, 100);
  assert.equal(guarded[1].createdAt, 300);

  const admin = await prepare(makeEnv(stored), [
    { uid: 'old', '項次': 7, createdAt: 100, updatedAt: 200, rev: 200, deleted: false }
  ], 'admin', 300);
  assert.equal(admin[0]['項次'], 7);
  await assert.rejects(() => prepare(makeEnv(stored), [
    { uid: 'old', '項次': 4, updatedAt: 200, rev: 200 },
    { uid: 'new', '項次': 4, updatedAt: 200, rev: 200 }
  ], 'admin', 300), error => error.code === 'ITEM_NUMBER_DUPLICATE');
});

test('the existing resource, IndexedDB store, login roles, and JavaScript syntax remain intact', () => {
  assert.match(html, /data-resource-key="sxdh-inspection-control"/);
  assert.match(html, /data-db-name="tasun_sxdh_inspection_control_idb_v1"/);
  assert.match(script, /function canEdit\(/);
  assert.match(worker, /const INSPECTION_RESOURCE_KEY = 'sxdh-inspection-control'/);
  assert.match(worker, /if \(!\(me && \(me\.r === 'write' \|\| me\.r === 'admin'\)\)\) return json\(\{ ok: false, error: 'FORBIDDEN' \}, 403, cors\)/);
  assert.doesNotThrow(() => new Function(script));
});
