#!/bin/bash
#
# {{APP_NAME}} auto-deploy watcher (Unraid)
# -------------------------------------------------
# Polls GitHub for new commits on main. When found, pulls the latest code
# and recreates the container. Run every 5 minutes via the Unraid
# "User Scripts" plugin (custom cron: */5 * * * *), in the background.

set -u

REPO_DIR="/mnt/user/appdata/{{APP_NAME}}"
TOKEN_FILE="/boot/config/{{GH_TOKEN_FILE}}"
NTFY_TOPIC=""   # e.g. "jake-{{APP_NAME}}-deploys-x7q2" — empty disables notifications
HEALTH_URL="http://localhost:{{PORT}}/api/ping"
COMPOSE_FILE="$REPO_DIR/docker-compose.yml"

log() { echo "[$(date '+%F %T')] $*"; }
die() { log "ERROR: $*"; exit 1; }

notify() {
  [ -n "$NTFY_TOPIC" ] || return 0
  curl -s -o /dev/null --max-time 10 -d "$1" "https://ntfy.sh/${NTFY_TOPIC}" || true
}

cd "$REPO_DIR" || die "repo dir not found: $REPO_DIR"

if [ -f "$TOKEN_FILE" ]; then
  TOKEN=$(cat "$TOKEN_FILE")
  git remote set-url origin "https://x-access-token:${TOKEN}@github.com/{{GITHUB_REPO}}.git" 2>/dev/null || true
fi

git fetch origin main --quiet 2>/dev/null || die "git fetch failed — check network access and token ($TOKEN_FILE)"

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
[ -n "$REMOTE" ] || die "could not resolve origin/main"

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0  # nothing new — quiet, cron-friendly
fi

log "New commit on main: ${LOCAL:0:7} -> ${REMOTE:0:7}. Deploying..."
git checkout -q main 2>/dev/null || git checkout -qb main origin/main
git reset -q --hard "origin/main" || die "git reset failed"

cd "$REPO_DIR"
docker compose -f "$COMPOSE_FILE" up -d --force-recreate || die "docker compose failed"

sleep 3
if curl -s -o /dev/null --max-time 10 "$HEALTH_URL"; then
  log "Deploy OK — {{APP_NAME}} live"
  notify "{{APP_TITLE}} redeployed (${REMOTE:0:7})"
else
  die "health check failed after redeploy"
fi
