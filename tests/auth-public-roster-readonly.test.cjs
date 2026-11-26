'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workerSource = fs.readFileSync(path.join(__dirname, '..', 'tasun-api', 'worker_tasun.js'), 'utf8');

function loadWorker(source) {
  const module = { exports: {} };
  const executable = source.replace(/^export default\\s*\\{/m, 'module.exports = {');
  assert.notEqual(executable, source, 'expected a default Worker export');
  return new Function('module', executable + '\\n; return module.exports;')(module);
}

test('public auth roster GET only reads D1 and returns CORS-safe, secret-free rows', async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      const normalized = String(sql).replace(/\\s+/g, ' ').trim();
      statements.push(normalized);
      const statement = {
        bind(...values) {
          statement.values = values;
          return statement;
        },
        async all() {
          if (normalized.includes('FROM tasun_users')) {
            return { results: [{ username: 'qa-viewer', pass_hash: 'must-not-leak', role: 'read', enabled: 1, createdAt: 1, updatedAt: 1 }] };
          }
          if (normalized.includes('FROM tasun_auth')) {
            return { results: [{ username: 'qa-viewer', role: 'read', btn1: 1, btn2: 0, btn3: 0, btn4: 0, btn5: 0, updatedAt: 1 }] };
          }
          throw new Error('Unexpected D1 all query: ' + normalized);
        },
        async first() {
          if (normalized.includes('FROM tasun_store')) return null;
          throw new Error('Unexpected D1 first query: ' + normalized);
        },
        async run() {
          throw new Error('Public auth GET attempted a D1 write: ' + normalized);
        },
      };
      return statement;
    },
  };
  const worker = loadWorker(workerSource);
  const response = await worker.fetch(
    new Request('https://worker.test/api/auth/public', {
      method: 'GET',
      headers: { Origin: 'https://wutasun.github.io', Accept: 'application/json' },
    }),
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://wutasun.github.io');
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.data.auth[0].user, 'qa-viewer');
  assert.equal(Object.hasOwn(body.data.auth[0], 'pass_hash'), false);
  assert.ok(statements.length > 0);
  assert.ok(statements.every(sql => /^SELECT\\b/i.test(sql)), statements.join('\\n'));
});
