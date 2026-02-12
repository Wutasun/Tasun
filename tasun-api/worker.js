/**
 * tasun-api/worker.js  (Cloud D1 + Access, STANDARD v1)
 * - D1 JSON records store (resource + uid)
 * - Cloudflare Access JWT verify (Cf-Access-Jwt-Assertion or CF_Authorization cookie)
 * - CORS allow GitHub Pages origin (echo preflight requested headers)
 *
 * ✅ STANDARD v1 (Global rule):
 * - pk locked to "uid"
 * - required fields: uid, rev, updatedAt, deleted (createdAt recommended)
 * - "id" is display-only inside JSON data (NOT pk)
 *
 * ✅ Endpoints (match tasun-cloud-kit.js):
 *   GET  /health
 *   GET  /api/read?key=RESOURCE_KEY&since=MS(optional)
 *   POST /api/merge body:{ key, pk:"uid", items:[...] }  (also accepts rows/db/local.items)
 *
 * ✅ Backward compatible endpoints kept:
 *   GET  /api/health, /api/healthz
 *   GET  /api/tasun/pull?key=...&since=...
 *   POST /api/tasun/merge?key=... body:{ rows:[...] }
 *   GET  /api/db/:resource?since=...
 *   POST /api/db/:resource/merge body:{ rows:[...] }
 *
 * 📌 DB schema note (minimal migration):
 * - We keep table column name "id" as PRIMARY KEY column.
 * - BUT we store uid into records.id (so existing schema can remain).
 */

const JWKS_CACHE = { at: 0, jwks: null };
const SCHEMA_CACHE = { at: 0, checked: false, hasRev: false };

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

function buildCors(req, env) {
  const origin = getOrigin(req);
  const reqHdrs = req.headers.get("Access-Control-Request-Headers") || "";

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
  let token = req.headers.get("Cf-Access-Jwt-Assertion") || "";
  if (!token) token = getCookie(req, "CF_Authorization");

  if (!token) {
    return {
      ok: false,
      status: 401,
      msg: "Missing Access token (need Cf-Access-Jwt-Assertion or CF_Authorization cookie)."
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
  if (/^\d{10,}$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const d = Date.parse(s);
  return Number.isFinite(d) ? d : 0;
}

function iso(ms) {
  try { return new Date(ms).toISOString(); } catch { return new Date().toISOString(); }
}

function extractItems(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    if (body.local && typeof body.local === "object") {
      if (Array.isArray(body.local.items)) return body.local.items;
      if (Array.isArray(body.local.rows)) return body.local.rows;
      if (Array.isArray(body.local.db)) return body.local.db;
    }
    if (Array.isArray(body.items)) return body.items;
    if (Array.isArray(body.rows)) return body.rows;
    if (Array.isArray(body.db)) return body.db;
    if (Array.isArray(body.data)) return body.data;
  }
  return [];
}

// ===== stable uid (migration only) =====
// If uid missing but legacy id exists, derive a stable uid by hashing legacy + fingerprint.
// This matches your tasun-cloud-kit.js [STANDARD v1.1 PATCHED] approach.
function fnv1a(str) {
  str = String(str || "");
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let hex = (h >>> 0).toString(16);
  while (hex.length < 8) hex = "0" + hex;
  return hex;
}

function stableStringify(obj, depth = 6) {
  if (depth <= 0) return '"[depth]"';
  if (obj === null) return "null";
  const t = typeof obj;
  if (t === "string") return JSON.stringify(obj);
  if (t === "number" || t === "boolean") return String(obj);
  if (t !== "object") return JSON.stringify(String(obj));

  if (Array.isArray(obj)) {
    return "[" + obj.map(v => stableStringify(v, depth - 1)).join(",") + "]";
  }

  const keys = Object.keys(obj).sort();
  const parts = keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k], depth - 1));
  return "{" + parts.join(",") + "}";
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function buildStableUidFromLegacy(item) {
  const legacyId = firstNonEmpty(item.id, item.k, item.key, item.pk, item._id);
  if (!legacyId) return "";

  const clone = { ...item };
  delete clone.uid; delete clone.rev; delete clone.updatedAt; delete clone.createdAt;
  const sig = "v1|legacy=" + String(legacyId) + "|fp=" + stableStringify(clone, 6);
  return "u_" + fnv1a(sig);
}

