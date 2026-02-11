/**
 * tasun-api/worker.js  (Cloud D1 + Access, pk locked to "id")
 * - D1 JSON records store (resource + id)
 * - Cloudflare Access JWT verify (Cf-Access-Jwt-Assertion or CF_Authorization cookie)
 * - CORS allow GitHub Pages origin (echo preflight requested headers)
 *
 * ✅ Added endpoints to match tasun-cloud-kit.js + tasun-resources.json:
 *   GET  /health
 *   GET  /api/read?key=RESOURCE_KEY&since=MS(optional)
 *   POST /api/merge      body:{ key, pk:"id", items:[...] }
 *
 * ✅ Backward compatible endpoints kept:
 *   GET  /api/health, /api/healthz
 *   GET  /api/tasun/pull?key=...&since=...
 *   POST /api/tasun/merge?key=... body:{ rows:[...] }
 *   GET  /api/db/:resource?since=...
 *   POST /api/db/:resource/merge  body:{ rows:[...] }
 */

const JWKS_CACHE = { at: 0, jwks: null }; // in-memory cache

function json(obj, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(obj), { ...init, headers });
}

function getOrigin(req) {
  return req.headers.get("Origin") || "";
}

function getCookie(req, name) {
  const c = req.headers.get("Cookie") || "";
  if (!c) return "";
  const parts = c.split(/;\s*/);
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i <= 0) continue;
    const k = p.slice(0, i).trim();
    if (k === name) return p.slice(i + 1).trim();
  }
  return "";
}

/** ✅ CORS: echo Access-Control-Request-Headers */
function buildCors(req, env) {
  const origin = getOrigin(req);
  const reqHdrs = req.headers.get("Access-Control-Request-Headers") || "";

  // 若 env.ALLOWED_ORIGIN 沒設，預設放行 GitHub Pages
  const allowOrigin = (env && env.ALLOWED_ORIGIN)
    ? String(env.ALLOWED_ORIGIN)
    : "https://wutasun.github.io";

  const outOrigin = (origin && origin === allowOrigin) ? origin : allowOrigin;

  return {
    "Access-Control-Allow-Origin": outOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": reqHdrs || "content-type",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
  };
}

