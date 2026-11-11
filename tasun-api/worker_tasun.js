// tasun-worker-stable-v4_2-auth-sync.js
// Cloudflare Worker (D1) - login + auth table sync + generic row sync
// Required bindings:
//   DB            -> D1 database
//   AUTH_SECRET   -> secret string for HMAC signing
// Optional env vars:
//   CORS_ALLOW_ORIGINS      -> comma separated origins, default https://wutasun.github.io
//   ACCESS_DEFAULT_ROLE     -> role to trust when Cloudflare Access header is present, default admin
//   ACCESS_DEFAULT_USERNAME -> username to use when Cloudflare Access header is present, default local-part of email
//   DEFAULT_PASSWORD_HASH   -> optional bootstrap hash; configure securely before seeding default users

const SERVICE_VERSION = 'v5.0-r501-official-documents-textplain-sessionbridge-sync-20260607';

const STORE_KEYS = {
  navButtons: 'auth-table:navButtons',
  routes: 'auth-table:routes',
  btnMeta: 'auth-table:btnMeta',
  permMatrix: 'auth-table:permMatrix',
  entrySelected: 'auth-table:entrySelected',
  entryRegistry: 'auth-table:entryRegistry',
};

let schemaReadyPromise = null;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (path === '/api/tasun/health') {
        return json({ ok: true, service: 'tasun-worker', version: SERVICE_VERSION, autoVersionRelease: true, releaseEndpoint: '/api/tasun/release-version', workflow: String(env.GITHUB_WORKFLOW_FILE || 'release-version.yml'), repo: String((env.GITHUB_OWNER || 'Wutasun') + '/' + (env.GITHUB_REPO || 'Tasun')), ts: Date.now() }, 200, cors);
      }

      // r86：正式同步端點先自動確認 D1 基本表存在，避免 GitHub Pages 前端正常但雲端 read/merge 失敗。
      await ensureSchema(env);

      if (path === '/api/tasun/login') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        if (!validAuthSecret(env)) return json({ ok: false, error: 'AUTH_CONFIGURATION' }, 503, cors);
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
        const h = new Headers(cors);
        h.set('content-type', 'application/json; charset=utf-8');
        h.set('set-cookie', cookieValue('tasun_session_v4', token, { maxAge: 8 * 60 * 60 }));
        return new Response(JSON.stringify({ ok: true, user: username, role, exp, token }), { status: 200, headers: h });
      }


      if (path === '/api/tasun/logout') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        return new Response(JSON.stringify({ ok: true, loggedOut: true }), {
          status: 200,
          headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'set-cookie': cookieValue('tasun_session_v4', '', { maxAge: 0 }) }, cors)
        });
      }

      // Public auth snapshot (no secrets)
      if (path === '/api/auth/public') {
        if (request.method !== 'GET') return json({ ok: false, error: 'METHOD' }, 405, cors);
        const data = await buildAuthTableData(env);
        return json({ ok: true, data }, 200, cors);
      }

      // Full auth snapshot: Access session OR bearer token
      if (path === '/api/auth/table') {
        if (request.method !== 'GET') return json({ ok: false, error: 'METHOD' }, 405, cors);
        // Credential hashes are never returned by an API. Only an administrator
        // may read the full auth/permission table; public snapshots remain
        // available through /api/auth/public without credential fields.
        const session = await requireSession(request, env, { requireAdmin: true, allowAccessHeader: true });
        if (!session.ok) return json({ ok: false, error: session.error }, 401, cors);
        const data = await buildAuthTableData(env);
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

      if (path === '/api/tasun/release-version') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);

        const releaseAuth = await requireReleaseAdmin(request, env);
        if (!releaseAuth.ok) {
          return json({
            ok: false,
            error: releaseAuth.error || 'UNAUTH',
            checks: releaseAuth.checks || {}
          }, 401, cors);
        }

        const body = await readJson(request);
        const workflow = norm(body.workflow || env.GITHUB_WORKFLOW_FILE || 'release-version.yml');
        const ref = norm(body.ref || env.GITHUB_REF || 'main');
        const owner = norm(env.GITHUB_OWNER || 'Wutasun');
        const repo = norm(env.GITHUB_REPO || 'Tasun');
        const token = norm(env.GITHUB_TOKEN || env.GH_TOKEN || env.GITHUB_PAT || '');
        if (!owner || !repo || !workflow || !ref || !token) {
          return json({ ok: false, error: 'RELEASE_ENV_MISSING' }, 500, cors);
        }

        const gh = await dispatchGitHubWorkflow({ owner, repo, workflow, ref, token });
        if (!gh.ok) {
          return json({ ok: false, error: gh.error || 'GITHUB_DISPATCH_FAILED', detail: gh.detail || '' }, gh.status || 500, cors);
        }
        return json({
          ok: true,
          me: releaseAuth.me,
          owner,
          repo,
          workflow,
          ref,
          run_id: gh.run_id || '',
          dispatch_id: gh.dispatch_id || '',
          githubStatus: gh.status || 204,
          dispatchedAt: Date.now(),
          accepted: true
        }, 200, cors);
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
          passHash = norm(old?.pass_hash) || norm(env.DEFAULT_PASSWORD_HASH);
        }
        if (!passHash) return json({ ok: false, error: 'PASSWORD_REQUIRED' }, 400, cors);
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

        const rows = dedupeHydratedRows((rs.results || []).map(hydrateRow));
        return json({ ok: true, resourceKey, rows }, 200, cors);
      }

      if (path === '/api/tasun/merge') {
        if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405, cors);
        if (!(me && (me.r === 'write' || me.r === 'admin'))) return json({ ok: false, error: 'FORBIDDEN' }, 403, cors);
        const body = await readJson(request);
        const resourceKey = norm(body.resourceKey);
        const payload = body.payload || {};
        const db = Array.isArray(payload.db) ? payload.db : (Array.isArray(payload.rows) ? payload.rows : (Array.isArray(body.rows) ? body.rows : (Array.isArray(body.db) ? body.db : [])));
        if (!resourceKey) return json({ ok: false, error: 'BAD_INPUT' }, 400, cors);

        let count = 0;
        const now = Date.now();
        const incomingRows = normalizeIncomingRows(db, resourceKey, now);
        for (const item of incomingRows) {
          if (!item || typeof item !== 'object') continue;
          const uid = norm(item.uid || item.pk || item.uuid || item.sourceId || item.key);
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
        const rows = dedupeHydratedRows((rs.results || []).map(hydrateRow));
        return json({ ok: true, resourceKey, count, rows }, 200, cors);
      }

      return json({ ok: false, error: 'NOT_FOUND', path }, 404, cors);
    } catch (err) {
      return json({ ok: false, error: 'INTERNAL', detail: String(err && err.message ? err.message : err) }, 500, cors);
    }
  }
};



