#!/bin/sh
set -eu

cd /pb

if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
  /pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" || true
fi

exec /pb/pocketbase serve --http=0.0.0.0:8080
