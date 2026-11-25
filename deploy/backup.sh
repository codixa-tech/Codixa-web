#!/usr/bin/env bash
# Nightly backup: database dump, uploaded media and the .env (encryption key). Keeps 14 days.
# Copy /var/backups/codixa off the server regularly (e.g. download with scp or sync to cloud storage).
set -euo pipefail
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST=/var/backups/codixa
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$DEST"
chmod 700 "$DEST"
sudo -u postgres pg_dump -Fc codixa > "$DEST/db_$STAMP.dump"
tar -czf "$DEST/media_$STAMP.tar.gz" -C "$APP/backend" media
install -m 600 "$APP/backend/.env" "$DEST/env_$STAMP"
find "$DEST" -type f -mtime +14 -delete
echo "Backup written to $DEST ($STAMP)"
