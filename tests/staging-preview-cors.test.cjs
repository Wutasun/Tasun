'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');

const workerPath = path.join(__dirname, '..', 'tasun-api', 'worker_tasun.js');
const workerModule = await import(pathToFileURL(workerPath).href);
const worker = workerModule.default;

async function preflight(origin, env) {
  const response = await worker.fetch(new Request(
    'https://tasun-worker-staging.wutasun.workers.dev/api/auth/public',
    { method: 'OPTIONS', headers: { Origin: origin } },
  ), env);
  return {
    status: response.status,
    allowOrigin: response.headers.get('Access-Control-Allow-Origin'),
    allowCredentials: response.headers.get('Access-Control-Allow-Credentials'),
  };
}

test('Staging CORS allows only HTTPS one-label previews for the configured Pages project', async (t) => {
  const env = {
    CORS_ALLOW_ORIGINS: 'https://wutasun.github.io,https://fix-pr104-detail-staging-api.tasun-g3-pr104-preview.pages.dev',
    STAGING_PREVIEW_CORS_PROJECT_DOMAIN: 'tasun-g3-pr104-preview.pages.dev',
  };

  await t.test('allows a hash deployment origin and echoes that exact origin', async () => {
    const origin = 'https://270b9257.tasun-g3-pr104-preview.pages.dev';
    assert.deepEqual(await preflight(origin, env), {
      status: 204,
      allowOrigin: origin,
      allowCredentials: 'true',
    });
  });

  await t.test('allows the configured branch preview origin', async () => {
    const origin = 'https://fix-pr104-detail-staging-api.tasun-g3-pr104-preview.pages.dev';
    assert.equal((await preflight(origin, env)).allowOrigin, origin);
  });

  await t.test('rejects nested, lookalike, and non-HTTPS origins', async () => {
    const invalid = [
      'https://x.270b9257.tasun-g3-pr104-preview.pages.dev',
      'https://tasun-g3-pr104-preview.pages.dev.attacker.example',
      'http://270b9257.tasun-g3-pr104-preview.pages.dev',
    ];
    for (const origin of invalid) {
      assert.equal((await preflight(origin, env)).allowOrigin, 'https://wutasun.github.io', origin);
    }
  });

  await t.test('does not broaden Production when the Staging-only variable is absent', async () => {
    const origin = 'https://270b9257.tasun-g3-pr104-preview.pages.dev';
    const productionEnv = { CORS_ALLOW_ORIGINS: 'https://wutasun.github.io' };
    assert.equal((await preflight(origin, productionEnv)).allowOrigin, 'https://wutasun.github.io');
  });
});
