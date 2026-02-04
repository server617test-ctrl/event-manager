import { requireAdmin } from "./session.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestGet({ env }) {
  const rows = await env.DB.prepare("SELECT name FROM wheel_names ORDER BY name ASC").all();
  return json({ names: rows.results.map(r => r.name) });
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return json({ error: "Name required." }, 400);

  const now = Date.now();
  try {
    await env.DB.prepare("INSERT INTO wheel_names(name, created_at) VALUES(?,?)")
      .bind(name, now).run();
  } catch {
    return json({ error: "Name already exists." }, 409);
  }

  return onRequestGet({ env });
}

export async function onRequestDelete({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const url = new URL(request.url);
  const name = String(url.searchParams.get("name") || "").trim();
  if (!name) return json({ error: "name query param required" }, 400);

  await env.DB.prepare("DELETE FROM wheel_names WHERE name=?").bind(name).run();
  return onRequestGet({ env });
}
