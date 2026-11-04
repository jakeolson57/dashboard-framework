// {{APP_NAME}} — app server. Wires the framework core to app-specific
// routes, schema, and views. Zero npm dependencies.

import { createApp } from './core/server.js';
import { createAuth } from './core/auth.js';
import { openDatabase, loadOrCreateSecret } from './core/db.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '{{PORT}}', 10);
const DB_PATH = process.env.DB_PATH || '/data/{{DB_FILE}}';

const app = createApp({ root: ROOT });
const db = openDatabase(DB_PATH, {
  schema: readFileSync(join(ROOT, 'schema.sql'), 'utf8'),
});
const secret = loadOrCreateSecret(DB_PATH + '.secret');
const auth = createAuth({
  db,
  secret,
  cookiePrefix: '{{COOKIE_PREFIX}}',
  clientId: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  callbackUrl: process.env.OAUTH_CALLBACK_URL || '',
  userAgent: '{{USER_AGENT}}',
});

// --- framework auth routes -------------------------------------------------
app.get('/api/oauth/config', (req, res, url, p, h) => auth.oauthConfig(req, res, h.json));
app.get('/api/oauth/start', (req, res) => auth.oauthStart(req, res));
app.get('/api/oauth/callback', (req, res, url) => auth.oauthCallback(req, res, url));
app.get('/api/me', (req, res, url, p, h) => auth.me(req, res, h.json));
app.get('/api/logout', (req, res) => auth.logout(req, res));

// --- app routes ------------------------------------------------------------
// GETs are public on the tailnet; mutations require login.
app.get('/api/ping', (req, res, url, p, h) => {
  h.json(res, 200, { pong: 'ok', framework: '1.0.0', app: '{{APP_NAME}}' });
});

app.post('/api/secret', async (req, res, url, p, h) => {
  const uid = auth.requireUser(req, res, h.json);
  if (!uid) return;
  const body = await h.readJsonBody(req);
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(uid);
  h.json(res, 200, { user: user.username, echo: String(body.note || '').slice(0, 200) });
});

// --- boot ------------------------------------------------------------------
app.listen(PORT, () => console.log(`{{APP_NAME}} listening on :${PORT}`));
