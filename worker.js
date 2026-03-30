// tasun-worker-stable-v4_2-auth-sync.js
// Cloudflare Worker (D1) - login + auth table sync + generic row sync
// Required bindings:
//   DB            -> D1 database
//   AUTH_SECRET   -> secret string for HMAC signing
// Optional env vars:
//   CORS_ALLOW_ORIGINS      -> comma separated origins, default https://wutasun.github.io
//   ACCESS_DEFAULT_ROLE     -> role to trust when Cloudflare Access header is present, default admin
//   ACCESS_DEFAULT_USERNAME -> username to use when Cloudflare Access header is present, default local-part of email
//   DEFAULT_PASSWORD_HASH   -> fallback hash for brand-new users without password/passHash, default sha256('123456')

const SERVICE_VERSION = 'v4.4-total-final-20260330';
const DEFAULT_PASSWORD_HASH = '8d969eef6ecad3c29a3a629280e686cff0c3f5d5a86afff3ca12020c923adc6c92';

const STORE_KEYS = {
  navButtons: 'auth-table:navButtons',
  routes: 'auth-table:routes',
  btnMeta: 'auth-table:btnMeta',
  permMatrix: 'auth-table:permMatrix',
  entrySelected: 'auth-table:entrySelected',
  entryRegistry: 'auth-table:entryRegistry',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response('', { status: 204, headers: cors });
    }

    try {
      if (path === '/api/tasun/health') {
        return json({ ok: true, service: 'tasun-worker', version: SERVICE_VERSION, ts: Date.now() }, 200, cors);
      }

      if (path === '/api/tasun/login') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        const body = await readJson(request);
        const username = norm(body.username);
        const password = String(body.password || '');
        if (!username || !password) return json({ ok: false, error: 'BAD_INPUT' }, 400, cors);

        const user = await getUser(env, username);
        if (!user || Number(user.enabled || 0) !== 1) return json({ ok: false, error: 'NO_USER' }, 401, cors);

        const passHash = await sha256Hex(password);
        if (passHash !== String(user.pass_hash || '')) {
          return json({ ok: false, error: 'BAD_CRED' }, 401, cors);
        }

        const authRow = await getAuth(env, username);
        const role = normalizeRole(authRow?.role || user.role || 'read');
        const exp = Date.now() + 8 * 60 * 60 * 1000;
        const token = await signToken(env, { u: username, r: role, exp });
        return json({ ok: true, user: username, role, exp, token }, 200, cors);
      }


      if (path === '/api/tasun/logout') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        return new Response(JSON.stringify({ ok: true, loggedOut: true }), {
          status: 200,
          headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'set-cookie': 'tasun_session_v4=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' }, cors)
        });
      }

      // Public auth snapshot (no secrets)
      if (path === '/api/auth/public') {
        if (request.method !== 'GET') return json({ ok: false, error: 'METHOD' }, 405, cors);
        const data = await buildAuthTableData(env, { includeSecrets: false });
        return json({ ok: true, data }, 200, cors);
      }

      // Full auth snapshot: Access session OR bearer token
      if (path === '/api/auth/table') {
        if (request.method !== 'GET') return json({ ok: false, error: 'METHOD' }, 405, cors);
        const session = await requireSession(request, env, { allowAccessHeader: true });
        if (!session.ok) return json({ ok: false, error: session.error }, 401, cors);
        const data = await buildAuthTableData(env, { includeSecrets: true });
        return json({ ok: true, me: session.me, data }, 200, cors);
      }

      if (path === '/api/admin/auth/table') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        const session = await requireSession(request, env, { requireAdmin: true, allowAccessHeader: true });
        if (!session.ok) return json({ ok: false, error: session.error }, 401, cors);

        const body = await readJson(request);
        const result = await saveAuthTableData(env, body);
        return json({ ok: true, me: session.me, ...result }, 200, cors);
      }

      // Generic session for tasun protected endpoints
      const session = await requireSession(request, env, { allowAccessHeader: true });
      if (!session.ok) return json({ ok: false, error: session.error }, 401, cors);
      const me = session.me;

      if (path === '/api/tasun/me') {
        return json({ ok: true, user: me.u, role: me.r, exp: me.exp || null }, 200, cors);
      }

      if (path === '/api/tasun/auth/read') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        const body = await readJson(request);
        const username = norm(body.username || me.u);
        if (me.r !== 'admin' && username !== me.u) return json({ ok: false, error: 'FORBIDDEN' }, 403, cors);
        const row = await getAuth(env, username);
        return json({ ok: true, row: row || null }, 200, cors);
      }

      if (path === '/api/tasun/auth/upsert') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        if (me.r !== 'admin') return json({ ok: false, error: 'FORBIDDEN' }, 403, cors);
        const body = await readJson(request);
        const row = body.row || {};
        const username = norm(row.username || row.user || row.name);
        if (!username) return json({ ok: false, error: 'BAD_INPUT' }, 400, cors);
        const updatedAt = Date.now();
        const role = normalizeRole(row.role || 'read');
        const flags = normalizeBtnFlags(row, role);

        await env.DB.prepare(`
          INSERT INTO tasun_auth(username, role, btn1, btn2, btn3, btn4, btn5, updatedAt)
          VALUES(?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET
            role=excluded.role,
            btn1=excluded.btn1,
            btn2=excluded.btn2,
            btn3=excluded.btn3,
            btn4=excluded.btn4,
            btn5=excluded.btn5,
            updatedAt=excluded.updatedAt
        `).bind(username, role, flags.btn1, flags.btn2, flags.btn3, flags.btn4, flags.btn5, updatedAt).run();

        return json({ ok: true, updatedAt }, 200, cors);
      }

      if (path === '/api/tasun/users/upsert') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        if (me.r !== 'admin') return json({ ok: false, error: 'FORBIDDEN' }, 403, cors);
        const body = await readJson(request);
        const row = body.row || {};
        const username = norm(row.username || row.user || row.name);
        const password = String(row.password || row.pass || '');
        let passHash = norm(row.pass_hash || row.passHash || row.passwordHash);
        const role = normalizeRole(row.role || 'read');
        const enabled = row.enabled === 0 ? 0 : 1;
        if (!username) return json({ ok: false, error: 'BAD_INPUT' }, 400, cors);
        if (!passHash && password) passHash = await sha256Hex(password);
        if (!passHash) {
          const old = await getUser(env, username);
          passHash = norm(old?.pass_hash) || String(env.DEFAULT_PASSWORD_HASH || DEFAULT_PASSWORD_HASH);
        }
        const ts = Date.now();
        const old = await getUser(env, username);
        const createdAt = Number(old?.createdAt || ts);

        await env.DB.prepare(`
          INSERT INTO tasun_users(username, pass_hash, role, enabled, createdAt, updatedAt)
          VALUES(?, ?, ?, ?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET
            pass_hash=excluded.pass_hash,
            role=excluded.role,
            enabled=excluded.enabled,
            updatedAt=excluded.updatedAt
        `).bind(username, passHash, role, enabled, createdAt, ts).run();

        return json({ ok: true, updatedAt: ts }, 200, cors);
      }

      if (path === '/api/tasun/read') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        const body = await readJson(request);
        const resourceKey = norm(body.resourceKey);
        if (!resourceKey) return json({ ok: false, error: 'BAD_INPUT' }, 400, cors);

        const rs = await env.DB.prepare(`
          SELECT resourceKey, uid, data, updatedAt, rev, deleted
          FROM tasun_rows
          WHERE resourceKey=?
          ORDER BY updatedAt DESC
          LIMIT 5000
        `).bind(resourceKey).all();

        const rows = (rs.results || []).map(hydrateRow);
        return json({ ok: true, resourceKey, rows }, 200, cors);
      }

      if (path === '/api/tasun/merge') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        if (!(me && (me.r === 'write' || me.r === 'admin'))) return json({ ok: false, error: 'FORBIDDEN' }, 403, cors);
        const body = await readJson(request);
        const resourceKey = norm(body.resourceKey);
        const payload = body.payload || {};
        const db = Array.isArray(payload.db) ? payload.db : [];
        if (!resourceKey) return json({ ok: false, error: 'BAD_INPUT' }, 400, cors);

        let count = 0;
        const now = Date.now();
        for (const item of db) {
          if (!item || typeof item !== 'object') continue;
          const uid = norm(item.uid || item.pk || item.uuid);
          if (!uid) continue;

          const updatedAt = Number(item.updatedAt || now) || now;
          const rev = Number(item.rev || updatedAt) || updatedAt;
          const deleted = item.deleted ? 1 : 0;
          const clone = { ...item, uid };
          delete clone.resourceKey;
          delete clone.updatedAt;
          delete clone.rev;
          delete clone.deleted;
          delete clone._deleted;
          const data = JSON.stringify(clone);

          await env.DB.prepare(`
            INSERT INTO tasun_rows(resourceKey, uid, data, updatedAt, rev, deleted)
            VALUES(?, ?, ?, ?, ?, ?)
            ON CONFLICT(resourceKey, uid) DO UPDATE SET
              data=CASE
                WHEN excluded.updatedAt > tasun_rows.updatedAt THEN excluded.data
                WHEN excluded.updatedAt = tasun_rows.updatedAt AND excluded.rev >= tasun_rows.rev THEN excluded.data
                ELSE tasun_rows.data
              END,
              updatedAt=CASE
                WHEN excluded.updatedAt > tasun_rows.updatedAt THEN excluded.updatedAt
                WHEN excluded.updatedAt = tasun_rows.updatedAt AND excluded.rev >= tasun_rows.rev THEN excluded.updatedAt
                ELSE tasun_rows.updatedAt
              END,
              rev=CASE
                WHEN excluded.updatedAt > tasun_rows.updatedAt THEN excluded.rev
                WHEN excluded.updatedAt = tasun_rows.updatedAt AND excluded.rev >= tasun_rows.rev THEN excluded.rev
                ELSE tasun_rows.rev
              END,
              deleted=CASE
                WHEN excluded.updatedAt > tasun_rows.updatedAt THEN excluded.deleted
                WHEN excluded.updatedAt = tasun_rows.updatedAt AND excluded.rev >= tasun_rows.rev THEN excluded.deleted
                ELSE tasun_rows.deleted
              END
          `).bind(resourceKey, uid, data, updatedAt, rev, deleted).run();
          count++;
        }

        const rs = await env.DB.prepare(`
          SELECT resourceKey, uid, data, updatedAt, rev, deleted
          FROM tasun_rows
          WHERE resourceKey=?
          ORDER BY updatedAt DESC
          LIMIT 5000
        `).bind(resourceKey).all();
        const rows = (rs.results || []).map(hydrateRow);
        return json({ ok: true, resourceKey, count, rows }, 200, cors);
      }

      return json({ ok: false, error: 'NOT_FOUND', path }, 404, cors);
    } catch (err) {
      return json({ ok: false, error: 'INTERNAL', detail: String(err && err.message ? err.message : err) }, 500, cors);
    }
  }
};

