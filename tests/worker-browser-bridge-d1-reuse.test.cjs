'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const workerSource = fs.readFileSync(path.join(ROOT, 'tasun-api/worker_tasun.js'), 'utf8');
const stagingConfig = fs.readFileSync(path.join(ROOT, 'tasun-api/wrangler.staging.toml'), 'utf8');
const productionConfig = fs.readFileSync(path.join(ROOT, 'tasun-api/wrangler.toml'), 'utf8');

function loadAuthHelpers(db) {
  const source = workerSource
    .replace('export default {', 'globalThis.worker = {')
    + '\nglobalThis.authHelpers = { parseSession, requireSession };';
  const context = { DB: db, Date, JSON, Map, Set, Number, String, Math, Object, Array, Promise, Error, WeakMap, URL, Request, Headers, Response, TextEncoder, TextDecoder, atob, btoa, crypto };
  vm.runInNewContext(source, context, { filename: 'worker_tasun.js' });
  return context.authHelpers;
}

function mockAuthDb({ enabled = 1, userRole = 'admin', permissionRole = 'read' } = {}) {
  const queries = [];
  const db = {
    queries,
    prepare(sql) {
      return {
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          queries.push({ sql, args: this.args });
          if (/FROM tasun_users/.test(sql)) {
            return { username: this.args[0], pass_hash: 'not-used', role: userRole, enabled, createdAt: 1, updatedAt: 1 };
          }
          if (/FROM tasun_auth/.test(sql)) {
            return { username: this.args[0], role: permissionRole, btn1: 0, btn2: 0, btn3: 0, btn4: 0, btn5: 0, updatedAt: 1 };
          }
          throw new Error('Unexpected auth query: ' + sql);
        },
      };
    },
  };
  return db;
}

function bridgeRequest() {
  return new Request('https://tasun-worker.wutasun.workers.dev/api/tasun/read', {
    method: 'POST',
    headers: {
      origin: 'https://wutasun.github.io',
      'content-type': 'application/json',
      'x-tasun-session-bridge': 'v1',
      'x-tasun-page-file': 'xidong-official-doc-detail',
      'x-tasun-user': 'qa_reader',
      'x-tasun-role': 'admin',
    },
    body: '{}',
  });
}

const env = db => ({
  DB: db,
  TASUN_ALLOW_BROWSER_SESSION_BRIDGE: '1',
  TASUN_BROWSER_SESSION_BRIDGE_STRICT: '1',
  CORS_ALLOW_ORIGINS: 'https://wutasun.github.io',
});

test('browser bridge reuses only same-request D1 rows and keeps permission-table role authoritative', async () => {
  const db = mockAuthDb({ userRole: 'admin', permissionRole: 'read' });
  const helpers = loadAuthHelpers(db);
  const request = bridgeRequest();
  const session = await helpers.requireSession(request, env(db));

  assert.equal(session.ok, true);
  assert.equal(session.me.r, 'read');
  assert.equal(db.queries.length, 2, 'one user and one permission lookup per request');
  assert.match(db.queries[0].sql, /FROM tasun_users/);
  assert.match(db.queries[1].sql, /FROM tasun_auth/);
});

test('browser bridge still rejects a disabled D1 user', async () => {
  const db = mockAuthDb({ enabled: 0 });
  const helpers = loadAuthHelpers(db);
  const session = await helpers.requireSession(bridgeRequest(), env(db));

  assert.equal(session.ok, false);
  assert.equal(session.error, 'UNAUTH');
  assert.equal(db.queries.length, 2);
});

test('Staging enables the Production-compatible browser bridge while keeping strict D1 validation', () => {
  assert.match(stagingConfig, /TASUN_ALLOW_BROWSER_SESSION_BRIDGE\s*=\s*"1"/);
  assert.match(stagingConfig, /TASUN_BROWSER_SESSION_BRIDGE_STRICT\s*=\s*"1"/);
  assert.match(productionConfig, /TASUN_ALLOW_BROWSER_SESSION_BRIDGE\s*=\s*"1"/);
});
