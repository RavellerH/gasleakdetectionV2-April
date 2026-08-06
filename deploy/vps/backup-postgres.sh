#!/usr/bin/env sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
backup_dir="$repo_dir/backups/postgres"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)

mkdir -p "$backup_dir"
docker compose --env-file "$repo_dir/deploy/vps/.env" -f "$repo_dir/docker-compose.vps.yml" \
  exec -T postgres pg_dump -U gasguard -d gasguard -Fc > "$backup_dir/gasguard-$timestamp.dump"

find "$backup_dir" -type f -name 'gasguard-*.dump' -mtime +7 -delete