async function buildAuthTableData(env, { includeSecrets = false } = {}) {
  const usersRs = await env.DB.prepare(`
    SELECT username, pass_hash, role, enabled, createdAt, updatedAt
    FROM tasun_users
    ORDER BY username
  `).all();
  const authRs = await env.DB.prepare(`
    SELECT username, role, btn1, btn2, btn3, btn4, btn5, updatedAt
    FROM tasun_auth
    ORDER BY username
  `).all();

  const authMap = new Map((authRs.results || []).map(r => [String(r.username), r]));
  const userMap = new Map((usersRs.results || []).map(r => [String(r.username), r]));
  const names = Array.from(new Set([...authMap.keys(), ...userMap.keys()])).sort((a, b) => a.localeCompare(b));

  const auth = names.map(username => {
    const u = userMap.get(username) || {};
    const a = authMap.get(username) || {};
    const row = {
      user: username,
      name: username,
      role: normalizeRole(a.role || u.role || 'read'),
      enabled: Number(u.enabled == null ? 1 : u.enabled),
      btn1: Number(a.btn1 || 0),
      btn2: Number(a.btn2 || 0),
      btn3: Number(a.btn3 || 0),
      btn4: Number(a.btn4 || 0),
      btn5: Number(a.btn5 || 0),
      createdAt: Number(u.createdAt || 0),
      updatedAt: Math.max(Number(u.updatedAt || 0), Number(a.updatedAt || 0)),
    };
    if (includeSecrets) row.passHash = String(u.pass_hash || '');
    return row;
  });

  return {
    auth,
    navButtons: await storeGetJson(env, STORE_KEYS.navButtons, []),
    routes: await storeGetJson(env, STORE_KEYS.routes, {}),
    btnMeta: await storeGetJson(env, STORE_KEYS.btnMeta, []),
    permMatrix: await storeGetJson(env, STORE_KEYS.permMatrix, { users: {} }),
    entrySelected: await storeGetJson(env, STORE_KEYS.entrySelected, 'index.html'),
    entryRegistry: await storeGetJson(env, STORE_KEYS.entryRegistry, []),
  };
}

