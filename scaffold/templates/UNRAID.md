# {{APP_TITLE}} — Unraid install

Built with [dashboard-framework](https://github.com/jakeolson57/dashboard-framework).

## One-time setup

1. **Create the GitHub repo** (Cooper's GitHub connection can't create repos):
   new repository `{{GITHUB_REPO}}`, private or public — your call.

2. **On Unraid**, open a terminal:

   ```sh
   cd /mnt/user/appdata
   git clone https://github.com/{{GITHUB_REPO}}.git {{APP_NAME}}
   cd {{APP_NAME}}
   cp .env.example .env
   nano .env   # fill in secrets
   docker compose up -d
   ```

   Private repo: create a fine-grained read-only PAT for this repo and save it:
   `echo "TOKEN" > /boot/config/{{GH_TOKEN_FILE}} && chmod 600 /boot/config/{{GH_TOKEN_FILE}}`

3. **GitHub OAuth app** (optional — only gates the login button):
   Settings → Developer settings → OAuth Apps → new app, callback URL
   `https://{{SIDECAR_HOST}}.{{TAILNET}}.ts.net:{{SIDECAR_PORT}}/api/oauth/callback`.
   Put the client ID/secret in `.env`.

4. **Tailscale sidecar**:

   ```sh
   mkdir -p /mnt/user/appdata/{{SIDECAR_HOST}}-tailscale
   cp tailscale-sidecar/serve.json /mnt/user/appdata/{{SIDECAR_HOST}}-tailscale/serve.json
   # edit serve.json: replace TAILNET with your tailnet name
   cd tailscale-sidecar
   # .env with TS_AUTHKEY=<reusable Tailscale auth key>
   docker compose up -d
   ```

5. **Auto-deploy watcher** — User Scripts plugin → new script, paste in
   `watch.sh`, schedule `*/5 * * * *`, run in background.

6. Open it: `https://{{SIDECAR_HOST}}.{{TAILNET}}.ts.net:{{SIDECAR_PORT}}`
   (or `http://<unraid-lan-ip>:{{PORT}}` on the LAN).
