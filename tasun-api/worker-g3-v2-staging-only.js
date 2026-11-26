var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/worker-g3-v2-staging-only.mjs
var SERVICE_VERSION = "v5.0-r501-official-documents-textplain-sessionbridge-sync-20260607";
var STORE_KEYS = {
  navButtons: "auth-table:navButtons",
  routes: "auth-table:routes",
  btnMeta: "auth-table:btnMeta",
  permMatrix: "auth-table:permMatrix",
  entrySelected: "auth-table:entrySelected",
  entryRegistry: "auth-table:entryRegistry"
};
var schemaReadyPromise = null;
var worker_g3_v2_staging_only_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response("", { status: 204, headers: cors });
    }
    if (path === "/api/tasun/release-version") {
      return new Response(JSON.stringify({ ok: false, error: "G3_STAGING_RELEASE_DISABLED" }), {
        status: 403,
        headers: { ...cors, "content-type": "application/json; charset=utf-8" }
      });
    }
    try {
      if (path === "/api/tasun/health") {
        return json({ ok: true, service: "tasun-worker", version: SERVICE_VERSION, autoVersionRelease: true, releaseEndpoint: "/api/tasun/release-version", workflow: String(env.GITHUB_WORKFLOW_FILE || "release-version.yml"), repo: String((env.GITHUB_OWNER || "Wutasun") + "/" + (env.GITHUB_REPO || "Tasun")), ts: Date.now() }, 200, cors);
      }
      await ensureSchema(env);
      if (path === "/api/tasun/login") {
        if (request.method !== "POST") return json({ ok: false, error: "METHOD" }, 405, cors);
        const body = await readJson(request);
        const username = norm(body.username);
        const password = String(body.password || "");
        if (!username || !password) return json({ ok: false, error: "BAD_INPUT" }, 400, cors);
        const user = await getUser(env, username);
        if (!user || Number(user.enabled || 0) !== 1) return json({ ok: false, error: "NO_USER" }, 401, cors);
        const passHash = await sha256Hex(password);
        if (passHash !== String(user.pass_hash || "")) {
          return json({ ok: false, error: "BAD_CRED" }, 401, cors);
        }
        const authRow = await getAuth(env, username);
        const role = normalizeRole(authRow?.role || user.role || "read");
        const exp = Date.now() + 8 * 60 * 60 * 1e3;
        const token = await signToken(env, { u: username, r: role, exp });
        const h = new Headers(cors);
        h.set("content-type", "application/json; charset=utf-8");
        h.set("set-cookie", cookieValue("tasun_session_v4", token, { maxAge: 8 * 60 * 60 }));
        return new Response(JSON.stringify({ ok: true, user: username, role, exp, token }), { status: 200, headers: h });
      }
      if (path === "/api/tasun/logout") {
        if (request.method !== "POST") return json({ ok: false, error: "METHOD" }, 405, cors);
        return new Response(JSON.stringify({ ok: true, loggedOut: true }), {
          status: 200,
          headers: Object.assign({ "content-type": "application/json; charset=utf-8", "set-cookie": cookieValue("tasun_session_v4", "", { maxAge: 0 }) }, cors)
        });
      }
      if (path === "/api/auth/public") {
        if (request.method !== "GET") return json({ ok: false, error: "METHOD" }, 405, cors);
        const data = await buildPublicAuthData(env);
        return json({ ok: true, data }, 200, cors);
      }
      if (path === "/api/auth/table") {
        if (request.method !== "GET") return json({ ok: false, error: "METHOD" }, 405, cors);
        const session2 = await requireSession(request, env, { allowAccessHeader: true });
        if (!session2.ok) return json({ ok: false, error: session2.error }, 401, cors);
        const data = await buildAuthTableData(env, { includeSecrets: true });
        return json({ ok: true, me: session2.me, data }, 200, cors);
      }
      if (path === "/api/admin/auth/table") {
        if (request.method !== "POST") return json({ ok: false, error: "METHOD" }, 405, cors);
        const session2 = await requireSession(request, env, { requireAdmin: true, allowAccessHeader: true });
        if (!session2.ok) return json({ ok: false, error: session2.error }, 401, cors);
        const body = await readJson(request);
        const result = await saveAuthTableData(env, body);
        if (!result.ok) return json({ ok: false, error: result.error }, 400, cors);
        return json({ ok: true, me: session2.me, updatedAt: result.updatedAt, usersSaved: result.usersSaved, authSaved: result.authSaved }, 200, cors);
      }
      if (path === "/api/tasun/release-version") {
        if (request.method !== "POST") return json({ ok: false, error: "METHOD" }, 405, cors);
        const releaseAuth = await requireReleaseAdmin(request, env);
        if (!releaseAuth.ok) {
          return json({
            ok: false,
            error: releaseAuth.error || "UNAUTH",
            checks: releaseAuth.checks || {}
          }, 401, cors);
        }
        const body = await readJson(request);
        const workflow = norm(body.workflow || env.GITHUB_WORKFLOW_FILE || "release-version.yml");
        const ref = norm(body.ref || env.GITHUB_REF || "main");
        const owner = norm(env.GITHUB_OWNER || "Wutasun");
        const repo = norm(env.GITHUB_REPO || "Tasun");
        const token = norm(env.GITHUB_TOKEN || env.GH_TOKEN || env.GITHUB_PAT || "");
        if (!owner || !repo || !workflow || !ref || !token) {
          return json({ ok: false, error: "RELEASE_ENV_MISSING" }, 500, cors);
        }
        const inputs = sanitizeWorkflowInputs(body.inputs || {}, releaseAuth.me);
        const gh = await dispatchGitHubWorkflow({ owner, repo, workflow, ref, token, inputs });
        if (!gh.ok) {
          return json({ ok: false, error: gh.error || "GITHUB_DISPATCH_FAILED", detail: gh.detail || "" }, gh.status || 500, cors);
        }
        return json({
          ok: true,
          me: releaseAuth.me,
          owner,
          repo,
          workflow,
          ref,
          run_id: gh.run_id || "",
          dispatch_id: gh.dispatch_id || "",
          githubStatus: gh.status || 204,
          dispatchedAt: Date.now(),
          accepted: true
        }, 200, cors);
      }
      const session = await requireSession(request, env, { allowAccessHeader: true });
      if (!session.ok) return json({ ok: false, error: session.error }, 401, cors);
      const me = session.me;
      if (path === "/api/tasun/me") {
        return json({ ok: true, user: me.u, role: me.r, exp: me.exp || null }, 200, cors);
      }
      if (path === "/api/tasun/auth/read") {
        if (request.method !== "POST") return json({ ok: false, error: "METHOD" }, 405, cors);
        const body = await readJson(request);
        const username = norm(body.username || me.u);
        if (me.r !== "admin" && username !== me.u) return json({ ok: false, error: "FORBIDDEN" }, 403, cors);
        const row = await getAuth(env, username);
        return json({ ok: true, row: row || null }, 200, cors);
      }
      if (path === "/api/tasun/auth/upsert") {
        if (request.method !== "POST") return json({ ok: false, error: "METHOD" }, 405, cors);
        if (me.r !== "admin") return json({ ok: false, error: "FORBIDDEN" }, 403, cors);
        const body = await readJson(request);
        const row = body.row || {};
        const username = norm(row.username || row.user || row.name);
        if (!username) return json({ ok: false, error: "BAD_INPUT" }, 400, cors);
        const updatedAt = Date.now();
        const role = normalizeRole(row.role || "read");
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
      if (path === "/api/tasun/users/upsert") {
        if (request.method !== "POST") return json({ ok: false, error: "METHOD" }, 405, cors);
        if (me.r !== "admin") return json({ ok: false, error: "FORBIDDEN" }, 403, cors);
        const body = await readJson(request);
        const row = body.row || {};
        const username = norm(row.username || row.user || row.name);
        const role = normalizeRole(row.role || "read");
        const enabled = row.enabled === 0 ? 0 : 1;
        if (!username) return json({ ok: false, error: "BAD_INPUT" }, 400, cors);
        const old = await getUser(env, username);
        const resolved = await resolveAccountPassHash(
          row.pass_hash || row.passHash || row.passwordHash,
          row.password || row.pass,
          old
        );
        if (!resolved.ok) return json({ ok: false, error: resolved.error }, 400, cors);
        const passHash = resolved.hash;
        const ts = Date.now();
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
      if (path === "/api/tasun/read") {
        if (request.method !== "POST") return json({ ok: false, error: "METHOD" }, 405, cors);
        const body = await readJson(request);
        const resourceKey = norm(body.resourceKey);
        if (!resourceKey) return json({ ok: false, error: "BAD_INPUT" }, 400, cors);
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
      if (path === "/api/tasun/merge") {
        if (request.method !== "POST") return json({ ok: false, error: "METHOD" }, 405, cors);
        if (!(me && (me.r === "write" || me.r === "admin"))) return json({ ok: false, error: "FORBIDDEN" }, 403, cors);
        const body = await readJson(request);
        const resourceKey = norm(body.resourceKey);
        const payload = body.payload || {};
        const db = Array.isArray(payload.db) ? payload.db : Array.isArray(payload.rows) ? payload.rows : Array.isArray(body.rows) ? body.rows : Array.isArray(body.db) ? body.db : [];
        if (!resourceKey) return json({ ok: false, error: "BAD_INPUT" }, 400, cors);
        let count = 0;
        const now = Date.now();
        const incomingRows = normalizeIncomingRows(db, resourceKey, now);
        for (const item of incomingRows) {
          if (!item || typeof item !== "object") continue;
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
      return json({ ok: false, error: "NOT_FOUND", path }, 404, cors);
    } catch (err) {
      return json({ ok: false, error: "INTERNAL", detail: String(err && err.message ? err.message : err) }, 500, cors);
    }
  }
};
async function ensureSchema(env) {
  if (!env || !env.DB) throw new Error("D1_DB_BINDING_MISSING");
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
      return true;
    })().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  return schemaReadyPromise;
}
__name(ensureSchema, "ensureSchema");
async function requireReleaseAdmin(request, env) {
  const session = await requireSession(request, env, { requireAdmin: true, allowAccessHeader: true });
  if (session.ok) {
    return { ok: true, me: session.me, checks: { bySession: true, byBearerMap: false, byFixedToken: false, byHintHeader: false } };
  }
  const hintedUser = norm(request.headers.get("x-tasun-user"));
  const hintedRole = normalizeRole(request.headers.get("x-tasun-role"));
  const providedFixedToken = norm(request.headers.get("x-tasun-release-token"));
  const expectedFixedToken = norm(env.TASUN_RELEASE_TOKEN || "");
  const adminUsers = String(env.TASUN_ADMIN_USERS || "alex,JOYCE").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const byFixedToken = !!expectedFixedToken && !!providedFixedToken && providedFixedToken === expectedFixedToken;
  const byHintHeader = !!hintedUser && hintedRole === "admin" && adminUsers.includes(String(hintedUser).toLowerCase());
  const auth = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  let byBearerMap = false;
  let mappedMe = null;
  if (auth.startsWith("Bearer ")) {
    const bearer = auth.slice(7).trim();
    const rawMap = String(env.TASUN_BEARER_ADMIN_MAP || "").trim();
    if (bearer && rawMap) {
      const pairs = rawMap.split("|").map((x) => String(x || "").trim()).filter(Boolean);
      for (const item of pairs) {
        const [token, user, role] = item.split(":");
        if (String(token || "").trim() && String(token || "").trim() === bearer) {
          const mu = norm(user);
          const mr = normalizeRole(role || "read");
          if (mu && mr === "admin") {
            byBearerMap = true;
            mappedMe = { u: mu, r: mr, exp: Date.now() + 60 * 60 * 1e3, source: "bearer-map" };
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
      me: { u: hintedUser, r: "admin", exp: Date.now() + 60 * 60 * 1e3, source: "release-header" },
      checks: { bySession: false, byBearerMap: false, byFixedToken, byHintHeader }
    };
  }
  return {
    ok: false,
    error: session.error || "UNAUTH",
    checks: { bySession: false, byBearerMap, byFixedToken, byHintHeader }
  };
}
__name(requireReleaseAdmin, "requireReleaseAdmin");
function sanitizeWorkflowInputs(inputs, me) {
  const src = inputs && typeof inputs === "object" ? inputs : {};
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    const key = String(k || "").trim();
    if (!key) continue;
    out[key] = String(v == null ? "" : v).slice(0, 300);
  }
  if (!out.actor && me && me.u) out.actor = String(me.u);
  if (!out.reason) out.reason = "admin-button";
  if (!out.write_fallbacks) out.write_fallbacks = "true";
  return out;
}
__name(sanitizeWorkflowInputs, "sanitizeWorkflowInputs");
async function dispatchGitHubWorkflow({ owner, repo, workflow, ref, token, inputs }) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "tasun-worker-release-dispatch"
    },
    body: JSON.stringify({ ref, inputs: inputs || {} })
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, error: "GITHUB_DISPATCH_FAILED", detail: text.slice(0, 600) };
  }
  return { ok: true, status: res.status, dispatch_id: `gh_${Date.now()}` };
}
__name(dispatchGitHubWorkflow, "dispatchGitHubWorkflow");
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
  const authMap = new Map((authRs.results || []).map((r) => [String(r.username), r]));
  const userMap = new Map((usersRs.results || []).map((r) => [String(r.username), r]));
  const names = Array.from(/* @__PURE__ */ new Set([...authMap.keys(), ...userMap.keys()])).sort((a, b) => a.localeCompare(b));
  const auth = names.map((username) => {
    const u = userMap.get(username) || {};
    const a = authMap.get(username) || {};
    const row = {
      user: username,
      name: username,
      role: normalizeRole(a.role || u.role || "read"),
      enabled: Number(u.enabled == null ? 1 : u.enabled),
      btn1: Number(a.btn1 || 0),
      btn2: Number(a.btn2 || 0),
      btn3: Number(a.btn3 || 0),
      btn4: Number(a.btn4 || 0),
      btn5: Number(a.btn5 || 0),
      createdAt: Number(u.createdAt || 0),
      updatedAt: Math.max(Number(u.updatedAt || 0), Number(a.updatedAt || 0))
    };
    if (includeSecrets) row.passHash = String(u.pass_hash || "");
    return row;
  });
  return {
    auth,
    navButtons: await storeGetJson(env, STORE_KEYS.navButtons, []),
    routes: await storeGetJson(env, STORE_KEYS.routes, {}),
    btnMeta: await storeGetJson(env, STORE_KEYS.btnMeta, []),
    permMatrix: await storeGetJson(env, STORE_KEYS.permMatrix, { users: {} }),
    entrySelected: await storeGetJson(env, STORE_KEYS.entrySelected, "index.html"),
    entryRegistry: await storeGetJson(env, STORE_KEYS.entryRegistry, [])
  };
}
__name(buildAuthTableData, "buildAuthTableData");
async function buildPublicAuthData(env) {
  const usersRs = await env.DB.prepare(`
    SELECT username
    FROM tasun_users
    WHERE COALESCE(enabled, 1) = 1
    ORDER BY username
  `).all();
  const usernames = Array.from(new Set((usersRs.results || []).map((row) => norm(row.username)).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
  return { auth: usernames.map((username) => ({ user: username, name: username })) };
}
__name(buildPublicAuthData, "buildPublicAuthData");
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
  const userMap = new Map((currentUsers.results || []).map((r) => [String(r.username), r]));
  const authMap = new Map((currentAuth.results || []).map((r) => [String(r.username), r]));
  const prepared = [];
  for (const item of authList) {
    if (!item || typeof item !== "object") continue;
    const username = norm(item.username || item.user || item.name);
    if (!username) continue;
    const oldUser = userMap.get(username) || null;
    const oldAuth = authMap.get(username) || null;
    const resolved = await resolveAccountPassHash(
      item.passHash || item.passwordHash || item.hash || item.pass_hash,
      item.pass || item.password,
      oldUser
    );
    if (!resolved.ok) return { ok: false, error: resolved.error };
    prepared.push({ item, username, oldUser, oldAuth, passHash: resolved.hash });
  }
  for (const { item, username, oldUser, oldAuth, passHash } of prepared) {
    const role = normalizeRole(item.role || oldAuth?.role || oldUser?.role || "read");
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
  await storePutJson(env, STORE_KEYS.entrySelected, payload.entrySelected ?? "index.html", now);
  await storePutJson(env, STORE_KEYS.entryRegistry, payload.entryRegistry ?? [], now);
  return { ok: true, updatedAt: now, usersSaved, authSaved };
}
__name(saveAuthTableData, "saveAuthTableData");
async function resolveAccountPassHash(rawHash, rawPassword, oldUser) {
  const providedHash = norm(rawHash);
  const password = String(rawPassword || "");
  if (providedHash) {
    const hash = providedHash.toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) return { ok: false, error: "INVALID_PASSWORD_HASH" };
    const currentHash = norm(oldUser?.pass_hash).toLowerCase();
    if (oldUser && currentHash && currentHash === hash) return { ok: true, hash };
    if (!password) return { ok: false, error: "PASSWORD_CHANGE_REQUIRES_PLAINTEXT" };
  }
  if (password) {
    if (password.length < 12) return { ok: false, error: "WEAK_PASSWORD" };
    return { ok: true, hash: await sha256Hex(password) };
  }
  const currentHash = norm(oldUser?.pass_hash);
  if (oldUser && currentHash) return { ok: true, hash: currentHash };
  return { ok: false, error: "PASSWORD_REQUIRED" };
}
__name(resolveAccountPassHash, "resolveAccountPassHash");
function normalizeBtnFlags(item, role, oldAuth = null) {
  const defaults = role === "read" ? { btn1: 1, btn2: 0, btn3: 0, btn4: 0, btn5: 0 } : { btn1: 1, btn2: 1, btn3: 1, btn4: 1, btn5: 1 };
  const base = oldAuth || defaults;
  return {
    btn1: toIntFlag(item.btn1, base.btn1, defaults.btn1),
    btn2: toIntFlag(item.btn2, base.btn2, defaults.btn2),
    btn3: toIntFlag(item.btn3, base.btn3, defaults.btn3),
    btn4: toIntFlag(item.btn4, base.btn4, defaults.btn4),
    btn5: toIntFlag(item.btn5, base.btn5, defaults.btn5)
  };
}
__name(normalizeBtnFlags, "normalizeBtnFlags");
function toIntFlag(value, fallback, hardDefault = 0) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  if (fallback === true || fallback === 1 || fallback === "1") return 1;
  if (fallback === false || fallback === 0 || fallback === "0") return 0;
  return hardDefault ? 1 : 0;
}
__name(toIntFlag, "toIntFlag");
async function storeGetJson(env, id, fallback) {
  try {
    const row = await env.DB.prepare("SELECT json FROM tasun_store WHERE id=?").bind(id).first();
    if (!row || row.json == null) return fallback;
    return JSON.parse(String(row.json));
  } catch (_) {
    return fallback;
  }
}
__name(storeGetJson, "storeGetJson");
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
__name(storePutJson, "storePutJson");
function normalizeIncomingRows(list, resourceKey = "", now = Date.now()) {
  const map = /* @__PURE__ */ new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== "object") continue;
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
    if (!old || updatedAt > Number(old.updatedAt || 0) || updatedAt === Number(old.updatedAt || 0) && rev >= Number(old.rev || 0)) {
      map.set(logical, clone);
    }
  }
  return Array.from(map.values());
}
__name(normalizeIncomingRows, "normalizeIncomingRows");
function dedupeHydratedRows(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const logical = logicalRowKey(row, row.resourceKey || "");
    const old = map.get(logical);
    const ts = Number(row.updatedAt || 0);
    const rev = Number(row.rev || 0);
    if (!old || ts > Number(old.updatedAt || 0) || ts === Number(old.updatedAt || 0) && rev >= Number(old.rev || 0)) {
      map.set(logical, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}
__name(dedupeHydratedRows, "dedupeHydratedRows");
function logicalRowKey(row, resourceKey = "") {
  const rk = norm(resourceKey || row.resourceKey || "");
  const tableId = norm(row.tableId || row.table_id || row.dbName || row.db_name || "");
  const sourceId = norm(row.sourceId || row.source_id || row.buttonId || row.button_id || row.key || "");
  if (sourceId) return [rk, tableId, "source", sourceId.toLowerCase()].join("::");
  const uid = norm(row.uid || row.pk || row.uuid || "");
  if (uid) return [rk, tableId, "uid", uid].join("::");
  return [rk, tableId, "hash", stableRowKey(row, rk)].join("::");
}
__name(logicalRowKey, "logicalRowKey");
function stableRowKey(row, resourceKey = "") {
  const src = JSON.stringify(row || {}, Object.keys(row || {}).filter((k) => !["updatedAt", "rev", "deleted", "_deleted"].includes(k)).sort());
  let h = 2166136261;
  const text = String(resourceKey || "") + "|" + src;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "row_" + (h >>> 0).toString(16);
}
__name(stableRowKey, "stableRowKey");
function hydrateRow(r) {
  let data = r.data;
  try {
    data = JSON.parse(String(r.data));
  } catch (_) {
  }
  return {
    resourceKey: String(r.resourceKey),
    uid: String(r.uid),
    ...typeof data === "object" && data ? data : {},
    updatedAt: Number(r.updatedAt || 0),
    rev: Number(r.rev || 0),
    deleted: !!r.deleted
  };
}
__name(hydrateRow, "hydrateRow");
async function getUser(env, username) {
  return await env.DB.prepare(`
    SELECT username, pass_hash, role, enabled, createdAt, updatedAt
    FROM tasun_users
    WHERE username=?
  `).bind(username).first();
}
__name(getUser, "getUser");
async function getAuth(env, username) {
  return await env.DB.prepare(`
    SELECT username, role, btn1, btn2, btn3, btn4, btn5, updatedAt
    FROM tasun_auth
    WHERE username=?
  `).bind(username).first();
}
__name(getAuth, "getAuth");
async function requireSession(request, env, opts = {}) {
  const tokenIdentity = await parseSession(request, env);
  if (!tokenIdentity) return { ok: false, error: "UNAUTH" };
  let me;
  try {
    me = await validateLiveSession(env, tokenIdentity);
  } catch (_) {
    return { ok: false, error: "UNAUTH" };
  }
  if (!me) return { ok: false, error: "UNAUTH" };
  if (opts.requireAdmin && me.r !== "admin") {
    return { ok: false, error: "FORBIDDEN" };
  }
  return { ok: true, me };
}
__name(requireSession, "requireSession");
async function validateLiveSession(env, tokenIdentity) {
  const username = norm(tokenIdentity?.u);
  if (!username || !Number.isFinite(Number(tokenIdentity?.exp)) || Number(tokenIdentity.exp) <= Date.now()) return null;
  const user = await getUser(env, username);
  if (!user || Number(user.enabled) !== 1) return null;
  const authRow = await getAuth(env, username);
  const currentRole = normalizeRole(authRow?.role || user.role || "read");
  const issuedRole = normalizeRole(tokenIdentity.r || "read");
  const privilege = { read: 0, write: 1, admin: 2 };
  const role = privilege[currentRole] <= privilege[issuedRole] ? currentRole : issuedRole;
  return { ...tokenIdentity, u: user.username, r: role, source: tokenIdentity.source || "signed-token-d1" };
}
__name(validateLiveSession, "validateLiveSession");
async function parseSession(request, env, opts = {}) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const me = await verifyToken(env, token);
    if (me) return me;
  }
  const tokenHeaderNames = ["x-tasun-token", "x-tasun-auth-token", "x-tasun-worker-token", "x-worker-token", "x-api-key", "x-tasun-api-key"];
  for (const name of tokenHeaderNames) {
    const token = norm(request.headers.get(name));
    if (!token) continue;
    const me = await verifyToken(env, token.replace(/^Bearer\s+/i, ""));
    if (me) return { ...me, source: name };
  }
  const cookieToken = getCookie(request, "tasun_session_v4");
  if (cookieToken) {
    const me = await verifyToken(env, cookieToken);
    if (me) return { ...me, source: "cookie" };
  }
  const bridged = await parseBrowserSessionBridge(request, env);
  if (bridged) return bridged;
  return null;
}
__name(parseSession, "parseSession");
async function parseBrowserSessionBridge(request, env) {
  try {
    if (String(env.TASUN_ALLOW_BROWSER_SESSION_BRIDGE || "0") !== "1") return null;
    if (!isAllowedOrigin(request, env)) return null;
    let body = {};
    try {
      body = await readJson(request.clone());
    } catch (_) {
      body = {};
    }
    const signedToken = norm(request.headers.get("x-tasun-session-bridge-token") || body.sessionBridgeToken);
    if (!signedToken) return null;
    const me = await verifyToken(env, signedToken.replace(/^Bearer\s+/i, ""));
    return me ? { ...me, source: "signed-browser-bridge" } : null;
  } catch (_) {
    return null;
  }
}
__name(parseBrowserSessionBridge, "parseBrowserSessionBridge");
function allowedOrigins(env) {
  return String(env.CORS_ALLOW_ORIGINS || "https://wutasun.github.io").split(",").map((s) => s.trim()).filter(Boolean);
}
__name(allowedOrigins, "allowedOrigins");
function isAllowedOrigin(request, env) {
  const list = allowedOrigins(env);
  const origin = request.headers.get("Origin") || "";
  if (origin && (list.includes("*") || list.includes(origin))) return true;
  const referer = request.headers.get("Referer") || request.headers.get("referer") || "";
  try {
    if (referer) {
      const ro = new URL(referer).origin;
      if (list.includes("*") || list.includes(ro)) return true;
    }
  } catch (_) {
  }
  return false;
}
__name(isAllowedOrigin, "isAllowedOrigin");
function getCookie(request, name) {
  const raw = request.headers.get("Cookie") || request.headers.get("cookie") || "";
  const key = String(name || "") + "=";
  for (const part of raw.split(";")) {
    const item = part.trim();
    if (item.startsWith(key)) return decodeURIComponent(item.slice(key.length));
  }
  return "";
}
__name(getCookie, "getCookie");
function cookieValue(name, value, { maxAge = 8 * 60 * 60 } = {}) {
  const v = encodeURIComponent(String(value || ""));
  return `${name}=${v}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${Number(maxAge || 0)}`;
}
__name(cookieValue, "cookieValue");
function normalizeRole(role) {
  const r = String(role || "read").trim().toLowerCase();
  if (r === "admin" || r === "write" || r === "read") return r;
  return "read";
}
__name(normalizeRole, "normalizeRole");
function norm(v) {
  return String(v || "").trim();
}
__name(norm, "norm");
async function readJson(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_) {
    }
    try {
      const params = new URLSearchParams(text);
      const jsonText = params.get("json") || params.get("payload") || "";
      if (jsonText) return JSON.parse(jsonText);
    } catch (_) {
    }
    return {};
  } catch (_) {
    return {};
  }
}
__name(readJson, "readJson");
function json(obj, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(obj), { status, headers: h });
}
__name(json, "json");
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowList = String(env.CORS_ALLOW_ORIGINS || "https://wutasun.github.io").split(",").map((s) => s.trim()).filter(Boolean);
  const allowOrigin = allowList.includes(origin) ? origin : allowList[0] || "https://wutasun.github.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization,x-tasun-release-token,x-tasun-user,x-tasun-role,x-tasun-session-bridge,x-tasun-session-bridge-token,x-tasun-page-key,x-tasun-page-file,x-tasun-resource-key,x-tasun-token,x-tasun-auth-token,x-tasun-worker-token,x-worker-token,x-api-key,x-tasun-api-key,x-tasun-client",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function requireSigningSecret(env) {
  const secret = String(env?.AUTH_SECRET || "");
  if (secret.length < 32) throw new Error("AUTH_SECRET_MISSING_OR_WEAK");
  return secret;
}
__name(requireSigningSecret, "requireSigningSecret");
async function signToken(env, payload) {
  const secret = requireSigningSecret(env);
  const header = { alg: "HS256", typ: "TJWT" };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const msg = h + "." + p;
  const sig = await hmacSha256B64Url(secret, msg);
  return msg + "." + sig;
}
__name(signToken, "signToken");
async function verifyToken(env, token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const msg = h + "." + p;
  let expect;
  try {
    expect = await hmacSha256B64Url(requireSigningSecret(env), msg);
  } catch (_) {
    return null;
  }
  if (sig !== expect) return null;
  let payload = null;
  try {
    payload = JSON.parse(atobUrl(p));
  } catch (_) {
    return null;
  }
  if (!payload || !payload.u || !["admin", "write", "read"].includes(payload.r)) return null;
  if (!Number.isFinite(Number(payload.exp)) || Number(payload.exp) <= Date.now()) return null;
  return payload;
}
__name(verifyToken, "verifyToken");
function b64url(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(b64url, "b64url");
function atobUrl(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return decodeURIComponent(escape(atob(s)));
}
__name(atobUrl, "atobUrl");
async function hmacSha256B64Url(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sigBuf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(hmacSha256B64Url, "hmacSha256B64Url");
async function sha256Hex(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(String(str || "")));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
export {
  worker_g3_v2_staging_only_default as default
};
//# sourceMappingURL=worker-g3-v2-staging-only.js.map