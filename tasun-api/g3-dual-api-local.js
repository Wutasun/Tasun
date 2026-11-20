/**
 * G3 local-only compatibility harness; not a Production Worker and not an API migration.
 * Isolates the legacy Cloudflare Access/records contract from G3 HMAC/tasun_rows.
 * Never forward secrets or DB bindings between the two handlers.
 */
import g3 from './tasun-worker-stable-v4.js';
import legacy from './worker.js';

const G3_ROUTES = new Set([
  '/api/tasun/health', '/api/tasun/login', '/api/tasun/me',
  '/api/tasun/auth/read', '/api/tasun/auth/upsert',
  '/api/tasun/users/upsert', '/api/tasun/read', '/api/tasun/merge',
]);
const LEGACY_ROUTES = new Set(['/health', '/api/health', '/api/healthz', '/api/read', '/api/merge', '/api/tasun/pull']);

function reply(status, error) {
  return new Response(JSON.stringify({ ok:false, error }), {
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });
}

function localHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // A deliberately non-deployable local harness. Do not remove this safety gate.
    if (!localHost(url.hostname)) return reply(403, 'LOCAL_ONLY');
    if (!env || !env.G3_DB || !env.LEGACY_DB || env.G3_DB === env.LEGACY_DB) {
      return reply(503, 'ISOLATED_DATABASES_REQUIRED');
    }

    const path = url.pathname;
    // The legacy Worker also owns /api/tasun/merge?key=; discriminate using only
    // this historic query signature, never by a caller-supplied authentication token.
    const legacyMerge = path === '/api/tasun/merge' && url.searchParams.has('key');
    if (LEGACY_ROUTES.has(path) || path.startsWith('/api/db/') || legacyMerge) {
      return legacy.fetch(request, {
        DB: env.LEGACY_DB,
        TEAM_DOMAIN: env.LOCAL_ACCESS_TEAM_DOMAIN || 'https://invalid.localhost',
        POLICY_AUD: env.LOCAL_ACCESS_POLICY_AUD || 'UNCONFIGURED_LOCAL_ONLY',
        ALLOWED_ORIGIN: env.LOCAL_ALLOWED_ORIGIN || 'http://localhost:8787',
      }, ctx);
    }
    if (G3_ROUTES.has(path)) {
      return g3.fetch(request, {
        DB: env.G3_DB,
        AUTH_SECRET: env.G3_AUTH_SECRET,
        CORS_ALLOW_ORIGINS: env.G3_CORS_ALLOW_ORIGINS || 'http://localhost:8787',
      }, ctx);
    }
    return reply(404, 'NOT_FOUND');
  },
};
