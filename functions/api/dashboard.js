import { requireAdmin } from "./session.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const CATS = new Set(["Participants","Hosts","Businesses","Staff"]);

async function listAll(env) {
  const rows = await env.DB.prepare(
    "SELECT category, name, note FROM dashboard_entries ORDER BY category ASC, name ASC"
  ).all();

  const out = { Participants:[], Hosts:[], Businesses:[], Staff:[] };
  for (const r of rows.results) {
    if (!out[r.category]) out[r.category] = [];
    out[r.category].push({ name: r.name, note: r.note || "" });
  }
  return out;
}

export async function onRequestGet({ env }) {
  return json({ dashboard: await listAll(env) });
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const body = await request.json().catch(() => ({}));
  const category = String(body.category || "").trim();
  const name = String(body.name || "").trim();
  const note = String(body.note || "").trim();

  if (!CATS.has(category)) return json({ error: "Invalid category." }, 400);
  if (!name) return json({ error: "Name required." }, 400);

  try {
    await env.DB.prepare(
      "INSERT INTO dashboard_entries(category, name, note, created_at) VALUES(?,?,?,?)"
    ).bind(category, name, note, Date.now()).run();
  } catch {
    return json({ error: "That entry already exists." }, 409);
  }

  return json({ dashboard: await listAll(env) });
}

export async function onRequestDelete({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const url = new URL(request.url);
  const category = String(url.searchParams.get("category") || "").trim();
  const name = String(url.searchParams.get("name") || "").trim();

  if (!CATS.has(category) || !name) return json({ error: "category+name required" }, 400);

  await env.DB.prepare(
    "DELETE FROM dashboard_entries WHERE category=? AND name=?"
  ).bind(category, name).run();

  return json({ dashboard: await listAll(env) });
}
