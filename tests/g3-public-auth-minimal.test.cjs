'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workerPath = path.resolve(__dirname, '../tasun-api/worker-g3-v2-staging-only.js');
const source = fs.readFileSync(workerPath, 'utf8');
const workerModule = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('unauthenticated public auth endpoint returns only enabled login names', async () => {
  const worker = (await workerModule).default;
  const db = {
    prepare(sql) {
      return {
        async run() { return { success: true }; },
        async all() {
          if (sql.includes('FROM tasun_users')) {
            return { results: [{ username: 'active_user', enabled: 1 }] };
          }
          throw new Error('unexpected query in public auth endpoint');
        }
      };
    }
  };
  const response = await worker.fetch(
    new Request('https://staging.example/api/auth/public', { method: 'GET' }),
    { DB: db },
    {}
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { ok: true, data: { auth: [{ user: 'active_user', name: 'active_user' }] } });
  assert.doesNotMatch(JSON.stringify(body), /role|enabled|btn[1-5]|createdAt|updatedAt|passHash|permMatrix|routes/i);
});

test('staging worker source contains no embedded legacy password hashes', () => {
  assert.doesNotMatch(source, /LEGACY_(?:INSECURE_PASSWORD_HASH|WEAK_SHA256_HASH)/);
  assert.match(source, /PASSWORD_CHANGE_REQUIRES_PLAINTEXT/);
});
