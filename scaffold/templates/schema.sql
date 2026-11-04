-- {{APP_NAME}} app schema. The framework owns the `users` table;
-- define app-specific tables here. Runs on every boot (CREATE TABLE IF
-- NOT EXISTS), so keep migrations idempotent or add them in server.js.

CREATE TABLE IF NOT EXISTS notes(
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
