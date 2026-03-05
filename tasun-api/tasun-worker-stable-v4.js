// tasun-worker-stable-v4.js
// Cloudflare Worker (D1) - login + auth + read + merge
// Bindings required:
// - D1 Database: DB
// - Secret (env var): AUTH_SECRET (HMAC signing key)
// Optional:
// - CORS_ALLOW_ORIGINS (comma-separated), default allow https://wutasun.github.io

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- CORS ----
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response("", { status: 204, headers: cors });
    }

    try {
      if (path === "/api/tasun/health") {
        return json({ ok: true, service: "tasun-worker", version: "v4", ts: Date.now() }, 200, cors);
      }

      if (path === "/api/tasun/login") {
        if (request.method !== "POST") return json({ ok:false, error:"METHOD" }, 405, cors);
        const body = await request.json().catch(() => ({}));
        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        if (!username || !password) return json({ ok:false, error:"BAD_INPUT" }, 400, cors);

        const user = await getUser(env, username);
        if (!user || !user.enabled) return json({ ok:false, error:"NO_USER" }, 401, cors);

        const pass_hash = await sha256Hex(password);
        if (pass_hash !== user.pass_hash) return json({ ok:false, error:"BAD_CRED" }, 401, cors);

        const auth = await getAuth(env, username);
        const role = (auth?.role || user.role || "read");

        const exp = Date.now() + 8 * 60 * 60 * 1000; // 8 hours browser session token
        const token = await signToken(env, { u: username, r: role, exp });

        return json({ ok:true, user: username, role, exp, token }, 200, cors);
      }

      // ---- Require auth for below endpoints ----
      const session = await requireAuth(request, env);
      if (!session.ok) return json({ ok:false, error: session.error }, 401, cors);
      const me = session.me;

      if (path === "/api/tasun/me") {
        return json({ ok:true, user: me.u, role: me.r, exp: me.exp }, 200, cors);
      }

      if (path === "/api/tasun/auth/read") {
        if (request.method !== "POST") return json({ ok:false, error:"METHOD" }, 405, cors);
        const body = await request.json().catch(() => ({}));
        const username = String(body.username || me.u);
        // admin can read others; non-admin only self
        if (me.r !== "admin" && username !== me.u) return json({ ok:false, error:"FORBIDDEN" }, 403, cors);
        const row = await getAuth(env, username);
        return json({ ok:true, row: row || null }, 200, cors);
      }

      if (path === "/api/tasun/auth/upsert") {
        if (request.method !== "POST") return json({ ok:false, error:"METHOD" }, 405, cors);
        if (me.r !== "admin") return json({ ok:false, error:"FORBIDDEN" }, 403, cors);
        const body = await request.json().catch(() => ({}));
        const row = body.row || {};
        const username = String(row.username || "").trim();
        if (!username) return json({ ok:false, error:"BAD_INPUT" }, 400, cors);
        const role = String(row.role || "read");
        const btns = ["btn1","btn2","btn3","btn4","btn5"].reduce((a,k)=>{ a[k]= row[k]?1:0; return a; }, {});
        const updatedAt = Date.now();

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
        `).bind(username, role, btns.btn1, btns.btn2, btns.btn3, btns.btn4, btns.btn5, updatedAt).run();

        return json({ ok:true, updatedAt }, 200, cors);
      }

      if (path === "/api/tasun/users/upsert") {
        if (request.method !== "POST") return json({ ok:false, error:"METHOD" }, 405, cors);
        if (me.r !== "admin") return json({ ok:false, error:"FORBIDDEN" }, 403, cors);
        const body = await request.json().catch(() => ({}));
        const row = body.row || {};
        const username = String(row.username || "").trim();
        const password = String(row.password || "");
        const role = String(row.role || "read");
        const enabled = row.enabled === 0 ? 0 : 1;
        if (!username || !password) return json({ ok:false, error:"BAD_INPUT" }, 400, cors);
        const pass_hash = await sha256Hex(password);
        const ts = Date.now();

        await env.DB.prepare(`
          INSERT INTO tasun_users(username, pass_hash, role, enabled, createdAt, updatedAt)
          VALUES(?, ?, ?, ?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET
            pass_hash=excluded.pass_hash,
            role=excluded.role,
            enabled=excluded.enabled,
            updatedAt=excluded.updatedAt
        `).bind(username, pass_hash, role, enabled, ts, ts).run();

        return json({ ok:true, updatedAt: ts }, 200, cors);
      }

      if (path === "/api/tasun/read") {
        if (request.method !== "POST") return json({ ok:false, error:"METHOD" }, 405, cors);
        const body = await request.json().catch(() => ({}));
        const resourceKey = String(body.resourceKey || "").trim();
        if (!resourceKey) return json({ ok:false, error:"BAD_INPUT" }, 400, cors);

        const q = env.DB.prepare(`
          SELECT uid, data, updatedAt, rev, deleted
          FROM tasun_rows
          WHERE resourceKey=?
          ORDER BY updatedAt DESC
          LIMIT 5000
        `).bind(resourceKey);

        const rs = await q.all();
        const rows = (rs.results || []).map(r => {
          let data = r.data;
          try { data = JSON.parse(r.data); } catch(e) {}
          return { uid: r.uid, ...data, updatedAt: r.updatedAt, rev: r.rev, deleted: !!r.deleted };
        });
        return json({ ok:true, resourceKey, rows }, 200, cors);
      }

      if (path === "/api/tasun/merge") {
        if (request.method !== "POST") return json({ ok:false, error:"METHOD" }, 405, cors);
        const body = await request.json().catch(() => ({}));
        const resourceKey = String(body.resourceKey || "").trim();
        const payload = body.payload || {};
        const db = Array.isArray(payload.db) ? payload.db : [];
        if (!resourceKey) return json({ ok:false, error:"BAD_INPUT" }, 400, cors);

        let count = 0;
        const now = Date.now();

        // Transaction-like batch
        for (const item of db) {
          if (!item) continue;
          const uid = String(item.uid || "").trim();
          if (!uid) continue;

          const updatedAt = Number(item.updatedAt || now);
          const rev = Number(item.rev || 1);
          const deleted = item.deleted ? 1 : 0;

          // store "data" as JSON without control fields
          const clone = { ...item };
          delete clone.resourceKey;
          // keep uid in data for client convenience
          // strip control fields if present
          delete clone.updatedAt;
          delete clone.rev;
          delete clone.deleted;

          const data = JSON.stringify(clone);

          // Upsert with conflict check: only overwrite when incoming is newer OR rev higher
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

        return json({ ok:true, count }, 200, cors);
      }

      return json({ ok:false, error:"NOT_FOUND", path }, 404, cors);
    } catch (err) {
      return json({ ok:false, error:"INTERNAL", detail: String(err && err.message ? err.message : err) }, 500, cors);
    }
  }
};

function json(obj, status=200, headers={}) {
  const h = new Headers(headers);
  h.set("content-type","application/json; charset=utf-8");
  return new Response(JSON.stringify(obj), { status, headers: h });
}

function corsHeaders(request, env){
  const origin = request.headers.get("Origin") || "";
  const allowList = (env.CORS_ALLOW_ORIGINS || "https://wutasun.github.io").split(",").map(s=>s.trim()).filter(Boolean);
  const allow = allowList.includes("*") ? "*" : (allowList.includes(origin) ? origin : allowList[0] || "");
  const h = {
    "Access-Control-Allow-Origin": allow || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  return h;
}

// ---- Auth helpers (simple HMAC token) ----
async function signToken(env, payload){
  const header = { alg:"HS256", typ:"TJWT" };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const msg = h + "." + p;
  const sig = await hmacSha256B64Url(env.AUTH_SECRET || "dev-secret", msg);
  return msg + "." + sig;
}

async function verifyToken(env, token){
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h,p,sig] = parts;
  const msg = h + "." + p;
  const expect = await hmacSha256B64Url(env.AUTH_SECRET || "dev-secret", msg);
  if (sig !== expect) return null;
  let payload = null;
  try { payload = JSON.parse(atobUrl(p)); } catch(e) { return null; }
  if (!payload || !payload.u || !payload.r) return null;
  if (payload.exp && Date.now() > Number(payload.exp)) return null;
  return payload;
}

async function requireAuth(request, env){
  const auth = request.headers.get("Authorization") || request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const me = await verifyToken(env, token);
  if (!me) return { ok:false, error:"UNAUTH" };
  return { ok:true, me };
}

function b64url(s){
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function atobUrl(s){
  s = s.replace(/-/g,"+").replace(/_/g,"/");
  while (s.length % 4) s += "=";
  return decodeURIComponent(escape(atob(s)));
}

async function hmacSha256B64Url(secret, message){
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name:"HMAC", hash:"SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sigBuf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

async function sha256Hex(str){
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function getUser(env, username){
  const r = await env.DB.prepare("SELECT username, pass_hash, role, enabled FROM tasun_users WHERE username=?").bind(username).first();
  return r || null;
}
async function getAuth(env, username){
  const r = await env.DB.prepare("SELECT username, role, btn1, btn2, btn3, btn4, btn5, updatedAt FROM tasun_auth WHERE username=?").bind(username).first();
  return r || null;
}
