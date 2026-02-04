import { requireAdmin } from "./session.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function cryptoInt(maxExclusive) {
  // rejection sampling with 32-bit
  const limit = Math.floor(0xFFFFFFFF / maxExclusive) * maxExclusive;
  while (true) {
    const x = crypto.getRandomValues(new Uint32Array(1))[0];
    if (x < limit) return x % maxExclusive;
  }
}

function genTicket12() {
  // 12 digits -> 000000000000 to 999999999999
  // use 2x 32-bit + 1x 32-bit for 96 bits then mod 10^12
  const a = crypto.getRandomValues(new Uint32Array(3));
  const n = (BigInt(a[0]) << 64n) | (BigInt(a[1]) << 32n) | BigInt(a[2]);
  const mod = 1000000000000n; // 10^12
  const t = (n % mod).toString().padStart(12, "0");
  return t;
}

async function listActive(env) {
  const rows = await env.DB.prepare(
    "SELECT ticket_number, name FROM raffle_tickets WHERE status='ACTIVE' ORDER BY created_at ASC"
  ).all();
  return rows.results.map(r => ({ ticketNumber: r.ticket_number, name: r.name }));
}

export async function onRequestGet({ env }) {
  return json({ active: await listActive(env) });
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const count = Number(body.count);

  if (!name) return json({ error: "Name required." }, 400);
  if (!Number.isInteger(count) || count < 1 || count > 5000) {
    return json({ error: "Count must be an integer 1..5000" }, 400);
  }

  const now = Date.now();
  // insert with retry for uniqueness
  for (let i = 0; i < count; i++) {
    for (let attempts = 0; attempts < 10; attempts++) {
      const ticket = genTicket12();
      try {
        await env.DB.prepare(
          "INSERT INTO raffle_tickets(ticket_number, name, status, created_at) VALUES(?,?, 'ACTIVE', ?)"
        ).bind(ticket, name, now).run();
        break;
      } catch (e) {
        if (attempts === 9) return json({ error: "Could not generate unique tickets, try again." }, 500);
      }
    }
  }

  return json({ active: await listActive(env) });
}

/** Draw: server chooses the winner fairly (recommended) */
export async function onRequestPut({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  const active = await env.DB.prepare(
    "SELECT ticket_number, name FROM raffle_tickets WHERE status='ACTIVE'"
  ).all();

  if (!active.results.length) return json({ error: "No active tickets." }, 400);

  const idx = cryptoInt(active.results.length);
  const picked = active.results[idx];

  await env.DB.prepare(
    "UPDATE raffle_tickets SET status='DRAWN', drawn_at=? WHERE ticket_number=?"
  ).bind(Date.now(), picked.ticket_number).run();

  return json({
    winner: { ticketNumber: picked.ticket_number, name: picked.name },
    active: await listActive(env)
  });
}
