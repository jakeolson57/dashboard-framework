# Building an app on dashboard-framework

## 1. Scaffold

```sh
./scaffold/new-app.sh <app-name> <port> [sidecar-port] [title] [output-dir]
# example:
./scaffold/new-app.sh ocarina-tracker 8475 8447 "Ocarina of Time 100%"
```

This creates the app directory with:
- `core/` — a vendored (frozen) copy of the framework core, version-stamped
  in `framework.json`. Your app has no runtime dependency on this repo.
- `server.js`, `schema.sql`, `app.json` — your backend. Edit freely.
- `index.html`, `js/app.js`, `css/app.css` — your frontend.
- `docker-compose.yml`, `.env.example`, `UNRAID.md`, `watch.sh`,
  `tailscale-sidecar/` — deploy scaffolding with your names/ports filled in.

Re-running `new-app.sh` with the same args refreshes `core/` and the
deploy files but **never overwrites** your app code.

## 2. Data model — `schema.sql`

The framework owns the `users` table (GitHub OAuth identities). Define
your tables in `schema.sql`; it runs on every boot, so keep statements
idempotent (`CREATE TABLE IF NOT EXISTS`). For trickier migrations, add
them in `server.js` via `openDatabase(path, { schema, migrations })`.

## 3. API — `server.js`

```js
import { createApp } from './core/server.js';
import { createAuth } from './core/auth.js';
import { openDatabase, loadOrCreateSecret } from './core/db.js';

const app = createApp({ root: ROOT });
const db = openDatabase(process.env.DB_PATH || '/data/app.db', {
  schema: readFileSync('./schema.sql', 'utf8'),
});
const auth = createAuth({ db, secret: loadOrCreateSecret(DB_PATH + '.secret'),
  cookiePrefix: 'myapp', /* + OAuth env */ });

// Auth routes (mount all five)
app.get('/api/oauth/config', (req, res, url, p, h) => auth.oauthConfig(req, res, h.json));
// ... /oauth/start, /oauth/callback, /me, /logout

// Your routes. :params are parsed; h = { json, err, readJsonBody }.
app.get('/api/things/:id', (req, res, url, params, h) => {
  h.json(res, 200, db.prepare('SELECT * FROM things WHERE id = ?').get(params.id));
});

// Protect mutations:
app.post('/api/things', async (req, res, url, params, h) => {
  const uid = auth.requireUser(req, res, h.json);
  if (!uid) return;
  const body = await h.readJsonBody(req);
  // ...
});
```

Unmatched `GET`/`HEAD` requests serve static files from the repo root
with a blocklist (dotfiles, `server.js`, `*.db*`, `*.secret`,
`tests/`, `scripts/`, `node_modules/` are never served).

## 4. Frontend

- `core/ui-kit.css` — normalized dark theme. Override `--accent` in your
  own CSS for identity; don't fork the whole file.
- `core/ui-kit.js` — `api(path, method, body)`, `initAuth(onUser)`,
  `debounce`, `fmtTime`, `esc`. Import as a module:
  `import { api, initAuth } from '/core/ui-kit.js'`.
- Components: `.card`, `.badge` (`.ok`/`.warn`/`.danger`/`.info`/`.accent`),
  `.dot` (`.ok`/`.warn`/`.danger`/`.info`), `.chips`/`.chip`,
  `.bar` progress, `.meta`, `.row`, `.controls`, `.hidden`, `.muted`.

## 5. Deploy

Follow the generated `UNRAID.md`: GitHub repo → clone on Unraid →
`.env` → `docker compose up -d` → Tailscale sidecar → `watch.sh` in
User Scripts every 5 minutes.

## Conventions (from the three source apps)

- Zero npm dependencies. Node 22+ (`node:sqlite`, `fetch`, `crypto`).
- Reads are public on the tailnet; mutations require login.
- Sessions are stateless HMAC-signed cookies; the signing secret is
  persisted next to the DB so deploys don't log users out.
- Data-only, schema-validated writes. Checkboxes/progress sync with a
  debounced push; the server never wipes client state.
- Quiet automation: background jobs only notify on change or repeated
  failure — never "all clear" spam.
