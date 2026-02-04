/**
 * tasun-api/worker.js
 * - D1 JSON records store
 * - Cloudflare Access JWT verify (Cf-Access-Jwt-Assertion)
 * - CORS allow credentials for GitHub Pages origin
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

function corsify(req, env, res) {
  const origin = getOrigin(req);
  const allow = env.ALLOWED_ORIGIN || "";
  const h = new Headers(res.headers);

  if (origin && allow && origin === allow) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Vary", "Origin");
    h.set("Access-Control-Allow-Credentials", "true");
    h.set("Access-Control-Allow-Headers", "content-type, cf-access-jwt-assertion");
    h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
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
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, status: 401, msg: "Missing Cf-Access-Jwt-Assertion (need Cloudflare Access login)" };

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

function normRow(r) {
  if (!r || typeof r !== "object") return null;
  const id = String(r.id || "").trim();
  if (!id) return null;
  const updatedAt = Number(r.updatedAt || r._updatedAt || 0) || 0;
  const createdAt = Number(r.createdAt || r._createdAt || 0) || 0;
  const deleted = r.deleted ? 1 : 0;
  return { id, updatedAt, createdAt, deleted, raw: r };
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
    const obj = JSON.parse(x.data);
    // 保留原資料，補上必要欄位（不影響你 UI 的欄位）
    obj.id = x.id;
    obj.updatedAt = x.updated_at;
    obj.createdAt = x.created_at;
    if (x.deleted) obj.deleted = true;
    return obj;
  });

  const maxUpdatedAt = rows.reduce((m, r) => Math.max(m, Number(r.updatedAt || 0) || 0), 0);
  return { rows, maxUpdatedAt };
}

async function upsertRows(env, resource, incoming) {
  const t = nowMs();

  for (const r of incoming) {
    const n = normRow(r);
    if (!n) continue;

    const updated = n.updatedAt > 0 ? n.updatedAt : t;
    const created = n.createdAt > 0 ? n.createdAt : t;

    const dataObj = { ...n.raw };
    dataObj.id = n.id;
    dataObj.updatedAt = updated;
    dataObj.createdAt = created;
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

export default {
  async fetch(req, env) {
    // preflight
    if (req.method === "OPTIONS") {
      return corsify(req, env, new Response(null, { status: 204 }));
    }

    try {
      // Access verify
      const v = await verifyAccess(req, env);
      if (!v.ok) return corsify(req, env, json({ ok: false, error: v.msg }, { status: v.status }));

      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, "");

      if (pathname === "/api/health") {
        return corsify(req, env, json({ ok: true, ts: nowMs() }));
      }

      // GET /api/db/:resource?since=123
      const m1 = pathname.match(/^\/api\/db\/([^\/]+)$/);
      if (req.method === "GET" && m1) {
        const resource = decodeURIComponent(m1[1]);
        const since = Number(url.searchParams.get("since") || 0) || 0;
        const out = await listRows(env, resource, since);
        return corsify(req, env, json({ ok: true, resource, ...out, serverTime: nowMs() }));
      }

      // POST /api/db/:resource/merge  body: { rows:[...] }
      const m2 = pathname.match(/^\/api\/db\/([^\/]+)\/merge$/);
      if (req.method === "POST" && m2) {
        const resource = decodeURIComponent(m2[1]);
        const body = await req.json().catch(() => ({}));
        const rows = Array.isArray(body.rows) ? body.rows : [];

        await upsertRows(env, resource, rows);
        const out = await listRows(env, resource, 0);

        return corsify(req, env, json({ ok: true, resource, ...out, serverTime: nowMs() }));
      }

      return corsify(req, env, json({ ok: false, error: "Not found" }, { status: 404 }));
    } catch (e) {
      return corsify(req, env, json({ ok: false, error: String(e && e.message ? e.message : e) }, { status: 500 }));
    }
  }
};
