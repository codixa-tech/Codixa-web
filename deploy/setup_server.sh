#!/usr/bin/env bash
# First-time setup of Codixa on an Ubuntu 22.04/24.04 server — safe on a server that already hosts other sites.
#
#   sudo bash deploy/setup_server.sh codixa.tech you@example.com
#
# Run it from the project folder after cloning it to the server (e.g. /var/www/codixa).
# What it does NOT touch: other Nginx sites, the firewall, installed package versions, the system Node.js,
# other databases or services. Everything Codixa needs gets its own name: Nginx site "codixa",
# systemd service "codixa", PostgreSQL user/database "codixa", Redis database 3, and a free local port.
# Safe to re-run: the database, backend/.env and certificates are kept.
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: sudo bash deploy/setup_server.sh <domain> <email-for-ssl-notices>"
  exit 1
fi
[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$APP/backend"
ENV_FILE="$BACKEND/.env"
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }

step "Checks"
PY_OK="$(python3 -c 'import sys; print(int(sys.version_info >= (3, 10)))' 2>/dev/null || echo 0)"
[[ "$PY_OK" == 1 ]] || { echo "Python 3.10+ is required (Ubuntu 22.04 or newer)."; exit 1; }
echo "Python $(python3 -V | cut -d' ' -f2), $(lsb_release -ds 2>/dev/null || echo Linux)"
echo "Sites already enabled in Nginx (left as they are):"
ls -1 /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/   - /' || true

step "System packages (only missing ones are installed; nothing is upgraded)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-upgrade python3-venv python3-dev build-essential libpq-dev \
  postgresql redis-server nginx certbot python3-certbot-nginx ffmpeg \
  libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libharfbuzz-subset0 fonts-dejavu-core \
  git curl ca-certificates xz-utils
systemctl enable --now postgresql redis-server nginx >/dev/null 2>&1 || true

step "Node.js for building the website"
NODE_BIN=""
SYS_NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)"
if [[ -n "$SYS_NODE_MAJOR" && "$SYS_NODE_MAJOR" -ge 18 ]]; then
  NODE_BIN="$(dirname "$(command -v node)")"
  echo "Using the system Node $(node -v)"
else
  # Private copy for Codixa only, so the Node used by the other projects is not changed.
  NODE_DIR="$APP/.tools/node"
  if [[ ! -x "$NODE_DIR/bin/node" ]]; then
    mkdir -p "$APP/.tools"
    curl -fsSL https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-x64.tar.xz -o /tmp/codixa-node.tar.xz
    rm -rf "$NODE_DIR" && mkdir -p "$NODE_DIR"
    tar -xJf /tmp/codixa-node.tar.xz -C "$NODE_DIR" --strip-components=1
    rm -f /tmp/codixa-node.tar.xz
  fi
  NODE_BIN="$NODE_DIR/bin"
  echo "Using a private Node $("$NODE_BIN/node" -v) in $NODE_DIR"
fi

step "Local port for Gunicorn"
if [[ -f "$ENV_FILE" ]] && grep -qE '^APP_PORT=' "$ENV_FILE"; then
  APP_PORT="$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)"
else
  APP_PORT=8031
  while ss -ltn "( sport = :$APP_PORT )" | grep -q ":$APP_PORT"; do APP_PORT=$((APP_PORT + 1)); done
fi
echo "Codixa listens on 127.0.0.1:$APP_PORT"

step "PostgreSQL database"
DB_PASS=""
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='codixa'" | grep -q 1; then
  DB_PASS="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
  sudo -u postgres psql -qc "CREATE USER codixa WITH PASSWORD '$DB_PASS';"
  sudo -u postgres psql -qc "CREATE DATABASE codixa OWNER codixa;"
  echo "Created database user and database 'codixa'."
else
  echo "Database user 'codixa' already exists — keeping it."
fi

step "backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  [[ -n "$DB_PASS" ]] || { echo "The database exists but backend/.env is missing. Restore your .env (it holds the encryption key) and re-run."; exit 1; }
  SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"
  ADMIN_PATH="control-$(python3 -c 'import secrets; print(secrets.token_hex(4))')/"
  FERNET="$(python3 -c 'import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())')"
  cat > "$ENV_FILE" <<EOF
PUBLIC_BASE_URL=https://$DOMAIN
APP_PORT=$APP_PORT
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=$SECRET
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DJANGO_ADMIN_URL=$ADMIN_PATH
DATABASE_URL=postgres://codixa:$DB_PASS@127.0.0.1:5432/codixa
FIELD_ENCRYPTION_KEY=$FERNET
CORS_ALLOWED_ORIGINS=
CSRF_TRUSTED_ORIGINS=
REDIS_URL=redis://127.0.0.1:6379/3
VIDEO_TRANSCODE_INLINE=true
# E-mail notifications (new bookings and messages). Gmail: create an App Password and put it below.
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EOF
  chmod 640 "$ENV_FILE"
  chown root:www-data "$ENV_FILE"
  echo "Wrote $ENV_FILE. BACK UP this file: FIELD_ENCRYPTION_KEY is needed to read stored credentials."
