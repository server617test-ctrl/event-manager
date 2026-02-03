export async function requireAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Admin access required." };

  const now = Date.now();
  const row = await env.DB
    .prepare("SELECT token, name, expires_at FROM admin_sessions WHERE token=?")
    .bind(token)
    .first();

  if (!row || row.expires_at < now) {
    // cleanup
    if (row?.token) {
      await env.DB.prepare("DELETE FROM admin_sessions WHERE token=?").bind(row.token).run();
    }
    return { ok: false, status: 401, error: "Admin session expired. Request Edit Access again." };
  }

  return { ok: true, token, name: row.name };
}
