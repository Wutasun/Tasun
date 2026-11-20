'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, '捷運汐止東湖線-材料查驗管控表.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(ROOT, 'tasun-api/worker_tasun.js'), 'utf8');

function scriptBodies(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs, body]) => body.trim() && !/type\s*=\s*["']application\/(?:ld\+)?json/i.test(attrs))
    .map(([, , body]) => body);
}

function workerHelpers(db) {
  const source = workerSource.replace('export default {', 'globalThis.worker = {') +
    '\nglobalThis.testHelpers = { prepareMaterialRowsForMerge, materialItemNumber };';
  const context = { DB: db, Date, JSON, Map, Set, Number, String, Math, Object, Array, Promise, Error };
  vm.runInNewContext(source, context, { filename: 'worker_tasun.js' });
  return context.testHelpers;
}

function mockDb(rows = [], sequence = 0) {
  const store = { value: sequence };
  return {
    store,
    prepare(sql) {
      return {
        args: [],
        bind(...args) { this.args = args; return this; },
        async all() {
          if (/FROM tasun_rows/.test(sql)) return { results: rows.map(row => ({ ...row })) };
          throw new Error('Unexpected all query: ' + sql);
        },
        async first() {
          if (/SELECT json FROM tasun_store/.test(sql)) return store.value ? { json: String(store.value) } : null;
          if (/UPDATE tasun_store/.test(sql) && /RETURNING json/.test(sql)) {
            if (/SET json=\?/.test(sql)) {
              const requested = Number(this.args[0]);
              if (store.value >= Number(this.args[4])) return null;
              store.value = requested;
              return { json: String(store.value) };
            }
            return { json: String(++store.value) };
          }
          throw new Error('Unexpected first query: ' + sql);
        },
        async run() {
          if (/INSERT INTO tasun_store/.test(sql)) store.value = Math.max(store.value, Number(this.args[1]) || 0);
          else throw new Error('Unexpected run query: ' + sql);
          return { success: true };
        },
      };
    },
  };
}

function storedRow(uid, itemNo, options = {}) {
  return {
    resourceKey: 'sxdh-material-inspection-control',
    uid,
    data: JSON.stringify({ '項次': itemNo, '查驗類別': options.category || '施工', '單位': '組' }),
    updatedAt: options.updatedAt || 100,
    rev: options.rev || 100,
    deleted: options.deleted ? 1 : 0,
  };
}

test('material form exposes distinct-value dropdowns and role-based item number', () => {
  assert.doesNotThrow(() => scriptBodies(page).forEach((body, index) => new vm.Script(body, { filename: `material-page-${index}.js` })));
  assert.match(page, /FORM_SUGGEST_FIELDS_R1171\s*=\s*\["進料數量",\s*"單位"\]/);
  assert.match(page, /active-table-column-unique-r1171/);
  assert.match(page, /else if\(FORM_SUGGEST_FIELDS_R1171\.indexOf\(f\)>=0\) input='<select id=/);
  assert.match(page, /select\.tagName!=="SELECT"/);
  assert.match(page, /row\[field\]/);
  assert.match(page, /values\.sort\(function\(a,b\).*localeCompare/);
  assert.match(page, /isAdmin\(\)\?"":" readonly aria-readonly=/);
  assert.doesNotMatch(page, /function renumber\(rows\)\{ var i=1/);
  assert.match(page, /renumber\(incoming\.filter\([\s\S]{0,240}\),tombs\)/);
});

test('Worker keeps existing item numbers authoritative for write users', async () => {
  const db = mockDb([storedRow('row-a', 4)], 4);
  const helpers = workerHelpers(db);
  const result = await helpers.prepareMaterialRowsForMerge({ DB: db }, [{ uid: 'row-a', '項次': 900, '查驗類別': '物料', updatedAt: 200, rev: 200 }], 'write', 300);
  assert.equal(result.length, 1);
  assert.equal(result[0]['項次'], 4);
  assert.equal(result[0]['查驗類別'], '物料');
  assert.ok(result[0].updatedAt > 200, 'server correction must win the client merge');
});

test('Worker assigns new write rows from persistent sequence and never reuses a deleted number', async () => {
  const db = mockDb([storedRow('deleted-row', 7, { deleted: true })], 12);
  const helpers = workerHelpers(db);
  const result = await helpers.prepareMaterialRowsForMerge({ DB: db }, [{ uid: 'new-row', '項次': 1, '查驗類別': '施工', updatedAt: 200, rev: 200 }], 'write', 300);
  assert.equal(result.length, 1);
  assert.equal(result[0]['項次'], 13);
  assert.equal(db.store.value, 13);
});

test('Worker permits only valid, unused admin edits and rejects reuse', async () => {
  const db = mockDb([storedRow('row-a', 4), storedRow('deleted-row', 8, { deleted: true })], 8);
  const helpers = workerHelpers(db);
  await assert.rejects(
    helpers.prepareMaterialRowsForMerge({ DB: db }, [{ uid: 'row-a', '項次': 8, updatedAt: 200, rev: 200 }], 'admin', 300),
    error => error.code === 'ITEM_NUMBER_DUPLICATE'
  );
  await assert.rejects(
    helpers.prepareMaterialRowsForMerge({ DB: db }, [{ uid: 'row-a', '項次': 6, updatedAt: 200, rev: 200 }], 'admin', 300),
    error => error.code === 'ITEM_NUMBER_RETIRED'
  );
  const result = await helpers.prepareMaterialRowsForMerge({ DB: db }, [{ uid: 'row-a', '項次': 9, updatedAt: 200, rev: 200 }], 'admin', 300);
  assert.equal(result.find(row => row.uid === 'row-a')['項次'], 9);
  assert.equal(db.store.value, 9);
});

test('Worker atomically rejects a concurrent admin claim to the same new number', async () => {
  const db = mockDb([storedRow('row-a', 4), storedRow('row-b', 5)], 8);
  const helpers = workerHelpers(db);
  const claims = await Promise.allSettled([
    helpers.prepareMaterialRowsForMerge({ DB: db }, [{ uid: 'row-a', '項次': 9, updatedAt: 200, rev: 200 }], 'admin', 300),
    helpers.prepareMaterialRowsForMerge({ DB: db }, [{ uid: 'row-b', '項次': 9, updatedAt: 201, rev: 201 }], 'admin', 301),
  ]);
  assert.equal(claims.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = claims.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'ITEM_NUMBER_RETIRED');
  assert.equal(db.store.value, 9);
});

test('Worker repairs legacy duplicate numbers only during admin sync', async () => {
  const db = mockDb([storedRow('deleted-row', 2, { deleted: true }), storedRow('active-row', 2)], 2);
  const helpers = workerHelpers(db);
  await assert.rejects(
    helpers.prepareMaterialRowsForMerge({ DB: db }, [], 'write', 300),
    error => error.code === 'ITEM_NUMBER_REPAIR_ADMIN_REQUIRED'
  );
  const result = await helpers.prepareMaterialRowsForMerge({ DB: db }, [], 'admin', 300);
  assert.equal(result.length, 1);
  assert.equal(result[0].uid, 'active-row');
  assert.equal(result[0]['項次'], 3);
  assert.equal(db.store.value, 3);
});
