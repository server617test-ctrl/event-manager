import { requireAdmin } from "./session.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 60_000;

  await env.DB.prepare("INSERT INTO wipe_tokens(token, expires_at) VALUES(?,?)")
    .bind(token, expiresAt).run();

  return json({ token, phrase: env.WIPE_PHRASE || "WIPE EVENT DATA", expiresInSec: 60 });
}
