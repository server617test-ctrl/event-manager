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

  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  const phrase = String(body.phrase || "").trim();
  const expected = String(env.WIPE_PHRASE || "WIPE EVENT DATA");

  if (!token) return json({ error: "token required" }, 400);
  if (phrase !== expected) return json({ error: "Confirmation phrase does not match." }, 400);

  const row = await env.DB.prepare("SELECT token, expires_at FROM wipe_tokens WHERE token=?")
    .bind(token).first();

  if (!row || row.expires_at < Date.now()) return json({ error: "Wipe token invalid/expired." }, 400);

  // Wipe everything
  await env.DB.prepare("DELETE FROM wheel_names").run();
  await env.DB.prepare("DELETE FROM raffle_tickets").run();
  await env.DB.prepare("DELETE FROM dashboard_entries").run();
  await env.DB.prepare("DELETE FROM wipe_tokens").run();

  return json({ ok: true });
}