function randomUid() {
  try { return crypto.randomUUID(); } catch {}
  return "u" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
}

function ensureStandardV1(item) {
  const t = nowMs();
  const nowIso = iso(t);

  if (!item || typeof item !== "object") return null;

  // uid (pk)
  let uid = String(item.uid || "").trim();
  if (!uid) {
    const stable = buildStableUidFromLegacy(item);
    uid = stable || ""; // ✅ no legacy => do NOT server-generate new uid silently (avoid duplicates)
  }
  if (!uid) return { ok: false, error: 'Missing "uid" (STANDARD v1). Please upgrade page to TasunCloudKit STANDARD v1.' };

  item.uid = uid;

  // deleted
  if (item.deleted === undefined || item.deleted === null) item.deleted = false;
  item.deleted = !!item.deleted;

  // createdAt / updatedAt
  if (!item.createdAt) item.createdAt = nowIso;
  if (!item.updatedAt) item.updatedAt = nowIso;

  // rev
  let rv = Number(item.rev);
  if (!Number.isFinite(rv) || rv < 0) rv = 0;
  item.rev = rv;

  return { ok: true, uid, item };
}

function requirePkUid(pk) {
  const v = String(pk || "uid").trim();
  if (v !== "uid") {
    const err = new Error(`pk must be "uid" (received: "${v}")`);
    err.status = 400;
    throw err;
  }
  return "uid";
}

async function ensureSchema(env) {
  const now = Date.now();
  if (SCHEMA_CACHE.checked && (now - SCHEMA_CACHE.at) < 10 * 60 * 1000) return SCHEMA_CACHE;

  const rs = await env.DB.prepare("PRAGMA table_info(records)").all();
  const cols = (rs.results || []).map(r => String(r.name || ""));
  SCHEMA_CACHE.hasRev = cols.includes("rev");
  SCHEMA_CACHE.checked = true;
  SCHEMA_CACHE.at = now;
  return SCHEMA_CACHE;
}

