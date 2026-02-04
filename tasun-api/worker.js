export default {
  async fetch(request, env, ctx) {
    try {
      // --- CORS preflight ---
      if (request.method === "OPTIONS") return corsPreflight(request, env);

      const url = new URL(request.url);

      // health
      if (url.pathname === "/api/ping") {
        return json({ ok: true, ts: Date.now() }, 200, cors(request, env));
      }

      // --- Access auth (required for all /api/* except /api/ping) ---
      if (url.pathname.startsWith("/api/")) {
        const auth = await requireAccess(request, env);
        if (!auth.ok) return text(auth.message, auth.status, cors(request, env));

        // attach identity
        request.__auth = auth;
      }

      // --- routes ---
      if (url.pathname === "/api/me") {
        const { email, user } = request.__auth;
        return json(
          {
            ok: true,
            email,
            username: user?.username || null,
            role: user?.role || "unknown",
          },
          200,
          cors(request, env)
        );
      }

      // NOTES API
      // GET    /api/notes?limit=50&offset=0
      // POST   /api/notes
      // PUT    /api/notes/:uid
      // DELETE /api/notes/:uid

      if (url.pathname === "/api/notes" && request.method === "GET") {
        const limit = clampInt(url.searchParams.get("limit"), 1, 200, 50);
        const offset = clampInt(url.searchParams.get("offset"), 0, 1000000, 0);

        const rs = await env.DB.prepare(
          `SELECT id, uid, content, trade, system, attachment, remark, reg_date, created_at, updated_at
           FROM notes
           WHERE deleted=0
           ORDER BY id DESC
           LIMIT ?1 OFFSET ?2`
        )
          .bind(limit, offset)
          .all();

        return json({ ok: true, items: rs.results || [] }, 200, cors(request, env));
      }

      if (url.pathname === "/api/notes" && request.method === "POST") {
        enforceRole(request.__auth, ["admin", "write"]);

        const body = await request.json().catch(() => null);
        if (!body || !body.uid || !body.content) {
          return text("Bad Request: uid/content required", 400, cors(request, env));
        }

        await env.DB.prepare(
          `INSERT INTO notes (uid, content, trade, system, attachment, remark, reg_date, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`
        )
          .bind(
            String(body.uid),
            String(body.content),
            norm(body.trade),
            norm(body.system),
            body.attachment == null ? null : String(body.attachment),
            norm(body.remark),
            norm(body.reg_date)
          )
          .run();

        return json({ ok: true }, 200, cors(request, env));
      }

      const m = url.pathname.match(/^\/api\/notes\/([^/]+)$/);
      if (m && request.method === "PUT") {
        enforceRole(request.__auth, ["admin", "write"]);
        const uid = decodeURIComponent(m[1]);

        const body = await request.json().catch(() => null);
        if (!body || !body.content) {
          return text("Bad Request: content required", 400, cors(request, env));
        }

        const r = await env.DB.prepare(
          `UPDATE notes
           SET content=?1, trade=?2, system=?3, attachment=?4, remark=?5, reg_date=?6,
               updated_at=(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           WHERE uid=?7 AND deleted=0`
        )
          .bind(
            String(body.content),
            norm(body.trade),
            norm(body.system),
            body.attachment == null ? null : String(body.attachment),
            norm(body.remark),
            norm(body.reg_date),
            String(uid)
          )
          .run();

        return json({ ok: true, changes: r.changes }, 200, cors(request, env));
      }

      if (m && request.method === "DELETE") {
        enforceRole(request.__auth, ["admin", "write"]);
        const uid = decodeURIComponent(m[1]);

        const r = await env.DB.prepare(
          `UPDATE notes
           SET deleted=1, updated_at=(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           WHERE uid=?1 AND deleted=0`
        )
          .bind(String(uid))
          .run();

        return json({ ok: true, changes: r.changes }, 200, cors(request, env));
      }

      return text("Not Found", 404, cors(request, env));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return text("Server Error: " + msg, 500, cors(request, env));
    }
  },
};

