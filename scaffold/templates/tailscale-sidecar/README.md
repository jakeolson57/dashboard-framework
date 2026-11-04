# {{APP_TITLE}} — Tailscale sidecar

Exposes the app at `https://{{SIDECAR_HOST}}.<your-tailnet>.ts.net:{{SIDECAR_PORT}}`
with automatic HTTPS, proxying `/` to the app at `http://127.0.0.1:{{PORT}}`.

## Setup

1. Copy `serve.json` to `/mnt/user/appdata/{{SIDECAR_HOST}}-tailscale/serve.json`
   and replace `TAILNET` with your tailnet name.
2. Next to *this* compose file, create `.env` with:
   `TS_AUTHKEY=<reusable auth key from Tailscale admin → Settings → Keys>`
   (a key you already use for other sidecars works fine)
3. `docker compose up -d` in this directory.