else
  echo "Keeping existing .env"
  grep -qE '^APP_PORT=' "$ENV_FILE" || echo "APP_PORT=$APP_PORT" >> "$ENV_FILE"
fi
ADMIN_PATH="$(grep -E '^DJANGO_ADMIN_URL=' "$ENV_FILE" | cut -d= -f2- | sed 's#/*$##')"

step "Python environment"
python3 -m venv "$BACKEND/.venv"
"$BACKEND/.venv/bin/pip" install -q --upgrade pip
"$BACKEND/.venv/bin/pip" install -q -r "$BACKEND/requirements.txt"

step "Database migrations and static files"
mkdir -p "$BACKEND/media" "$BACKEND/staticfiles"
(cd "$BACKEND" && .venv/bin/python manage.py migrate --noinput && .venv/bin/python manage.py collectstatic --noinput -v 0)
chown -R www-data:www-data "$BACKEND/media"

step "Website build"
(cd "$APP" && PATH="$NODE_BIN:$PATH" npm ci --no-audit --no-fund && PATH="$NODE_BIN:$PATH" VITE_API_URL=/api VITE_SITE_URL="https://$DOMAIN" npm run build)

step "Gunicorn service (codixa)"
sed -e "s#__APP__#$APP#g" -e "s#__PORT__#$APP_PORT#g" "$APP/deploy/codixa.service" > /etc/systemd/system/codixa.service
systemctl daemon-reload
systemctl enable codixa >/dev/null 2>&1
systemctl restart codixa

step "Nginx site (codixa) — other sites untouched"
mkdir -p /root/nginx-backups
tar -czf "/root/nginx-backups/nginx-$(date +%Y%m%d-%H%M%S).tgz" -C /etc nginx
if [[ -f /etc/nginx/sites-available/codixa ]] && grep -q "managed by Certbot" /etc/nginx/sites-available/codixa; then
  echo "Existing HTTPS site config kept (re-run 'certbot --nginx' only if you change domains)."
else
  sed -e "s#__DOMAIN__#$DOMAIN#g" -e "s#__APP__#$APP#g" -e "s#__ADMIN__#$ADMIN_PATH#g" -e "s#__PORT__#$APP_PORT#g" \
    "$APP/deploy/nginx.conf.template" > /etc/nginx/sites-available/codixa
fi
ln -sf /etc/nginx/sites-available/codixa /etc/nginx/sites-enabled/codixa
if ! nginx -t; then
  rm -f /etc/nginx/sites-enabled/codixa
  echo "Nginx test failed — Codixa site disabled again, nothing else changed. Backup: /root/nginx-backups/"
  exit 1
fi
systemctl reload nginx

step "HTTPS certificate (Let's Encrypt, for $DOMAIN and www.$DOMAIN only)"
if certbot --nginx --cert-name "$DOMAIN" -d "$DOMAIN" -d "www.$DOMAIN" --redirect -m "$EMAIL" --agree-tos -n; then
  echo "HTTPS is on."
else
  warn "Certificate failed. Check that $DOMAIN and www.$DOMAIN point to this server, then run:"
  echo "  sudo certbot --nginx --cert-name $DOMAIN -d $DOMAIN -d www.$DOMAIN --redirect -m $EMAIL --agree-tos"
fi

step "Scheduled jobs (/etc/cron.d/codixa)"
cat > /etc/cron.d/codixa <<EOF
# Codixa: video conversions, unused uploads, notification e-mail retries, old visit rows, nightly backup
*/5 * * * * www-data cd $BACKEND && .venv/bin/python manage.py transcode_videos >/dev/null 2>&1
15 3 * * *  www-data cd $BACKEND && .venv/bin/python manage.py transcode_videos --retry-failed >/dev/null 2>&1
30 3 * * *  www-data cd $BACKEND && .venv/bin/python manage.py cleanup_media >/dev/null 2>&1
*/2 * * * * www-data cd $BACKEND && .venv/bin/python manage.py send_emails >/dev/null 2>&1
45 3 * * *  www-data cd $BACKEND && .venv/bin/python manage.py prune_visits >/dev/null 2>&1
0 4 * * *   root bash $APP/deploy/backup.sh >/var/log/codixa-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/codixa

step "Done"
echo "Site:             https://$DOMAIN"
echo "Dashboard:        https://$DOMAIN/dashboard"
echo "Claude connector: https://$DOMAIN/mcp"
echo "Django admin:     https://$DOMAIN/$ADMIN_PATH/"
echo
echo "Create your dashboard account now:"
echo "  cd $BACKEND && sudo -u www-data .venv/bin/python manage.py createsuperuser"