async function listRows(env, resource, sinceMs) {
  const sch = await ensureSchema(env);

  let sql = sch.hasRev
    ? `SELECT id, data, updated_at, created_at, deleted, rev
       FROM records
       WHERE resource = ?`
    : `SELECT id, data, updated_at, created_at, deleted
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

    // pk uid comes from records.id
    obj.uid = String(x.id || "").trim() || String(obj.uid || "").trim();

    // ensure required fields exist in payload
    const uMs = Number(x.updated_at || 0) || 0;
    const cMs = Number(x.created_at || 0) || 0;

    if (!obj.updatedAt) obj.updatedAt = uMs ? iso(uMs) : iso(nowMs());
    if (!obj.createdAt) obj.createdAt = cMs ? iso(cMs) : iso(nowMs());
    obj.deleted = !!(x.deleted || obj.deleted);

    const rev = sch.hasRev ? Number(x.rev || 0) || 0 : Number(obj.rev || 0) || 0;
    obj.rev = rev;

    return obj;
  });

  const maxUpdatedAtMs = (rs.results || []).reduce((m, r) => Math.max(m, Number(r.updated_at || 0) || 0), 0);

  return { rows, maxUpdatedAtMs };
}

async function upsertRows(env, resource, incoming) {
  const sch = await ensureSchema(env);
  const t = nowMs();

  for (const r0 of incoming) {
    if (!r0 || typeof r0 !== "object") continue;

    // enforce standard fields
    const chk = ensureStandardV1(r0);
    if (!chk || chk.ok === false) {
      const err = new Error(chk && chk.error ? chk.error : "Invalid item");
      err.status = 400;
      throw err;
    }

    const r = chk.item;
    const uid = chk.uid;

    const updatedMs = toMs(r.updatedAt) || t;
    const createdMs = toMs(r.createdAt) || t;
    const deleted = r.deleted ? 1 : 0;
    const rev = Number(r.rev || 0) || 0;

    // store pk(uid) into records.id column (schema compatible)
    // keep display-only "id" inside JSON if present (do not overwrite)
    const dataObj = { ...r };
    dataObj.uid = uid;
    dataObj.updatedAt = iso(updatedMs);
    dataObj.createdAt = iso(createdMs);
    dataObj.deleted = !!r.deleted;
    dataObj.rev = rev;

    const data = JSON.stringify(dataObj);

    if (sch.hasRev) {
      await env.DB.prepare(`
        INSERT INTO records(resource, id, data, updated_at, created_at, deleted, rev)
        VALUES(?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(resource, id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted,
          rev = excluded.rev
        WHERE excluded.updated_at > records.updated_at
           OR (excluded.updated_at = records.updated_at AND excluded.rev >= records.rev)
      `).bind(resource, uid, data, updatedMs, createdMs, deleted, rev).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO records(resource, id, data, updated_at, created_at, deleted)
        VALUES(?, ?, ?, ?, ?, ?)
        ON CONFLICT(resource, id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted
        WHERE excluded.updated_at >= records.updated_at
      `).bind(resource, uid, data, updatedMs, createdMs, deleted).run();
    }
  }
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return corsify(req, env, new Response("", { status: 204 }));
    }

    try {
      const v = await verifyAccess(req, env);
      if (!v.ok) return corsify(req, env, json({ ok: false, error: v.msg }, { status: v.status }));

      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, "");

      // ===== health (new + old) =====
      if (pathname === "/health" || pathname === "/api/health" || pathname === "/api/healthz") {
        return corsify(req, env, json({ ok: true, ts: nowMs() }));
      }

      // ===== NEW: GET /api/read?key=xxx&since=ms =====
      if (req.method === "GET" && pathname === "/api/read") {
        const key = String(url.searchParams.get("key") || "").trim();
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));

        const since = Number(url.searchParams.get("since") || 0) || 0;
        const out = await listRows(env, key, since);

        const ver = out.maxUpdatedAtMs || 1;
        const updatedAt = out.maxUpdatedAtMs ? iso(out.maxUpdatedAtMs) : iso(nowMs());

        return corsify(req, env, json({
          ok: true,
          key,
          pk: "uid",
          ver,
          updatedAt,
          items: out.rows,
          rows: out.rows,
          db: out.rows,
          counter: out.rows.length,
          serverTime: nowMs()
        }));
      }

      // ===== NEW: POST /api/merge body:{key, pk:"uid", items:[...]} =====
      if (req.method === "POST" && pathname === "/api/merge") {
        const body = await req.json().catch(() => ({}));
        const key = String(body.key || url.searchParams.get("key") || "").trim();
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));

        requirePkUid(body.pk || "uid");

        const items = extractItems(body) || [];
        if (!Array.isArray(items)) {
          return corsify(req, env, json({ ok: false, error: "Invalid items" }, { status: 400 }));
        }

        await upsertRows(env, key, items);

        const out = await listRows(env, key, 0);
        const ver = out.maxUpdatedAtMs || 1;
        const updatedAt = out.maxUpdatedAtMs ? iso(out.maxUpdatedAtMs) : iso(nowMs());

        return corsify(req, env, json({
          ok: true,
          key,
          pk: "uid",
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

      if (req.method === "GET" && pathname === "/api/tasun/pull") {
        const key = String(url.searchParams.get("key") || "").trim();
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));
        const since = Number(url.searchParams.get("since") || 0) || 0;

        const out = await listRows(env, key, since);
        return corsify(req, env, json({ ok: true, key, rows: out.rows, serverTime: nowMs() }));
      }

      if (req.method === "POST" && pathname === "/api/tasun/merge") {
        const key = String(url.searchParams.get("key") || "").trim();
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));

        const body = await req.json().catch(() => ({}));
        const rows = Array.isArray(body.rows) ? body.rows : [];

        // accept legacy rows, but require uid or legacy id
        await upsertRows(env, key, rows);

        const out = await listRows(env, key, 0);
        return corsify(req, env, json({ ok: true, key, rows: out.rows, serverTime: nowMs() }));
      }

      const m1 = pathname.match(/^\/api\/db\/([^\/]+)$/);
      if (req.method === "GET" && m1) {
        const resource = decodeURIComponent(m1[1]);
        const since = Number(url.searchParams.get("since") || 0) || 0;
        const out = await listRows(env, resource, since);
        return corsify(req, env, json({ ok: true, resource, rows: out.rows, serverTime: nowMs() }));
      }

      const m2 = pathname.match(/^\/api\/db\/([^\/]+)\/merge$/);
      if (req.method === "POST" && m2) {
        const resource = decodeURIComponent(m2[1]);
        const body = await req.json().catch(() => ({}));
        const rows = Array.isArray(body.rows) ? body.rows : [];

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
