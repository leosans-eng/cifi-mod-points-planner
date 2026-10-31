// Cloud sync for the Mod Points Planner. Runs as a Cloudflare Worker with a D1 database bound as DB.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 12;
const MAX_BYTES = 1500000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS),
  });
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

function cleanCode(raw) {
  const code = String(raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!ALPHABET.includes(ch)) return null;
  return code;
}

async function readSave(request) {
  const text = await request.text();
  if (text.length > MAX_BYTES) return { error: "too-big" };
  let body;
  try {
    body = JSON.parse(text);
  } catch (err) {
    return { error: "bad-json" };
  }
  const state = body && body.state;
  if (!state || typeof state !== "object" || typeof state.levels !== "object") return { error: "not-a-save" };
  return { state, base: Number(body.base) || 0 };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const path = new URL(request.url).pathname.replace(/\/+$/, "");

    if (path === "/saves" && request.method === "POST") {
      const save = await readSave(request);
      if (save.error) return reply({ error: save.error }, 400);
      const now = Date.now();
      for (let tries = 0; tries < 5; tries++) {
        const code = newCode();
        const result = await env.DB.prepare(
          "INSERT OR IGNORE INTO saves (code, data, updated_at, created_at) VALUES (?, ?, ?, ?)"
        ).bind(code, JSON.stringify(save.state), now, now).run();
        if (result.meta.changes === 1) return reply({ code, updatedAt: now }, 201);
      }
      return reply({ error: "busy" }, 503);
    }

    const match = path.match(/^\/saves\/([^/]+)$/);
    if (!match) return reply({ error: "not-found" }, 404);
    const code = cleanCode(decodeURIComponent(match[1]));
    if (!code) return reply({ error: "bad-code" }, 400);

    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT data, updated_at FROM saves WHERE code = ?").bind(code).first();
      if (!row) return reply({ error: "no-save" }, 404);
      return reply({ state: JSON.parse(row.data), updatedAt: row.updated_at });
    }

    if (request.method === "PUT") {
      const save = await readSave(request);
      if (save.error) return reply({ error: save.error }, 400);
      const row = await env.DB.prepare("SELECT data, updated_at FROM saves WHERE code = ?").bind(code).first();
      if (!row) return reply({ error: "no-save" }, 404);
      if (row.updated_at > save.base) {
        return reply({ error: "newer", state: JSON.parse(row.data), updatedAt: row.updated_at }, 409);
      }
      const now = Math.max(Date.now(), row.updated_at + 1);
      await env.DB.prepare("UPDATE saves SET data = ?, updated_at = ? WHERE code = ?")
        .bind(JSON.stringify(save.state), now, code).run();
      return reply({ updatedAt: now });
    }

    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM saves WHERE code = ?").bind(code).run();
      return reply({ deleted: true });
    }

    return reply({ error: "not-allowed" }, 405);
  },
};