async function ensureSchema(env) {
  if (!env || !env.DB) throw new Error('D1_DB_BINDING_MISSING');
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS tasun_users (
          username TEXT PRIMARY KEY,
          pass_hash TEXT,
          role TEXT DEFAULT 'read',
          enabled INTEGER DEFAULT 1,
          createdAt INTEGER DEFAULT 0,
          updatedAt INTEGER DEFAULT 0
        )
      `).run();
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS tasun_auth (
          username TEXT PRIMARY KEY,
          role TEXT DEFAULT 'read',
          btn1 INTEGER DEFAULT 0,
          btn2 INTEGER DEFAULT 0,
          btn3 INTEGER DEFAULT 0,
          btn4 INTEGER DEFAULT 0,
          btn5 INTEGER DEFAULT 0,
          updatedAt INTEGER DEFAULT 0
        )
      `).run();
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS tasun_rows (
          resourceKey TEXT NOT NULL,
          uid TEXT NOT NULL,
          data TEXT,
          updatedAt INTEGER DEFAULT 0,
          rev INTEGER DEFAULT 0,
          deleted INTEGER DEFAULT 0,
          PRIMARY KEY (resourceKey, uid)
        )
      `).run();
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS tasun_store (
          id TEXT PRIMARY KEY,
          json TEXT,
          updatedAt TEXT,
          rev TEXT
        )
      `).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tasun_rows_resource_updated ON tasun_rows(resourceKey, updatedAt)`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tasun_rows_resource_deleted ON tasun_rows(resourceKey, deleted)`).run();
      await seedDefaultUsers(env);
      return true;
    })().catch(err => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  return schemaReadyPromise;
}

async function seedDefaultUsers(env) {
  const passHash = norm(env.DEFAULT_PASSWORD_HASH);
  if (!passHash) return;
  const now = Date.now();
  const defaults = [
    { username: 'alex', role: 'admin', flags: [1,1,1,1,1] },
    { username: 'tasun', role: 'write', flags: [1,1,1,1,1] },
    { username: 'wu', role: 'read', flags: [1,0,0,0,0] },
  ];
  for (const item of defaults) {
    await env.DB.prepare(`
      INSERT INTO tasun_users(username, pass_hash, role, enabled, createdAt, updatedAt)
      VALUES(?, ?, ?, 1, ?, ?)
      ON CONFLICT(username) DO NOTHING
    `).bind(item.username, passHash, item.role, now, now).run();
    await env.DB.prepare(`
      INSERT INTO tasun_auth(username, role, btn1, btn2, btn3, btn4, btn5, updatedAt)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO NOTHING
    `).bind(item.username, item.role, item.flags[0], item.flags[1], item.flags[2], item.flags[3], item.flags[4], now).run();
  }
}


