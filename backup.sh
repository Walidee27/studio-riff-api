#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && { set -a; source .env; set +a; }

POSTGRES_USER=${POSTGRES_USER:-studio}
POSTGRES_DB=${POSTGRES_DB:-studio_riff}
BACKUP_DIR=${BACKUP_DIR:-backups}
RETENTION_DAYS=${RETENTION_DAYS:-30}

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/${POSTGRES_DB}_$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$file.partial"
mv "$file.partial" "$file"
echo "Sauvegarde : $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -name '*.dump' -mtime +"$RETENTION_DAYS" -print -delete | sed 's/^/Supprimée (rétention) : /'