async function saveAuthTableData(env, payload) {
  const now = Date.now();
  const authList = Array.isArray(payload.auth) ? payload.auth : [];
  let usersSaved = 0;
  let authSaved = 0;

  const currentUsers = await env.DB.prepare(`
    SELECT username, pass_hash, role, enabled, createdAt, updatedAt
    FROM tasun_users
  `).all();
  const currentAuth = await env.DB.prepare(`
    SELECT username, role, btn1, btn2, btn3, btn4, btn5, updatedAt
    FROM tasun_auth
  `).all();
  const userMap = new Map((currentUsers.results || []).map(r => [String(r.username), r]));
  const authMap = new Map((currentAuth.results || []).map(r => [String(r.username), r]));

  for (const item of authList) {
    if (!item || typeof item !== 'object') continue;
    const username = norm(item.username || item.user || item.name);
    if (!username) continue;

    const oldUser = userMap.get(username) || null;
    const oldAuth = authMap.get(username) || null;
    const role = normalizeRole(item.role || oldAuth?.role || oldUser?.role || 'read');
    let passHash = norm(item.passHash || item.passwordHash || item.hash || item.pass_hash);
    if (!passHash && item.pass) passHash = await sha256Hex(String(item.pass));
    if (!passHash) passHash = norm(oldUser?.pass_hash) || String(env.DEFAULT_PASSWORD_HASH || DEFAULT_PASSWORD_HASH);
    const enabled = item.enabled === 0 ? 0 : Number(oldUser?.enabled ?? 1);
    const createdAt = Number(oldUser?.createdAt || now);

    await env.DB.prepare(`
      INSERT INTO tasun_users(username, pass_hash, role, enabled, createdAt, updatedAt)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        pass_hash=excluded.pass_hash,
        role=excluded.role,
        enabled=excluded.enabled,
        updatedAt=excluded.updatedAt
    `).bind(username, passHash, role, enabled, createdAt, now).run();
    usersSaved++;

    const flags = normalizeBtnFlags(item, role, oldAuth);
    await env.DB.prepare(`
      INSERT INTO tasun_auth(username, role, btn1, btn2, btn3, btn4, btn5, updatedAt)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        role=excluded.role,
        btn1=excluded.btn1,
        btn2=excluded.btn2,
        btn3=excluded.btn3,
        btn4=excluded.btn4,
        btn5=excluded.btn5,
        updatedAt=excluded.updatedAt
    `).bind(username, role, flags.btn1, flags.btn2, flags.btn3, flags.btn4, flags.btn5, now).run();
    authSaved++;
  }

  await storePutJson(env, STORE_KEYS.navButtons, payload.navButtons ?? [], now);
  await storePutJson(env, STORE_KEYS.routes, payload.routes ?? {}, now);
  await storePutJson(env, STORE_KEYS.btnMeta, payload.btnMeta ?? [], now);
  await storePutJson(env, STORE_KEYS.permMatrix, payload.permMatrix ?? { users: {} }, now);
  await storePutJson(env, STORE_KEYS.entrySelected, payload.entrySelected ?? 'index.html', now);
  await storePutJson(env, STORE_KEYS.entryRegistry, payload.entryRegistry ?? [], now);

  return { updatedAt: now, usersSaved, authSaved };
}