async function requireReleaseAdmin(request, env) {
  const session = await requireSession(request, env, { requireAdmin: true, allowAccessHeader: true });
  if (session.ok) {
    return { ok: true, me: session.me, checks: { bySession: true, byBearerMap: false, byFixedToken: false, byHintHeader: false } };
  }

  const hintedUser = norm(request.headers.get('x-tasun-user'));
  const hintedRole = normalizeRole(request.headers.get('x-tasun-role'));
  const providedFixedToken = norm(request.headers.get('x-tasun-release-token'));
  const expectedFixedToken = norm(env.TASUN_RELEASE_TOKEN || '');
  const adminUsers = String(env.TASUN_ADMIN_USERS || 'alex,JOYCE').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const byFixedToken = !!expectedFixedToken && !!providedFixedToken && providedFixedToken === expectedFixedToken;
  const byHintHeader = !!hintedUser && hintedRole === 'admin' && adminUsers.includes(String(hintedUser).toLowerCase());

  const auth = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  let byBearerMap = false;
  let mappedMe = null;
  if (auth.startsWith('Bearer ')) {
    const bearer = auth.slice(7).trim();
    const rawMap = String(env.TASUN_BEARER_ADMIN_MAP || '').trim();
    if (bearer && rawMap) {
      const pairs = rawMap.split('|').map(x => String(x || '').trim()).filter(Boolean);
      for (const item of pairs) {
        const [token, user, role] = item.split(':');
        if (String(token || '').trim() && String(token || '').trim() === bearer) {
          const mu = norm(user);
          const mr = normalizeRole(role || 'read');
          if (mu && mr === 'admin') {
            byBearerMap = true;
            mappedMe = { u: mu, r: mr, exp: Date.now() + 60 * 60 * 1000, source: 'bearer-map' };
            break;
          }
        }
      }
    }
  }

  if (mappedMe) {
    return { ok: true, me: mappedMe, checks: { bySession: false, byBearerMap, byFixedToken, byHintHeader } };
  }

  if (byFixedToken && byHintHeader) {
    return {
      ok: true,
      me: { u: hintedUser, r: 'admin', exp: Date.now() + 60 * 60 * 1000, source: 'release-header' },
      checks: { bySession: false, byBearerMap: false, byFixedToken, byHintHeader }
    };
  }

  return {
    ok: false,
    error: session.error || 'UNAUTH',
    checks: { bySession: false, byBearerMap, byFixedToken, byHintHeader }
  };
}

async function dispatchGitHubWorkflow({ owner, repo, workflow, ref, token }) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'tasun-worker-release-dispatch'
    },
    body: JSON.stringify({ ref })
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    return { ok: false, status: res.status, error: 'GITHUB_DISPATCH_FAILED', detail: text.slice(0, 600) };
  }
  // GitHub workflow_dispatch commonly returns 204 No Content.
  return { ok: true, status: res.status, dispatch_id: `gh_${Date.now()}` };
}

