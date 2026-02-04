// src/worker.js
export default {
  async fetch(request, env, ctx) {
    try {
      // --- CORS / Preflight ---
      if (request.method === "OPTIONS") {
        return corsResponse(env, 204);
      }

      const url = new URL(request.url);
      const pathname = url.pathname;

      // --- Basic routes (no auth needed) ---
      if (pathname === "/" || pathname === "/health") {
        return corsJson(env, { ok: true, name: "tasun-api", time: new Date().toISOString() });
      }

      // --- Protect API with Cloudflare Access JWT ---
      const claims = await requireAccess(request, env);

      // --- Routes ---
      // GET  /api/v1/whoami
      if (pathname === "/api/v1/whoami" && request.method === "GET") {
        return corsJson(env, { ok: true, claims });
      }

      // GET  /api/v1/db/:key
      // POST /api/v1/db/:key   { items: [...], replace?: boolean }
      const m = pathname.match(/^\/api\/v1\/db\/([^/]+)$/);
      if (m) {
        const resourceKey = decodeURIComponent(m[1]);

        if (request.method === "GET") {
          const data = await pullAll(env, resourceKey);
          return corsJson(env, { ok: true, resourceKey, ...data });
        }

        if (request.method === "POST") {
          const body = await safeJson(request);
          const items = Array.isArray(body?.items) ? body.items : null;
          const replace = !!body?.replace;

          if (!items) {
            return corsJson(env, { ok: false, error: "Body must be JSON: { items: [...] }" }, 400);
          }

          const result = await saveMerged(env, resourceKey, items, { replace, actor: pickActor(claims) });
          return corsJson(env, { ok: true, resourceKey, ...result });
        }

        return corsJson(env, { ok: false, error: "Method not allowed" }, 405);
      }

      return corsJson(env, { ok: false, error: "Not found" }, 404);
    } catch (err) {
      return corsJson(env, { ok: false, error: String(err?.message || err) }, 500);
    }
  },
};

// -------------------------
// CORS helpers
// -------------------------
function corsHeaders(env) {
  const origin = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Cf-Access-Jwt-Assertion, cf-access-jwt-assertion",
    "Access-Control-Max-Age": "86400",
    // 若你未來要用 cookie 驗證，可保留這行
    "Access-Control-Allow-Credentials": "true",
  };
}

function corsResponse(env, status = 204, body = null) {
  return new Response(body, { status, headers: corsHeaders(env) });
}

function corsJson(env, obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { ...corsHeaders(env), "Content-Type": "application/json; charset=utf-8" },
  });
}

// -------------------------
// D1: pull / saveMerged
// -------------------------
function nowISO() {
  return new Date().toISOString();
}

async function ensureResource(env, resourceKey) {
  const t = nowISO();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO resources(resource_key, rev, updated_at) VALUES(?, 0, ?)"
  )
    .bind(resourceKey, t)
    .run();
}

async function pullAll(env, resourceKey) {
  await ensureResource(env, resourceKey);

  const meta = await env.DB.prepare("SELECT rev, updated_at FROM resources WHERE resource_key=?")
    .bind(resourceKey)
    .first();

  const rows = await env.DB.prepare(
    "SELECT json FROM items WHERE resource_key=? ORDER BY updated_at ASC"
  )
    .bind(resourceKey)
    .all();

  const items = (rows?.results || []).map((r) => {
    try {
      return JSON.parse(r.json);
    } catch {
      return null;
    }
  }).filter(Boolean);

  return {
    rev: meta?.rev ?? 0,
    updated_at: meta?.updated_at ?? null,
    count: items.length,
    items,
    server_time: nowISO(),
  };
}

function genId() {
  // 產生簡短但夠用的 id
  return crypto.randomUUID();
}