function corsify(req, env, res) {
  const h = new Headers(res.headers);
  const cors = buildCors(req, env);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

function b64urlToU8(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function parseJwt(token) {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) throw new Error("bad jwt");
  const header = JSON.parse(new TextDecoder().decode(b64urlToU8(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToU8(p)));
  const sig = b64urlToU8(s);
  const signed = new TextEncoder().encode(`${h}.${p}`);
  return { header, payload, sig, signed };
}

async function fetchJwks(env) {
  const now = Date.now();
  if (JWKS_CACHE.jwks && (now - JWKS_CACHE.at) < 10 * 60 * 1000) return JWKS_CACHE.jwks;

  const url = `${env.TEAM_DOMAIN.replace(/\/+$/, "")}/cdn-cgi/access/certs`;
  const r = await fetch(url, { cf: { cacheTtl: 600, cacheEverything: true } });
  if (!r.ok) throw new Error("jwks fetch failed");
  const jwks = await r.json();

  JWKS_CACHE.at = now;
  JWKS_CACHE.jwks = jwks;
  return jwks;
}

async function verifyAccess(req, env) {
  // ✅ 先吃 header（Access 注入），沒有再吃 cookie（很多環境會用 CF_Authorization）
  let token = req.headers.get("Cf-Access-Jwt-Assertion") || "";
  if (!token) token = getCookie(req, "CF_Authorization");

  if (!token) {
    return {
      ok: false,
      status: 401,
      msg: "Missing Access token (need Cf-Access-Jwt-Assertion or CF_Authorization cookie). Try login Access, and frontend fetch must use credentials:'include' (cookie) or pass Access Service Token through Access (then Access injects JWT)."
    };
  }

  let header, payload, sig, signed;
  try {
    ({ header, payload, sig, signed } = parseJwt(token));
  } catch {
    return { ok: false, status: 401, msg: "Bad Access JWT" };
  }

  const aud = payload.aud;
  const iss = payload.iss;
  const exp = payload.exp;

  if (!aud || (Array.isArray(aud) ? !aud.includes(env.POLICY_AUD) : aud !== env.POLICY_AUD)) {
    return { ok: false, status: 403, msg: "Access AUD not allowed" };
  }
  if (!iss || !iss.startsWith(env.TEAM_DOMAIN.replace(/\/+$/, ""))) {
    return { ok: false, status: 403, msg: "Access ISS not allowed" };
  }
  if (typeof exp === "number" && (Date.now() / 1000) > exp) {
    return { ok: false, status: 401, msg: "Access JWT expired" };
  }

  const jwks = await fetchJwks(env);
  const key = (jwks.keys || []).find(k => k.kid === header.kid);
  if (!key) return { ok: false, status: 403, msg: "Access key not found" };

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sig, signed);
  if (!ok) return { ok: false, status: 403, msg: "Access JWT signature invalid" };

  return { ok: true, payload };
}

function nowMs() { return Date.now(); }

function toMs(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return 0;
  // numeric string
  if (/^\d{10,}$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  // ISO date string
  const d = Date.parse(s);
  return Number.isFinite(d) ? d : 0;
}

function iso(ms) {
  try { return new Date(ms).toISOString(); } catch { return new Date().toISOString(); }
}

function extractItems(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    if (Array.isArray(body.items)) return body.items;
    if (Array.isArray(body.rows)) return body.rows;
    if (Array.isArray(body.db)) return body.db;
    if (Array.isArray(body.data)) return body.data;
  }
  return [];
}

function normRow(r) {
  if (!r || typeof r !== "object") return null;
  const id = String(r.id || "").trim();
  if (!id) return null;

  const updatedAtMs = toMs(r.updatedAt || r._updatedAtMs || r.updated_at || r._updatedAt || 0);
  const createdAtMs = toMs(r.createdAt || r._createdAtMs || r.created_at || r._createdAt || 0);

  const deleted = r.deleted ? 1 : 0;
  return { id, updatedAtMs, createdAtMs, deleted, raw: r };
}

async function listRows(env, resource, sinceMs) {
  let sql = `SELECT id, data, updated_at, created_at, deleted
             FROM records
             WHERE resource = ?`;
  const args = [resource];

  if (sinceMs && Number.isFinite(sinceMs) && sinceMs > 0) {
    sql += ` AND updated_at > ?`;
    args.push(sinceMs);
  }
  sql += ` ORDER BY updated_at ASC`;

  const rs = await env.DB.prepare(sql).bind(...args).all();

  const rows = (rs.results || []).map(x => {
    let obj = {};
    try { obj = JSON.parse(x.data || "{}"); } catch { obj = {}; }

    // always enforce id
    obj.id = x.id;

    // keep ISO in payload (frontend-friendly)
    const uMs = Number(x.updated_at || 0) || 0;
    const cMs = Number(x.created_at || 0) || 0;
    obj.updatedAt = obj.updatedAt ? String(obj.updatedAt) : (uMs ? iso(uMs) : iso(nowMs()));
    obj.createdAt = obj.createdAt ? String(obj.createdAt) : (cMs ? iso(cMs) : iso(nowMs()));
    if (x.deleted) obj.deleted = true;

    return obj;
  });

  const maxUpdatedAtMs = (rs.results || []).reduce((m, r) => Math.max(m, Number(r.updated_at || 0) || 0), 0);

  return { rows, maxUpdatedAtMs };
}

async function upsertRows(env, resource, incoming) {
  const t = nowMs();

  for (const r of incoming) {
    const n = normRow(r);
    if (!n) continue;

    const updated = n.updatedAtMs > 0 ? n.updatedAtMs : t;
    const created = n.createdAtMs > 0 ? n.createdAtMs : t;

    const dataObj = { ...n.raw };
    dataObj.id = n.id;

    // store ISO strings in JSON (consistent with frontend)
    dataObj.updatedAt = iso(updated);
    dataObj.createdAt = iso(created);
    if (n.deleted) dataObj.deleted = true;

    const data = JSON.stringify(dataObj);

    await env.DB.prepare(`
      INSERT INTO records(resource, id, data, updated_at, created_at, deleted)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(resource, id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at,
        deleted = excluded.deleted
      WHERE excluded.updated_at >= records.updated_at
    `).bind(resource, n.id, data, updated, created, n.deleted).run();
  }
}

function requirePkId(pk) {
  const v = String(pk || "id").trim();
  if (v !== "id") {
    const err = new Error(`pk must be "id" (received: "${v}")`);
    err.status = 400;
    throw err;
  }
  return "id";
}

function requireAllHaveId(items) {
  let bad = 0;
  for (const it of items) {
    if (!it || typeof it !== "object") { bad++; continue; }
    const id = String(it.id || "").trim();
    if (!id) bad++;
  }
  if (bad > 0) {
    const err = new Error(`All items must include non-empty "id". Invalid count: ${bad}`);
    err.status = 400;
    throw err;
  }
}

export default {
  async fetch(req, env) {
    // ✅ preflight 一定先處理
    if (req.method === "OPTIONS") {
      return corsify(req, env, new Response("", { status: 204 }));
    }

    try {
      // Access verify
      const v = await verifyAccess(req, env);
      if (!v.ok) return corsify(req, env, json({ ok: false, error: v.msg }, { status: v.status }));

      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, "");

      // ===== health (new + old) =====
      if (pathname === "/health") {
        return corsify(req, env, json({ ok: true, ts: nowMs() }));
      }
      if (pathname === "/api/health" || pathname === "/api/healthz") {
        return corsify(req, env, json({ ok: true, ts: nowMs() }));
      }

      // ===== NEW: GET /api/read?key=xxx&since=ms =====
      if (req.method === "GET" && pathname === "/api/read") {
        const key = url.searchParams.get("key") || "";
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));

        const since = Number(url.searchParams.get("since") || 0) || 0;
        const out = await listRows(env, key, since);

        const ver = out.maxUpdatedAtMs || 1;
        const updatedAt = out.maxUpdatedAtMs ? iso(out.maxUpdatedAtMs) : iso(nowMs());

        return corsify(req, env, json({
          ok: true,
          key,
          ver,
          updatedAt,
          items: out.rows,    // ✅ for tasun-cloud-kit.js
          rows: out.rows,     // ✅ compat
          db: out.rows,       // ✅ compat
          counter: out.rows.length,
          serverTime: nowMs()
        }));
      }

      // ===== NEW: POST /api/merge  body:{key, pk:"id", items:[...]} =====
      if (req.method === "POST" && pathname === "/api/merge") {
        const body = await req.json().catch(() => ({}));
        const key = String(body.key || url.searchParams.get("key") || "").trim();
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));

        requirePkId(body.pk || "id");

        const items = extractItems(body) || [];
        requireAllHaveId(items);

        await upsertRows(env, key, items);

        const out = await listRows(env, key, 0);
        const ver = out.maxUpdatedAtMs || 1;
        const updatedAt = out.maxUpdatedAtMs ? iso(out.maxUpdatedAtMs) : iso(nowMs());

        return corsify(req, env, json({
          ok: true,
          key,
          ver,
          updatedAt,
          items: out.rows,
          rows: out.rows,
          db: out.rows,
          counter: out.rows.length,
          serverTime: nowMs()
        }));
      }

      // ===== Backward compatible endpoints =====

      // ✅ 相容前端：GET /api/tasun/pull?key=xxx&since=123
      if (req.method === "GET" && pathname === "/api/tasun/pull") {
        const key = url.searchParams.get("key") || "";
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));
        const since = Number(url.searchParams.get("since") || 0) || 0;

        const out = await listRows(env, key, since);
        return corsify(req, env, json({ ok: true, key, rows: out.rows, serverTime: nowMs() }));
      }

      // ✅ 相容前端：POST /api/tasun/merge?key=xxx  body:{rows:[...]}
      if (req.method === "POST" && pathname === "/api/tasun/merge") {
        const key = url.searchParams.get("key") || "";
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));

        const body = await req.json().catch(() => ({}));
        const rows = Array.isArray(body.rows) ? body.rows : [];

        // 強制 id（避免舊頁用 k 造成污染）
        requireAllHaveId(rows);

        await upsertRows(env, key, rows);
        const out = await listRows(env, key, 0);
        return corsify(req, env, json({ ok: true, key, rows: out.rows, serverTime: nowMs() }));
      }

      // ✅ 原本 API 仍保留：GET /api/db/:resource?since=123
      const m1 = pathname.match(/^\/api\/db\/([^\/]+)$/);
      if (req.method === "GET" && m1) {
        const resource = decodeURIComponent(m1[1]);
        const since = Number(url.searchParams.get("since") || 0) || 0;
        const out = await listRows(env, resource, since);
        return corsify(req, env, json({ ok: true, resource, rows: out.rows, serverTime: nowMs() }));
      }

      // ✅ 原本 API：POST /api/db/:resource/merge
      const m2 = pathname.match(/^\/api\/db\/([^\/]+)\/merge$/);
      if (req.method === "POST" && m2) {
        const resource = decodeURIComponent(m2[1]);
        const body = await req.json().catch(() => ({}));
        const rows = Array.isArray(body.rows) ? body.rows : [];

        // 強制 id（避免舊頁用 k 造成污染）
        requireAllHaveId(rows);

        await upsertRows(env, resource, rows);
        const out = await listRows(env, resource, 0);
        return corsify(req, env, json({ ok: true, resource, rows: out.rows, serverTime: nowMs() }));
      }

      return corsify(req, env, json({ ok: false, error: "Not found" }, { status: 404 }));
    } catch (e) {
      const status = Number(e && e.status) || 500;
      return corsify(req, env, json({ ok: false, error: String(e && e.message ? e.message : e) }, { status }));
    }
  }
};
