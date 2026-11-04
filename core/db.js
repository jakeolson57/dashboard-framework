// core/db.js — SQLite open helper for framework apps.
// Zero dependencies; uses node:sqlite (node 22.5+).
//
// The framework owns the `users` table (GitHub OAuth identities).
// The app supplies its own schema and migrations.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

export function openDatabase(dbPath, { schema = '', migrations = [] } = {}) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      github_id INTEGER UNIQUE,
      created_at TEXT NOT NULL
    );
  `);
  if (schema) db.exec(schema);
  for (const migrate of migrations) migrate(db);
  return db;
}

// Session signing secret, persisted next to the DB (0o600) so container
// recreations don't log everyone out. Generated once on first boot.
export function loadOrCreateSecret(secretPath) {
  try {
    const s = readFileSync(secretPath, 'utf8').trim();
    if (s) return s;
  } catch { /* generate below */ }
  const s = randomBytes(48).toString('hex');
  mkdirSync(dirname(secretPath), { recursive: true });
  writeFileSync(secretPath, s, { mode: 0o600 });
  return s;
}