function normalizeBtnFlags(item, role, oldAuth = null) {
  const defaults = role === 'read'
    ? { btn1: 1, btn2: 0, btn3: 0, btn4: 0, btn5: 0 }
    : { btn1: 1, btn2: 1, btn3: 1, btn4: 1, btn5: 1 };
  const base = oldAuth || defaults;
  return {
    btn1: toIntFlag(item.btn1, base.btn1, defaults.btn1),
    btn2: toIntFlag(item.btn2, base.btn2, defaults.btn2),
    btn3: toIntFlag(item.btn3, base.btn3, defaults.btn3),
    btn4: toIntFlag(item.btn4, base.btn4, defaults.btn4),
    btn5: toIntFlag(item.btn5, base.btn5, defaults.btn5),
  };
}

function toIntFlag(value, fallback, hardDefault = 0) {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  if (fallback === true || fallback === 1 || fallback === '1') return 1;
  if (fallback === false || fallback === 0 || fallback === '0') return 0;
  return hardDefault ? 1 : 0;
}

async function storeGetJson(env, id, fallback) {
  try {
    const row = await env.DB.prepare('SELECT json FROM tasun_store WHERE id=?').bind(id).first();
    if (!row || row.json == null) return fallback;
    return JSON.parse(String(row.json));
  } catch (_) {
    return fallback;
  }
}