async function buildAuthTableData(env) {
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
  const names = Array.from(new Set([...authMap.keys(), ...userMap.keys()]))
    // Revoked users stay in D1 for audit and reseed protection, but do not re-enter
    // the editable snapshot unless an administrator explicitly re-adds them.
    .filter(username => {
      const user = userMap.get(username);
      const auth = authMap.get(username);
      return !(user && Number(user.enabled ?? 1) === 0 && !auth);
    })
    .sort((a, b) => a.localeCompare(b));

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
  if (!payload || !Array.isArray(payload.auth)) throw new Error('AUTH_SNAPSHOT_REQUIRED');
  const now = Date.now();
  const authList = payload.auth;

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
  const submittedUsernames = new Set();
  const records = [];

  // Validate and prepare the complete snapshot before staging any D1 writes.
  for (const item of authList) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('INVALID_AUTH_SNAPSHOT');
    const username = norm(item.username || item.user || item.name);
    if (!username || submittedUsernames.has(username)) throw new Error('INVALID_AUTH_SNAPSHOT');
    submittedUsernames.add(username);

    const oldUser = userMap.get(username) || null;
    const oldAuth = authMap.get(username) || null;
    const role = normalizeRole(item.role || oldAuth?.role || oldUser?.role || 'read');
    // Cached hashes are snapshots, not password-change requests. Keep the authoritative
    // D1 hash unless the client explicitly marks a password edit.
    let passHash = norm(oldUser?.pass_hash);
    if (item.passwordChanged === true) {
      let requestedPassHash = norm(item.passHash || item.passwordHash || item.hash || item.pass_hash);
      if (!requestedPassHash && item.pass) requestedPassHash = await sha256Hex(String(item.pass));
      if (!requestedPassHash) throw new Error('PASSWORD_REQUIRED');
      passHash = requestedPassHash;
    } else if (!oldUser) {
      passHash = norm(item.passHash || item.passwordHash || item.hash || item.pass_hash);
      if (!passHash && item.pass) passHash = await sha256Hex(String(item.pass));
    }
    if (!passHash) passHash = norm(env.DEFAULT_PASSWORD_HASH);
    if (!passHash) throw new Error('PASSWORD_REQUIRED');

    let enabled;
    if (item.enabled !== undefined && item.enabled !== null) {
      enabled = item.enabled === false || String(item.enabled) === '0' ? 0 : 1;
    } else if (!oldUser || (Number(oldUser.enabled) === 0 && !oldAuth)) {
      // Re-adding a revoked account without an enabled field restores access.
      enabled = 1;
    } else {
      enabled = Number(oldUser.enabled ?? 1) === 0 ? 0 : 1;
    }

    const createdAt = Number(oldUser?.createdAt || now);
    const flags = normalizeBtnFlags(item, role, oldAuth);
    records.push({ username, role, passHash, enabled, createdAt, flags });
  }

  if (!records.some(record => record.role === 'admin' && record.enabled === 1)) {
    throw new Error('LAST_ADMIN_REQUIRED');
  }

  const statements = [];
  for (const record of records) {
    statements.push(env.DB.prepare(`
      INSERT INTO tasun_users(username, pass_hash, role, enabled, createdAt, updatedAt)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        pass_hash=excluded.pass_hash,
        role=excluded.role,
        enabled=excluded.enabled,
        updatedAt=excluded.updatedAt
    `).bind(record.username, record.passHash, record.role, record.enabled, record.createdAt, now));

    statements.push(env.DB.prepare(`
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
    `).bind(record.username, record.role, record.flags.btn1, record.flags.btn2, record.flags.btn3, record.flags.btn4, record.flags.btn5, now));
  }

  let usersRevoked = 0;
  let authRevoked = 0;
  for (const row of currentUsers.results || []) {
    const username = norm(row.username);
    if (!username || submittedUsernames.has(username) || Number(row.enabled ?? 1) === 0) continue;
    statements.push(env.DB.prepare(
      'UPDATE tasun_users SET enabled=0, updatedAt=? WHERE username=?'
    ).bind(now, username));
    usersRevoked++;
  }
  for (const row of currentAuth.results || []) {
    const username = norm(row.username);
    if (!username || submittedUsernames.has(username)) continue;
    statements.push(env.DB.prepare(
      'DELETE FROM tasun_auth WHERE username=?'
    ).bind(username));
    authRevoked++;
  }

  const storeEntries = [
    [STORE_KEYS.navButtons, payload.navButtons ?? []],
    [STORE_KEYS.routes, payload.routes ?? {}],
    [STORE_KEYS.btnMeta, payload.btnMeta ?? []],
    [STORE_KEYS.permMatrix, payload.permMatrix ?? { users: {} }],
    [STORE_KEYS.entrySelected, payload.entrySelected ?? 'index.html'],
    [STORE_KEYS.entryRegistry, payload.entryRegistry ?? []],
  ];
  for (const [id, value] of storeEntries) {
    statements.push(env.DB.prepare(`
      INSERT INTO tasun_store(id, json, updatedAt, rev)
      VALUES(?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        json=excluded.json,
        updatedAt=excluded.updatedAt,
        rev=excluded.rev
    `).bind(id, JSON.stringify(value ?? null), String(now), String(now)));
  }

  // D1 batch runs the full snapshot atomically; any failed statement rolls back all changes.
  await env.DB.batch(statements);

  return {
    updatedAt: now,
    usersSaved: records.length,
    authSaved: records.length,
    usersRevoked,
    authRevoked,
  };
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


