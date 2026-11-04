# dashboard-framework

A zero-dependency Node.js framework for small self-hosted dashboards —
extracted from three production apps (two game 100% trackers and a watch
manager) that share the same shape: a dark dashboard UI, GitHub OAuth
login, SQLite storage, and a Tailscale-first Unraid deployment.

**Philosophy:** no npm packages, no build step, no runtime dependency on
this repo. Apps **vendor** a frozen copy of `core/` (version-stamped);
the framework never phones home.

## Layout

```
core/               The reusable core (vendored into apps)
  server.js         App factory: routing with :params, JSON helpers,
                    static file serving with a safety blocklist
  auth.js           HMAC session cookies + GitHub OAuth flow
  db.js             SQLite open helper, users table, secret persistence
  ui-kit.css        Normalized dark theme + components
                    (card, badge, dot, chips, bar, table, controls)
  ui-kit.js         api() wrapper, initAuth(), debounce, fmtTime, esc
scaffold/
  new-app.sh        Generates a new app repo from templates
  templates/        docker-compose, Tailscale sidecar, watch.sh,
                    UNRAID.md, .env.example, starter server.js + UI
docs/
  building-an-app.md
```

## Quickstart

```sh
git clone https://github.com/jakeolson57/dashboard-framework.git
cd dashboard-framework
bash scaffold/new-app.sh my-dashboard 8475
cd my-dashboard
cp .env.example .env
node server.js   # -> http://localhost:8475
```

Then follow the generated `UNRAID.md` to deploy it on your server.

## What's inside

| Module | Source |
|---|---|
| HTTP routing, static serving, body limits | cod-mw4-tracker, lego-batman-tracker |
| HMAC sessions, GitHub OAuth, `/api/me` | all three apps, byte-identical logic |
| SQLite open, `users` table, secret file | all three apps |
| Dark theme, cards, badges, status dots | all three apps, variables normalized |
| `api()` fetch wrapper, auth boot | cod-mw4-tracker / lego-batman-tracker |
| Docker + Tailscale sidecar + `watch.sh` deploy | all three apps, template-substituted |

## Versioning

`core/` carries no package version beyond `framework.json`
(`framework_version`) stamped into each scaffolded app. Re-running
`new-app.sh` refreshes an app's vendored core without touching app code.

## License

MIT — see [LICENSE](LICENSE).
