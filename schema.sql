-- Sessions for admin auth
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Wheel names
CREATE TABLE IF NOT EXISTS wheel_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- Raffle tickets
CREATE TABLE IF NOT EXISTS raffle_tickets (
  ticket_number TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','DRAWN')),
  created_at INTEGER NOT NULL,
  drawn_at INTEGER
);

-- Event dashboard entries
CREATE TABLE IF NOT EXISTS dashboard_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK(category IN ('Participants','Hosts','Businesses','Staff')),
  name TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(category, name)
);

-- Wipe confirmation token
CREATE TABLE IF NOT EXISTS wipe_tokens (
  token TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
