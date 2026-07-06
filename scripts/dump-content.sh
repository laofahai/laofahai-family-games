#!/usr/bin/env bash
set -euo pipefail
echo "scripts/dump-content.sh has been retired. Content is now seeded into PocketBase from repository snapshots." >&2
echo "Use scripts/export-pocketbase-content.mjs to regenerate deploy/family-games-pocketbase/pb_seed/game_content.json." >&2
exit 1