async function saveMerged(env, resourceKey, items, { replace = false, actor = "" } = {}) {
  await ensureResource(env, resourceKey);

  const t = nowISO();

  // replace 模式：先清空此 resourceKey 的 items
  if (replace) {
    await env.DB.prepare("DELETE FROM items WHERE resource_key=?").bind(resourceKey).run();
  }

  const ids = [];
  const stmts = [];

  for (const it of items) {
    if (!it || typeof it !== "object") continue;

    const id = String(it.id || "").trim() || genId();
    it.id = id; // 伺服器保證 id 一定存在
    ids.push(id);

    const json = JSON.stringify(it);

    stmts.push(
      env.DB.prepare(
        `INSERT INTO items(resource_key, id, json, updated_at)
         VALUES(?, ?, ?, ?)
         ON CONFLICT(resource_key, id) DO UPDATE SET
           json=excluded.json,
           updated_at=excluded.updated_at`
      ).bind(resourceKey, id, json, t)
    );
  }

  if (stmts.length) {
    await env.DB.batch(stmts);
  }

  // 每次寫入視為一次 revision（簡單可靠）
  await env.DB.prepare("UPDATE resources SET rev = rev + 1, updated_at=? WHERE resource_key=?")
    .bind(t, resourceKey)
    .run();

  const meta = await env.DB.prepare("SELECT rev, updated_at FROM resources WHERE resource_key=?")
    .bind(resourceKey)
    .first();

  return {
    rev: meta?.rev ?? 0,
    updated_at: meta?.updated_at ?? t,
    upserted: stmts.length,
    ids,
    actor,
    server_time: nowISO(),
  };
}

async function safeJson(request) {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return await request.json();
}

// -------------------------
// Cloudflare Access JWT verification
// -------------------------
// Docs show Access JWT can be passed via header "cf-access-jwt-assertion"
// and issuer/aud should be validated. :contentReference[oaicite:2]{index=2}
// Another tutorial also mentions CF_Authorization cookie usage. :contentReference[oaicite:3]{index=3}

let _JWKS_CACHE = { at: 0, jwks: null };

function normTeamDomain(s) {
  return String(s || "").trim().replace(/\/+$/, "");
}

function getJwtFromRequest(req) {
  // 1) Access injected header
  const h =
    req.headers.get("cf-access-jwt-assertion") ||
    req.headers.get("Cf-Access-Jwt-Assertion");
  if (h) return h.trim();

  // 2) Authorization: Bearer <jwt> (for testing)
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  // 3) Cookie CF_Authorization (some setups)
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);

  return "";
}

async function requireAccess(req, env) {
  const token = getJwtFromRequest(req);
  if (!token) throw new Error("Unauthorized: missing Access JWT");

  const claims = await verifyAccessJwt(token, env);

  // Validate aud
  const aud = claims.aud;
  const requiredAud = String(env.POLICY_AUD || "").trim();
  if (!requiredAud) throw new Error("Server misconfig: POLICY_AUD is empty");

  const audOk = Array.isArray(aud) ? aud.includes(requiredAud) : String(aud) === requiredAud;
  if (!audOk) throw new Error("Unauthorized: aud mismatch");

  // Validate iss
  const iss = String(claims.iss || "");
  const team = normTeamDomain(env.TEAM_DOMAIN);
  if (!team) throw new Error("Server misconfig: TEAM_DOMAIN is empty");
  if (iss !== team) throw new Error("Unauthorized: iss mismatch");

  // exp/nbf
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && now >= claims.exp) throw new Error("Unauthorized: token expired");
  if (claims.nbf && now < claims.nbf) throw new Error("Unauthorized: token not active yet");

  return claims;
}

async function fetchJwks(env) {
  const team = normTeamDomain(env.TEAM_DOMAIN);
  const url = `${team}/cdn-cgi/access/certs`; // Access public keys endpoint :contentReference[oaicite:4]{index=4}

  const ttlMs = 10 * 60 * 1000; // 10 minutes cache
  const now = Date.now();
  if (_JWKS_CACHE.jwks && now - _JWKS_CACHE.at < ttlMs) return _JWKS_CACHE.jwks;

  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
  const jwks = await res.json();

  _JWKS_CACHE = { at: now, jwks };
  return jwks;
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlToJson(s) {
  const bytes = b64urlToBytes(s);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

async function verifyAccessJwt(token, env) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Bad JWT format");

  const header = b64urlToJson(parts[0]);
  const payload = b64urlToJson(parts[1]);
  const sig = b64urlToBytes(parts[2]);

  const jwks = await fetchJwks(env);
  const keys = jwks?.keys || [];
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("JWKS key not found for kid");

  // Access tokens are typically RS256
  if (header.alg !== "RS256") throw new Error(`Unsupported alg: ${header.alg}`);

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sig, data);
  if (!ok) throw new Error("Unauthorized: JWT signature invalid");

  return payload;
}

function pickActor(claims) {
  return (
    claims?.email ||
    claims?.upn ||
    claims?.sub ||
    ""
  );
}