function normalizeIncomingRows(list, resourceKey = '', now = Date.now()) {
  const map = new Map();
  for (const raw of (Array.isArray(list) ? list : [])) {
    if (!raw || typeof raw !== 'object') continue;
    const clone = { ...raw };
    const uid = norm(clone.uid || clone.pk || clone.uuid || clone.sourceId || clone.key || stableRowKey(clone, resourceKey));
    if (!uid) continue;
    const updatedAt = Number(clone.updatedAt || clone.rev || now) || now;
    const rev = Number(clone.rev || updatedAt) || updatedAt;
    clone.uid = uid;
    clone.pk = norm(clone.pk || uid) || uid;
    clone.updatedAt = updatedAt;
    clone.rev = rev;
    clone.deleted = !!clone.deleted;
    const logical = logicalRowKey(clone, resourceKey);
    const old = map.get(logical);
    if (!old || updatedAt > Number(old.updatedAt || 0) || (updatedAt === Number(old.updatedAt || 0) && rev >= Number(old.rev || 0))) {
      map.set(logical, clone);
    }
  }
  return Array.from(map.values());
}

function dedupeHydratedRows(rows) {
  const map = new Map();
  for (const row of (Array.isArray(rows) ? rows : [])) {
    if (!row || typeof row !== 'object') continue;
    const logical = logicalRowKey(row, row.resourceKey || '');
    const old = map.get(logical);
    const ts = Number(row.updatedAt || 0);
    const rev = Number(row.rev || 0);
    if (!old || ts > Number(old.updatedAt || 0) || (ts === Number(old.updatedAt || 0) && rev >= Number(old.rev || 0))) {
      map.set(logical, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function logicalRowKey(row, resourceKey = '') {
  const rk = norm(resourceKey || row.resourceKey || '');
  const tableId = norm(row.tableId || row.table_id || row.dbName || row.db_name || '');
  const sourceId = norm(row.sourceId || row.source_id || row.buttonId || row.button_id || row.key || '');
  if (sourceId) return [rk, tableId, 'source', sourceId.toLowerCase()].join('::');
  const uid = norm(row.uid || row.pk || row.uuid || '');
  if (uid) return [rk, tableId, 'uid', uid].join('::');
  return [rk, tableId, 'hash', stableRowKey(row, rk)].join('::');
}

function stableRowKey(row, resourceKey = '') {
  const src = JSON.stringify(row || {}, Object.keys(row || {}).filter(k => !['updatedAt','rev','deleted','_deleted'].includes(k)).sort());
  let h = 2166136261;
  const text = String(resourceKey || '') + '|' + src;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'row_' + (h >>> 0).toString(16);
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

  // Re-check account state and role on every protected request so an issued
  // token cannot retain access after the D1 account is disabled or demoted.
  // Cloudflare Access keeps its existing identity/role mapping behavior.
  let authorizedMe = me;
  if (me.source !== 'access') {
    const username = norm(me.u);
    if (!username) return { ok: false, error: 'UNAUTH' };
    const user = await getUser(env, username);
    if (!user || Number(user.enabled || 0) !== 1) {
      return { ok: false, error: 'UNAUTH' };
    }
    const auth = await getAuth(env, username);
    authorizedMe = { ...me, u: username, r: normalizeRole(auth?.role || user.role || 'read') };
  }

  if (opts.requireAdmin && normalizeRole(authorizedMe.r) !== 'admin') {
    return { ok: false, error: 'FORBIDDEN' };
  }
  return { ok: true, me: authorizedMe };
}

const ACCESS_JWKS_CACHE = { at: 0, url: '', jwks: null };

async function verifyAccessAssertion(request, env) {
  try {
    const token = request.headers.get('Cf-Access-Jwt-Assertion') || getCookie(request, 'CF_Authorization');
    const teamDomain = norm(env.TEAM_DOMAIN).replace(/\/+$/, '');
    const audience = norm(env.POLICY_AUD);
    if (!token || !teamDomain || !audience) return null;

    const teamUrl = new URL(teamDomain);
    if (teamUrl.protocol !== 'https:') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(new TextDecoder().decode(accessBase64UrlBytes(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(accessBase64UrlBytes(parts[1])));
    if (!header || header.alg !== 'RS256' || !header.kid || !payload) return null;

    const issuer = new URL(String(payload.iss || ''));
    if (issuer.origin !== teamUrl.origin) return null;

    const aud = payload.aud;
    if (!(Array.isArray(aud) ? aud.includes(audience) : aud === audience)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(Number(payload.exp)) || Number(payload.exp) <= now) return null;
    if (payload.nbf !== undefined && (!Number.isFinite(Number(payload.nbf)) || Number(payload.nbf) > now)) return null;

    const jwks = await getAccessJwks(teamDomain);
    const key = (jwks.keys || []).find(item => item.kid === header.kid && (!item.use || item.use === 'sig'));
    if (!key) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const signature = accessBase64UrlBytes(parts[2]);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signed)) return null;

    const email = String(payload.email || '').trim();
    if (!email) return null;
    return { email, exp: Number(payload.exp) };
  } catch (_) {
    return null;
  }
}

async function getAccessJwks(teamDomain) {
  const url = teamDomain + '/cdn-cgi/access/certs';
  const now = Date.now();
  if (ACCESS_JWKS_CACHE.jwks && ACCESS_JWKS_CACHE.url === url && now - ACCESS_JWKS_CACHE.at < 10 * 60 * 1000) {
    return ACCESS_JWKS_CACHE.jwks;
  }
  const response = await fetch(url, { cf: { cacheTtl: 600, cacheEverything: true } });
  if (!response.ok) throw new Error('ACCESS_JWKS_FETCH_FAILED');
  const jwks = await response.json();
  ACCESS_JWKS_CACHE.at = now;
  ACCESS_JWKS_CACHE.url = url;
  ACCESS_JWKS_CACHE.jwks = jwks;
  return jwks;
}

function accessBase64UrlBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function parseSession(request, env, opts = {}) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const me = await verifyToken(env, token);
    if (me) return me;
  }

  // r85：相容 GitHub Pages 前端 token bridge 可能使用的多種 header。
  const tokenHeaderNames = ['x-tasun-token','x-tasun-auth-token','x-tasun-worker-token','x-worker-token','x-api-key','x-tasun-api-key'];
  for (const name of tokenHeaderNames) {
    const token = norm(request.headers.get(name));
    if (!token) continue;
    const me = await verifyToken(env, token.replace(/^Bearer\s+/i, ''));
    if (me) return { ...me, source: name };
  }

  // r23：login 成功後同步寫入 Worker HttpOnly cookie；Read/Merge 即使前端 token 遺失，也可用 cookie 驗證。
  const cookieToken = getCookie(request, 'tasun_session_v4');
  if (cookieToken) {
    const me = await verifyToken(env, cookieToken);
    if (me) return { ...me, source: 'cookie' };
  }

  // Preserve the existing Tasun Pages session bridge. Authorization is
  // rechecked against D1 below in requireSession for non-Access sessions.
  const bridged = await parseBrowserSessionBridge(request, env);
  if (bridged) return bridged;

  if (opts.allowAccessHeader) {
    const access = await verifyAccessAssertion(request, env);
    if (access) {
      const email = String(access.email || '').trim();
      const local = email.split('@')[0] || 'access';
      return {
        u: String(env.ACCESS_DEFAULT_USERNAME || local),
        r: normalizeRole(env.ACCESS_DEFAULT_ROLE || 'admin'),
        exp: Number(access.exp) * 1000,
        accessEmail: email,
        source: 'access',
      };
    }
  }

  return null;
}

async function parseBrowserSessionBridge(request, env) {
  try {
    if (String(env.TASUN_ALLOW_BROWSER_SESSION_BRIDGE || '0') !== '1') return null;
    let body = {};
    try { body = await readJson(request.clone()); } catch (_) { body = {}; }
    const nestedAuth = (body && typeof body === 'object' && (body.sessionBridgePayload || body.auth || body.session || body.bridgePayload || body.payloadAuth)) || {};
    const bridge = decodeHeaderValue(request.headers.get('x-tasun-session-bridge') || body.sessionBridge || body.bridge || body.authMode || nestedAuth.sessionBridge || nestedAuth.bridge || nestedAuth.authMode);
    if (!isAllowedOrigin(request, env)) return null;
    const pageKey = decodeHeaderValue(request.headers.get('x-tasun-page-key') || body.pageKey || body.page_key || nestedAuth.pageKey || nestedAuth.page_key);
    const pageFile = decodeHeaderValue(request.headers.get('x-tasun-page-file') || body.pageFile || body.page_file || nestedAuth.pageFile || nestedAuth.page_file);
    const resourceKey = decodeHeaderValue(request.headers.get('x-tasun-resource-key') || body.resourceKey || body.resource || body.key || nestedAuth.resourceKey || nestedAuth.resource || nestedAuth.key);
    const officialRaci = /捷運汐東線權責分工精簡版\.html|raci-sxdh-simple/i.test(pageKey + ' ' + pageFile + ' ' + resourceKey);
    const officialDetailList = /捷運汐止東湖線統包工程-資料明細表\.html|sxdh-package-detail-list|sxdh_package_detail_list/i.test(pageKey + ' ' + pageFile + ' ' + resourceKey);
    // R501：延續 R489 汐東收發文三頁與 official-documents；支援 text/plain JSON、sessionBridgePayload/auth 巢狀橋接。
    // R489：汐東收發文三頁與 official-documents 也屬於 Tasun 正式頁。
    // 目的：前端已由 index.html 登入並送出 x-tasun-session-bridge / x-tasun-user / x-tasun-role 時，
    // Worker 需依同源白名單與 D1 權限表完成橋接，避免 read/merge 因 401/403 造成頁面顯示「連線待確認」。
    const officialDocuments = /汐東收發文明細表\.html|汐東收發文登錄表\.html|汐東回覆文登錄表\.html|收發文明細表\.html|收發文登錄表\.html|回覆文登錄表\.html|xidong-official-doc-detail|xidong-official-doc-register|xidong-official-reply-register|official-doc-detail|official-doc-register|official-reply-register|official-documents/i.test(pageKey + ' ' + pageFile + ' ' + resourceKey);
    const officialTasunPage = officialRaci || officialDetailList || officialDocuments;
    /* R414：正式頁/測試頁有時只有 body 內 page/resource/user/role，或測試工具沒有帶完整 header；
       同源 GitHub Pages + 正式 resource 即視為首頁 token bridge。 */
    if (!bridge && !officialTasunPage) return null;

    const hintedRoleRaw = decodeHeaderValue(request.headers.get('x-tasun-role') || body.bridgeRole || body.role || body.level || nestedAuth.bridgeRole || nestedAuth.role || nestedAuth.level || nestedAuth.permission);
    const hintedUserRaw = decodeHeaderValue(request.headers.get('x-tasun-user') || body.bridgeUser || body.user || body.username || body.name || body.account || nestedAuth.bridgeUser || nestedAuth.user || nestedAuth.username || nestedAuth.name || nestedAuth.account || nestedAuth.uid);
    const hintedRole = normalizeRole(hintedRoleRaw || (String(hintedUserRaw || '').toLowerCase() === 'alex' ? 'admin' : 'read'));
    let username = normalizeBridgeUsername(norm(hintedUserRaw), hintedRole, env);
    if (!username && officialTasunPage) username = normalizeBridgeUsername(hintedRole === 'admin' ? 'admin' : hintedRole, hintedRole, env);
    if (!username && officialTasunPage) username = normalizeBridgeUsername('alex', 'admin', env);
    if (!username) return null;

    let user = await getUser(env, username).catch(() => null);
    let auth = await getAuth(env, username).catch(() => null);
    if (!user && !auth) {
      const alias = normalizeBridgeUsername(hintedRole === 'admin' ? 'admin' : hintedRole, hintedRole, env);
      if (alias && alias !== username) {
        const au = await getUser(env, alias).catch(() => null);
        const aa = await getAuth(env, alias).catch(() => null);
        if (au || aa) { username = alias; user = au; auth = aa; }
      }
    }
    if (user && Number(user.enabled || 0) !== 1) return null;

    // r146：GitHub Pages 正式頁與測試頁會送 x-tasun-session-bridge。
    // 若 D1 權限表尚未完整同步，但來源已在 CORS 白名單內，允許依預設帳號映射通過，
    // 避免前端已登入卻因舊 token / 權限表暫未讀回而 read/merge 固定 401。
    if (!user && !auth) {
      const strict = String(env.TASUN_BROWSER_SESSION_BRIDGE_STRICT || '1') === '1';
      if (strict) return null;
      let r = normalizeRole(hintedRole || 'read');
      username = normalizeBridgeUsername(username || r, r, env);
      const lu = String(username || '').toLowerCase();
      if (lu === 'alex' || lu === 'joyce') r = 'admin';
      if (lu === 'tasun' && r === 'read') r = 'write';
      return {
        u: username,
        r,
        exp: Date.now() + 60 * 60 * 1000,
        source: 'browser-session-bridge-r146-fallback',
        bridge,
      };
    }

    const role = normalizeRole(auth?.role || user?.role || hintedRole || 'read');
    return {
      u: username,
      r: role,
      exp: Date.now() + 60 * 60 * 1000,
      source: 'browser-session-bridge-r146',
      bridge,
    };
  } catch (_) {
    return null;
  }
}


function normalizeBridgeUsername(username, role, env) {
  let u = norm(username);
  const r = normalizeRole(role || 'read');
  const adminUsers = String(env.TASUN_ADMIN_USERS || 'alex,JOYCE')
    .split(',')
    .map(s => norm(s).toLowerCase())
    .filter(Boolean);
  const primaryAdmin = adminUsers[0] || 'alex';
  if (!u || (u.toLowerCase() === 'admin' && r === 'admin')) return primaryAdmin;
  if (u.toLowerCase() === 'write' && r === 'write') return 'tasun';
  if (u.toLowerCase() === 'read' && r === 'read') return 'wu';
  return u;
}


function allowedOrigins(env) {
  return String(env.CORS_ALLOW_ORIGINS || 'https://wutasun.github.io')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function isAllowedOrigin(request, env) {
  const list = allowedOrigins(env);
  const origin = request.headers.get('Origin') || '';
  if (origin && (list.includes('*') || list.includes(origin))) return true;
  // r146：部分同源/測試情境可能沒有 Origin，但會有 Referer；以 Referer origin 補判定。
  const referer = request.headers.get('Referer') || request.headers.get('referer') || '';
  try {
    if (referer) {
      const ro = new URL(referer).origin;
      if (list.includes('*') || list.includes(ro)) return true;
    }
  } catch (_) {}
  return false;
}

function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || request.headers.get('cookie') || '';
  const key = String(name || '') + '=';
  for (const part of raw.split(';')) {
    const item = part.trim();
    if (item.startsWith(key)) return decodeURIComponent(item.slice(key.length));
  }
  return '';
}

function cookieValue(name, value, { maxAge = 8 * 60 * 60 } = {}) {
  const v = encodeURIComponent(String(value || ''));
  return `${name}=${v}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${Number(maxAge || 0)}`;
}

function normalizeRole(role) {
  const r = String(role || 'read').trim().toLowerCase();
  if (r === 'admin' || r === 'write' || r === 'read') return r;
  return 'read';
}

function norm(v) {
  return String(v || '').trim();
}

function decodeHeaderValue(v) {
  v = norm(v);
  if (!v) return '';
  try {
    if (/%[0-9A-Fa-f]{2}/.test(v)) return decodeURIComponent(v);
  } catch (_) {}
  return v;
}

async function readJson(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch (_) {}
    try {
      const params = new URLSearchParams(text);
      const jsonText = params.get('json') || params.get('payload') || '';
      if (jsonText) return JSON.parse(jsonText);
    } catch (_) {}
    return {};
  } catch (_) {
    return {};
  }
}

function json(obj, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(obj), { status, headers: h });
}