// ------------------- Access JWT verify (no npm) -------------------
// Access will send Cf-Access-Jwt-Assertion header (browser may also have CF_Authorization cookie).
// Cloudflare recommends validating Cf-Access-Jwt-Assertion. :contentReference[oaicite:3]{index=3}

const jwksCache = new Map(); // key: TEAM_DOMAIN, value: {ts, jwks}

async function requireAccess(request, env) {
  if (!env.TEAM_DOMAIN || !env.POLICY_AUD) {
    return { ok: false, status: 500, message: "Missing TEAM_DOMAIN/POLICY_AUD" };
  }

  const token =
    request.headers.get("cf-access-jwt-assertion") ||
    request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, status: 403, message: "Missing CF Access JWT" };

  let payload;
  try {
    payload = await verifyAccessJwt(token, env.TEAM_DOMAIN, env.POLICY_AUD);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 403, message: "Invalid token: " + msg };
  }

  const email = payload.email || payload.upn || null;
  if (!email) return { ok: false, status: 403, message: "Token missing email" };

  // map to role in D1
  const user = await env.DB.prepare(
    `SELECT username, role, access_email FROM users WHERE access_email=?1 LIMIT 1`
  )
    .bind(String(email))
    .first();

  if (!user) {
    return {
      ok: false,
      status: 403,
      message:
        "Email not mapped in D1 users.access_email. Please set users.access_email for this email.",
      email,
    };
  }

  return { ok: true, email, user, payload };
}

async function verifyAccessJwt(token, teamDomain, policyAud) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("JWT format invalid");

  const header = JSON.parse(utf8(base64urlToBytes(parts[0])));
  const payload = JSON.parse(utf8(base64urlToBytes(parts[1])));
  const signature = base64urlToBytes(parts[2]);

  const signingInput = new TextEncoder().encode(parts[0] + "." + parts[1]);

  // claims
  if (payload.iss !== teamDomain) throw new Error("iss mismatch");
  const audOk = (() => {
    const aud = payload.aud;
    if (typeof aud === "string") return aud === policyAud;
    if (Array.isArray(aud)) return aud.includes(policyAud);
    return false;
  })();
  if (!audOk) throw new Error("aud mismatch");

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now >= payload.exp) throw new Error("token expired");
  if (typeof payload.nbf === "number" && now < payload.nbf) throw new Error("token not active");

  const kid = header.kid;
  if (!kid) throw new Error("kid missing");

  const jwks = await getJwks(teamDomain);
  const jwk = (jwks.keys || []).find((k) => k.kid === kid);
  if (!jwk) throw new Error("kid not found in JWKS");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signature,
    signingInput
  );
  if (!ok) throw new Error("signature invalid");

  return payload;
}

async function getJwks(teamDomain) {
  const now = Date.now();
  const cached = jwksCache.get(teamDomain);
  if (cached && now - cached.ts < 60 * 60 * 1000) return cached.jwks; // 1h

  const res = await fetch(`${teamDomain}/cdn-cgi/access/certs`, {
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!res.ok) throw new Error("JWKS fetch failed");
  const jwks = await res.json();

  jwksCache.set(teamDomain, { ts: now, jwks });
  return jwks;
}

// ------------------- helpers -------------------

function enforceRole(auth, allowed) {
  const role = auth?.user?.role || "";
  if (!allowed.includes(role)) {
    const err = new Error("Forbidden: role=" + role);
    err.status = 403;
    throw err;
  }
}

function clampInt(v, min, max, def) {
  const n = Number.parseInt(v ?? "", 10);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return def;
}
function norm(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function base64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function utf8(bytes) {
  return new TextDecoder().decode(bytes);
}

function cors(request, env) {
  const origin = request.headers.get("Origin");
  const allow = env.ALLOWED_ORIGIN || "";
  const ok = origin && origin === allow;
  return {
    ...(ok ? { "Access-Control-Allow-Origin": origin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Cf-Access-Jwt-Assertion",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
}
function corsPreflight(request, env) {
  return new Response("", { status: 204, headers: cors(request, env) });
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
function text(s, status = 200, headers = {}) {
  return new Response(String(s), {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
  });
}
