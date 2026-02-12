/**
 * tasun-api/worker.js  (Cloud D1 + Access)  [STANDARD v1]
 * - D1 JSON records store (resource + uid)
 * - Cloudflare Access JWT verify (Cf-Access-Jwt-Assertion or CF_Authorization cookie)
 * - CORS allow GitHub Pages origin (echo preflight requested headers)
 *
 * ✅ STANDARD v1:
 *   - pk locked to "uid"
 *   - required fields: uid, rev, updatedAt, deleted
 *   - id is display-only (never forced)
 *   - merge returns FULL dataset (server is source of truth)
 *
 * Endpoints:
 *   GET  /health
 *   GET  /api/read?key=RESOURCE_KEY&since=MS(optional)
 *   POST /api/merge      body:{ key, items:[...]}  (also supports body.local.items / rows / db)
 *
 * Backward compatible (still supported):
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
  headers.set("cache-control", "no-store");
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
      msg: "Missing Access token (need Cf-Access-Jwt-Assertion or CF_Authorization cookie). Frontend fetch must use credentials:'include' (cookie) or pass Access Service Token to Access so it injects JWT."
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

function safeJsonParse(s) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

// ---------- STANDARD v1 helpers (uid) ----------
function normStr(v) { return String(v ?? "").trim(); }

// fnv1a 32-bit
function fnv1a(str) {
  str = String(str || "");
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// stable stringify with sorted keys (deterministic)
function stableStringify(obj, depth = 6) {
  if (depth <= 0) return '"[depth]"';
  if (obj === null) return "null";
  const t = typeof obj;
  if (t === "string") return JSON.stringify(obj);
  if (t === "number" || t === "boolean") return String(obj);
  if (t !== "object") return JSON.stringify(String(obj));

  if (Array.isArray(obj)) {
    return "[" + obj.map(x => stableStringify(x, depth - 1)).join(",") + "]";
  }

  const keys = Object.keys(obj).sort();
  const parts = [];
  for (const k of keys) parts.push(JSON.stringify(k) + ":" + stableStringify(obj[k], depth - 1));
  return "{" + parts.join(",") + "}";
}

function randomUid() {
  try { return crypto.randomUUID(); } catch {}
  return "u" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
}

// ✅ 僅在「舊資料搬移」才 stable-hash（有 legacy id 才做），避免新資料不同裝置碰撞
function buildStableUidFromLegacy(item) {
  const legacyId = normStr(item?.id || item?.k || item?.key || item?.pk || item?._id);
  if (!legacyId) return "";

  const clone = { ...(item || {}) };
  delete clone.uid; delete clone.rev; delete clone.updatedAt; delete clone.createdAt;
  const sig = "v1|legacy=" + legacyId + "|fp=" + stableStringify(clone, 6);
  return "u_" + fnv1a(sig);
}

function ensureStandardFields(item, now) {
  if (!item || typeof item !== "object") return item;

  // uid
  let uid = normStr(item.uid);
  if (!uid) {
    const stable = buildStableUidFromLegacy(item);
    uid = stable || randomUid();
    item.uid = uid;
  } else {
    item.uid = uid;
  }

  // deleted
  if (item.deleted === undefined || item.deleted === null) item.deleted = false;
  item.deleted = !!item.deleted;

  // createdAt / updatedAt
  if (!item.createdAt) item.createdAt = iso(now);
  if (!item.updatedAt) item.updatedAt = iso(now);

  // rev
  let rv = Number(item.rev);
  if (!Number.isFinite(rv) || rv < 0) rv = 0;
  item.rev = rv;

  return item;
}

// Accept body.items / body.rows / body.db / body.local.items (cloud-kit v1)
function extractItemsFromBody(body) {
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

function requirePkUid(pk) {
  const v = normStr(pk || "uid") || "uid";
  // STANDARD v1: always uid (ignore others)
  return "uid";
}

function normIncomingRow(r, now) {
  if (!r || typeof r !== "object") return null;

  // ensure standard
  ensureStandardFields(r, now);

  const uid = normStr(r.uid);
  if (!uid) return null;

  const rev = Number(r.rev || 0) || 0;
  const updatedAtMs = toMs(r.updatedAt) || now;
  const createdAtMs = toMs(r.createdAt) || now;
  const deleted = r.deleted ? 1 : 0;

  // store normalized json (keep id display-only as provided, NEVER force)
  const dataObj = { ...r };
  dataObj.uid = uid;
  dataObj.rev = rev;
  dataObj.updatedAt = iso(updatedAtMs);
  dataObj.createdAt = iso(createdAtMs);
  if (deleted) dataObj.deleted = true; else delete dataObj.deleted;

  return { uid, rev, updatedAtMs, createdAtMs, deleted, data: JSON.stringify(dataObj) };
}

// ---------- D1 operations ----------
async function listRows(env, resource, sinceMs) {
  let sql = `SELECT uid, data, updated_at, created_at, rev, deleted
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
    const obj = safeJsonParse(x.data);
    obj.uid = String(x.uid || "").trim();

    // ensure required fields exist in payload
    obj.rev = Number(obj.rev ?? x.rev ?? 0) || 0;
    obj.updatedAt = obj.updatedAt ? String(obj.updatedAt) : iso(Number(x.updated_at || 0) || nowMs());
    obj.createdAt = obj.createdAt ? String(obj.createdAt) : iso(Number(x.created_at || 0) || nowMs());
    obj.deleted = !!(obj.deleted || x.deleted);

    return obj;
  });

  const maxUpdatedAtMs = (rs.results || []).reduce((m, r) => Math.max(m, Number(r.updated_at || 0) || 0), 0);

  return { rows, maxUpdatedAtMs };
}

async function upsertRows(env, resource, incoming) {
  const now = nowMs();

  for (const r of incoming) {
    const n = normIncomingRow(r, now);
    if (!n) continue;

    await env.DB.prepare(`
      INSERT INTO records(resource, uid, data, updated_at, created_at, rev, deleted)
      VALUES(?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(resource, uid) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at,
        rev = excluded.rev,
        deleted = excluded.deleted
      WHERE (excluded.rev > records.rev)
         OR (excluded.rev = records.rev AND excluded.updated_at >= records.updated_at)
    `).bind(resource, n.uid, n.data, n.updatedAtMs, n.createdAtMs, n.rev, n.deleted).run();
  }
}

// ---------- main ----------
export default {
  async fetch(req, env) {
    // ✅ preflight
    if (req.method === "OPTIONS") {
      return corsify(req, env, new Response("", { status: 204 }));
    }

    try {
      // Access verify
      const v = await verifyAccess(req, env);
      if (!v.ok) return corsify(req, env, json({ ok: false, error: v.msg }, { status: v.status }));

      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, "");

      // health (new + old)
      if (pathname === "/health" || pathname === "/api/health" || pathname === "/api/healthz") {
        return corsify(req, env, json({ ok: true, ts: nowMs() }));
      }

      // ===== NEW: GET /api/read?key=xxx&since=ms =====
      if (req.method === "GET" && pathname === "/api/read") {
        const key = normStr(url.searchParams.get("key"));
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

      // ===== NEW: POST /api/merge =====
      if (req.method === "POST" && pathname === "/api/merge") {
        const body = await req.json().catch(() => ({}));
        const key = normStr(body.key || url.searchParams.get("key"));
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));

        // STANDARD v1: pk always uid (ignore others)
        requirePkUid(body.pk);

        const items = extractItemsFromBody(body) || [];
        await upsertRows(env, key, items);

        // return full dataset
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

      // GET /api/tasun/pull?key=xxx&since=123
      if (req.method === "GET" && pathname === "/api/tasun/pull") {
        const key = normStr(url.searchParams.get("key"));
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));

        const since = Number(url.searchParams.get("since") || 0) || 0;
        const out = await listRows(env, key, since);

        return corsify(req, env, json({
          ok: true,
          key,
          pk: "uid",
          rows: out.rows,
          items: out.rows,
          db: out.rows,
          counter: out.rows.length,
          serverTime: nowMs()
        }));
      }

      // POST /api/tasun/merge?key=xxx  body:{rows:[...]}
      if (req.method === "POST" && pathname === "/api/tasun/merge") {
        const key = normStr(url.searchParams.get("key"));
        if (!key) return corsify(req, env, json({ ok: false, error: "Missing key" }, { status: 400 }));

        const body = await req.json().catch(() => ({}));
        const rows = Array.isArray(body.rows) ? body.rows : [];

        await upsertRows(env, key, rows);

        const out = await listRows(env, key, 0);
        return corsify(req, env, json({
          ok: true,
          key,
          pk: "uid",
          rows: out.rows,
          items: out.rows,
          db: out.rows,
          counter: out.rows.length,
          serverTime: nowMs()
        }));
      }

      // GET /api/db/:resource?since=123
      const m1 = pathname.match(/^\/api\/db\/([^\/]+)$/);
      if (req.method === "GET" && m1) {
        const resource = decodeURIComponent(m1[1]);
        const since = Number(url.searchParams.get("since") || 0) || 0;
        const out = await listRows(env, resource, since);
        return corsify(req, env, json({
          ok: true,
          resource,
          pk: "uid",
          rows: out.rows,
          items: out.rows,
          db: out.rows,
          counter: out.rows.length,
          serverTime: nowMs()
        }));
      }

      // POST /api/db/:resource/merge  body:{rows:[...]}
      const m2 = pathname.match(/^\/api\/db\/([^\/]+)\/merge$/);
      if (req.method === "POST" && m2) {
        const resource = decodeURIComponent(m2[1]);
        const body = await req.json().catch(() => ({}));
        const rows = Array.isArray(body.rows) ? body.rows : [];

        await upsertRows(env, resource, rows);

        const out = await listRows(env, resource, 0);
        return corsify(req, env, json({
          ok: true,
          resource,
          pk: "uid",
          rows: out.rows,
          items: out.rows,
          db: out.rows,
          counter: out.rows.length,
          serverTime: nowMs()
        }));
      }

      return corsify(req, env, json({ ok: false, error: "Not found" }, { status: 404 }));
    } catch (e) {
      const status = Number(e && e.status) || 500;
      return corsify(req, env, json({ ok: false, error: String(e && e.message ? e.message : e) }, { status }));
    }
  }
};