function isStagingPreviewCorsOriginAllowed(origin, env) {
  const projectDomain = String(env.STAGING_PREVIEW_CORS_PROJECT_DOMAIN || '')
    .trim()
    .toLowerCase()
    .replace(/^\\./, '');
  if (!projectDomain || !origin) return false;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    const suffix = '.' + projectDomain;
    if (parsed.protocol !== 'https:' || parsed.origin !== origin || !hostname.endsWith(suffix)) return false;
    const previewLabel = hostname.slice(0, -suffix.length);
    return Boolean(previewLabel) && !previewLabel.includes('.');
  } catch (_) {
    return false;
  }
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowList = String(env.CORS_ALLOW_ORIGINS || 'https://wutasun.github.io')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const isAllowed = allowList.includes(origin) || isStagingPreviewCorsOriginAllowed(origin, env);
  const allowOrigin = isAllowed ? origin : (allowList[0] || 'https://wutasun.github.io');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,authorization,cache-control,pragma,x-tasun-release-token,x-tasun-user,x-tasun-role,x-tasun-session-bridge,x-tasun-page-key,x-tasun-page-file,x-tasun-resource-key,x-tasun-token,x-tasun-auth-token,x-tasun-worker-token,x-worker-token,x-api-key,x-tasun-api-key,x-tasun-client',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

async function signToken(env, payload) {
  if (!validAuthSecret(env)) throw new Error('AUTH_CONFIGURATION');
  const header = { alg: 'HS256', typ: 'TJWT' };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const msg = h + '.' + p;
  const sig = await hmacSha256B64Url(env.AUTH_SECRET, msg);
  return msg + '.' + sig;
}

async function verifyToken(env, token) {
  if (!validAuthSecret(env) || !token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const msg = h + '.' + p;
  const expect = await hmacSha256B64Url(env.AUTH_SECRET, msg);
  if (sig !== expect) return null;
  let payload = null;
  try { payload = JSON.parse(atobUrl(p)); } catch (_) { return null; }
  if (!payload || !payload.u || !payload.r) return null;
  if (payload.exp && Date.now() > Number(payload.exp)) return null;
  return payload;
}

function validAuthSecret(env) {
  return !!env && typeof env.AUTH_SECRET === 'string'
    && env.AUTH_SECRET.length >= 32 && env.AUTH_SECRET.trim().length >= 32;
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
