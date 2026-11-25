#!/usr/bin/env bash
# Apply an update on the server after uploading new code (git pull or copying the folder):
#
#   sudo bash deploy/deploy.sh
#
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$APP/backend"
SITE_URL="$(grep -E '^PUBLIC_BASE_URL=' "$BACKEND/.env" | cut -d= -f2-)"
APP_PORT="$(grep -E '^APP_PORT=' "$BACKEND/.env" | cut -d= -f2)"
APP_PORT="${APP_PORT:-8031}"
# Node: the system one if it is 18+, otherwise the private copy setup_server.sh installed
NODE_BIN="$APP/.tools/node/bin"
SYS_NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)"
if [[ -n "$SYS_NODE_MAJOR" && "$SYS_NODE_MAJOR" -ge 18 ]]; then NODE_BIN="$(dirname "$(command -v node)")"; fi
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

if [[ -d "$APP/.git" ]]; then
  step "Get the latest code"
  git -C "$APP" pull --ff-only
fi

step "Backup before update"
bash "$APP/deploy/backup.sh"

step "Python packages"
"$BACKEND/.venv/bin/pip" install -q -r "$BACKEND/requirements.txt"

step "Checks, migrations, static files"
cd "$BACKEND"
.venv/bin/python manage.py check --deploy --fail-level ERROR
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput -v 0
chown -R www-data:www-data "$BACKEND/media"

step "Website build"
cd "$APP"
PATH="$NODE_BIN:$PATH" npm ci --no-audit --no-fund
PATH="$NODE_BIN:$PATH" VITE_API_URL=/api VITE_SITE_URL="$SITE_URL" npm run build

step "Restart"
systemctl restart codixa
nginx -t && systemctl reload nginx
sleep 2
curl -fsS -o /dev/null -w "API health: %{http_code}\n" http://127.0.0.1:$APP_PORT/api/public/settings/ -H "Host: ${SITE_URL#https://}" -H "X-Forwarded-Proto: https"
echo "Updated: $SITE_URL"
