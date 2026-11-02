#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && { set -a; source .env; set +a; }

POSTGRES_USER=${POSTGRES_USER:-studio}
POSTGRES_DB=${POSTGRES_DB:-studio_riff}

dump=${1:-$(ls -t backups/*.dump 2>/dev/null | head -1)}
target=${2:-${POSTGRES_DB}_restore_$(date -u +%Y%m%d%H%M%S)}

[ -n "$dump" ] && [ -f "$dump" ] || { echo "Usage : ./restore.sh [fichier.dump] [base_cible]" >&2; exit 1; }
[ "$target" != "$POSTGRES_DB" ] || { echo "Refus : la restauration se fait dans une nouvelle base, pas dans $POSTGRES_DB" >&2; exit 1; }

psql() { docker compose exec -T postgres psql -U "$POSTGRES_USER" -v ON_ERROR_STOP=1 -tA "$@"; }

echo "Restauration de $dump dans la nouvelle base $target"
docker compose exec -T postgres createdb -U "$POSTGRES_USER" "$target"
start=$(date +%s)
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$target" --no-owner --exit-on-error < "$dump"
echo "Durée de restauration : $(( $(date +%s) - start )) s"
echo

status=0
printf '%-18s %14s %36s  %s\n' table "$POSTGRES_DB" "$target" resultat
for table in rooms members bookings schema_migrations; do
  source_count=$(psql -d "$POSTGRES_DB" -c "SELECT count(*) FROM $table")
  restored_count=$(psql -d "$target" -c "SELECT count(*) FROM $table")
  result=OK
  [ "$source_count" = "$restored_count" ] || { result=DIFFERENT; status=1; }
  printf '%-18s %14s %36s  %s\n' "$table" "$source_count" "$restored_count" "$result"
done

constraint=$(psql -d "$target" -c "SELECT count(*) FROM pg_constraint WHERE conname = 'bookings_no_overlap'")
echo
echo "Contrainte bookings_no_overlap présente dans $target : $([ "$constraint" = 1 ] && echo oui || echo non)"
exit $status