async function storePutJson(env, id, value, now = Date.now()) {
  const jsonText = JSON.stringify(value ?? null);
  await env.DB.prepare(`
    INSERT INTO tasun_store(id, json, updatedAt, rev)
    VALUES(?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      json=excluded.json,
      updatedAt=excluded.updatedAt,
      rev=excluded.rev
  `).bind(id, jsonText, String(now), String(now)).run();
}

function hydrateRow(r) {
  let data = r.data;
  try { data = JSON.parse(String(r.data)); } catch (_) {}
  return {
    resourceKey: String(r.resourceKey),
    uid: String(r.uid),
    ...(typeof data === 'object' && data ? data : {}),
    updatedAt: Number(r.updatedAt || 0),
    rev: Number(r.rev || 0),
    deleted: !!r.deleted,
  };
}

async function getUser(env, username) {
  return await env.DB.prepare(`
    SELECT username, pass_hash, role, enabled, createdAt, updatedAt
    FROM tasun_users
    WHERE username=?
  `).bind(username).first();
}

async function getAuth(env, username) {
  return await env.DB.prepare(`
    SELECT username, role, btn1, btn2, btn3, btn4, btn5, updatedAt
    FROM tasun_auth
    WHERE username=?
  `).bind(username).first();
}

async function requireSession(request, env, opts = {}) {
  const me = await parseSession(request, env, opts);
  if (!me) return { ok: false, error: 'UNAUTH' };
  if (opts.requireAdmin && normalizeRole(me.r) !== 'admin') {
    return { ok: false, error: 'FORBIDDEN' };
  }
  return { ok: true, me };
}

async function parseSession(request, env, opts = {}) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const me = await verifyToken(env, token);
    if (me) return me;
  }

  if (opts.allowAccessHeader) {
    const accessEmail = request.headers.get('cf-access-authenticated-user-email')
      || request.headers.get('Cf-Access-Authenticated-User-Email')
      || '';
    if (accessEmail) {
      const email = String(accessEmail).trim();
      const local = email.split('@')[0] || 'access';
      return {
        u: String(env.ACCESS_DEFAULT_USERNAME || local),
        r: normalizeRole(env.ACCESS_DEFAULT_ROLE || 'admin'),
        exp: Date.now() + 60 * 60 * 1000,
        accessEmail: email,
        source: 'access',
      };
    }
  }

  return null;
}

function normalizeRole(role) {
  const r = String(role || 'read').trim().toLowerCase();
  if (r === 'admin' || r === 'write' || r === 'read') return r;
  return 'read';
}

function norm(v) {
  return String(v || '').trim();
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

function json(obj, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(obj), { status, headers: h });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowList = String(env.CORS_ALLOW_ORIGINS || 'https://wutasun.github.io')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const allowOrigin = allowList.includes(origin) ? origin : (allowList[0] || 'https://wutasun.github.io');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

async function signToken(env, payload) {
  const header = { alg: 'HS256', typ: 'TJWT' };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const msg = h + '.' + p;
  const sig = await hmacSha256B64Url(env.AUTH_SECRET || 'dev-secret', msg);
  return msg + '.' + sig;
}

async function verifyToken(env, token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const msg = h + '.' + p;
  const expect = await hmacSha256B64Url(env.AUTH_SECRET || 'dev-secret', msg);
  if (sig !== expect) return null;
  let payload = null;
  try { payload = JSON.parse(atobUrl(p)); } catch (_) { return null; }
  if (!payload || !payload.u || !payload.r) return null;
  if (payload.exp && Date.now() > Number(payload.exp)) return null;
  return payload;
}

function b64url(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function atobUrl(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}

async function hmacSha256B64Url(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sigBuf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(str || '')));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}
