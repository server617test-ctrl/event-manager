function hex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(digest);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const pin = String(body.pin || "").trim();

  if (!name) return json({ error: "Name is required." }, 400);
  if (!pin) return json({ error: "PIN is required." }, 400);

  const expected = String(env.ADMIN_PIN_HASH || "").trim();
  if (!expected) return json({ error: "Server missing ADMIN_PIN_HASH." }, 500);

  const got = await sha256Hex(pin);
  if (got !== expected) return json({ error: "Incorrect PIN." }, 401);

  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 6 * 60 * 60 * 1000; // 6 hours

  await env.DB.prepare(
    "INSERT INTO admin_sessions(token, name, expires_at) VALUES(?,?,?)"
  ).bind(token, name, expiresAt).run();

  return json({ token, name, expiresAt });
}
