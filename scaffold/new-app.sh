#!/bin/bash
#
# new-app.sh — scaffold a new dashboard-framework app.
#
#   ./scaffold/new-app.sh <app-name> <port> [sidecar-port] [title] [output-dir]
#
# Example:
#   ./scaffold/new-app.sh ocarina-tracker 8475 8447 "Ocarina of Time 100%"
#
# The new app vendors a copy of core/ (recorded in framework.json).
# Re-run with the same args to refresh templates (never overwrites
# server.js, schema.sql, index.html, js/, css/ — your app code is yours).

set -u

FW_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATES="$FW_ROOT/scaffold/templates"
FW_VERSION="1.0.0"

usage() {
  echo "usage: new-app.sh <app-name> <port> [sidecar-port] [title] [output-dir]" >&2
  exit 1
}

[ $# -ge 2 ] || usage
APP_NAME="$1"
PORT="$2"
SIDECAR_PORT="${3:-}"
TITLE="${4:-}"
OUT="${5:-./$APP_NAME}"

[[ "$APP_NAME" =~ ^[a-z0-9-]+$ ]] || { echo "app-name must be kebab-case [a-z0-9-]" >&2; exit 1; }
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "port must be numeric" >&2; exit 1; }
if [ -z "$SIDECAR_PORT" ]; then
  SIDECAR_PORT=$((PORT - 28))  # 8475 -> 8447, matches the existing convention
fi
[[ "$SIDECAR_PORT" =~ ^[0-9]+$ ]] || { echo "sidecar-port must be numeric" >&2; exit 1; }
[ -z "$TITLE" ] && TITLE="$APP_NAME"

COOKIE_PREFIX="$(echo "$APP_NAME" | tr -d '-')"
DB_FILE="$(echo "$APP_NAME" | tr '-' '_').db"
GH_TOKEN_FILE="$APP_NAME-gh-token"
SIDECAR_HOST="$APP_NAME"
USER_AGENT="$APP_NAME"
TAILNET="${TAILNET:-forest-bortle}"
GITHUB_REPO="${GITHUB_REPO:-jakeolson57/$APP_NAME}"

echo "Scaffolding $APP_NAME -> $OUT (app :$PORT, sidecar :$SIDECAR_PORT)"
mkdir -p "$OUT"

# 1. Vendor the framework core (frozen copy; version-stamped below).
rm -rf "$OUT/core"
cp -r "$FW_ROOT/core" "$OUT/core"

# 2. Copy templates with token substitution. Never clobber app code on
#    re-runs — only the deploy scaffolding and core/ refresh.
sub() {
  sed -e "s|{{APP_NAME}}|$APP_NAME|g" \
      -e "s|{{APP_TITLE}}|$TITLE|g" \
      -e "s|{{PORT}}|$PORT|g" \
      -e "s|{{SIDECAR_PORT}}|$SIDECAR_PORT|g" \
      -e "s|{{SIDECAR_HOST}}|$SIDECAR_HOST|g" \
      -e "s|{{DB_FILE}}|$DB_FILE|g" \
      -e "s|{{COOKIE_PREFIX}}|$COOKIE_PREFIX|g" \
      -e "s|{{GH_TOKEN_FILE}}|$GH_TOKEN_FILE|g" \
      -e "s|{{TAILNET}}|$TAILNET|g" \
      -e "s|{{USER_AGENT}}|$USER_AGENT|g" \
      -e "s|{{GITHUB_REPO}}|$GITHUB_REPO|g" \
      "$1"
}

copy_tpl() { # src-rel dst-rel (app code: skip if exists; deploy files: always refresh)
  local src="$TEMPLATES/$1" dst="$OUT/$2" kind="$3"
  if [ "$kind" = "app" ] && [ -e "$dst" ]; then
    echo "  keep   $2"
    return
  fi
  mkdir -p "$(dirname "$dst")"
  sub "$src" > "$dst"
  echo "  wrote  $2"
}

# App code (never overwritten once created)
copy_tpl server.js server.js app
copy_tpl schema.sql schema.sql app
copy_tpl app.json app.json app
copy_tpl index.html index.html app
copy_tpl js/app.js js/app.js app
copy_tpl css/app.css css/app.css app
# Deploy scaffolding (safe to refresh)
copy_tpl docker-compose.yml docker-compose.yml deploy
copy_tpl .env.example .env.example deploy
copy_tpl .gitignore .gitignore deploy
copy_tpl UNRAID.md UNRAID.md deploy
copy_tpl watch.sh watch.sh deploy
copy_tpl tailscale-sidecar/docker-compose.yml tailscale-sidecar/docker-compose.yml deploy
copy_tpl tailscale-sidecar/serve.json tailscale-sidecar/serve.json deploy
copy_tpl tailscale-sidecar/README.md tailscale-sidecar/README.md deploy
chmod +x "$OUT/watch.sh"

# 3. Stamp the framework version.
cat > "$OUT/framework.json" <<EOF
{
  "framework": "dashboard-framework",
  "framework_version": "$FW_VERSION",
  "vendored_at": "$(date -u +%FT%TZ)"
}
EOF

echo "Done. Next: cd $OUT && cp .env.example .env"
echo "Docs: $FW_ROOT/docs/building-an-app.md"
