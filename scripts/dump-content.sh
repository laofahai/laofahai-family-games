#!/usr/bin/env bash
# 从数据库（真源）导出全部内容库到 supabase/seed/content.sql 快照。
# 内容不再存在于 App 代码里——数据库是唯一真源，这份快照仅作灾备 / 全新库重新播种用。
#
# 跑法：  bash scripts/dump-content.sh
# 需要 .env.local 里的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。
set -euo pipefail
cd "$(dirname "$0")/.."

URL=$(grep '^VITE_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"'\')
KEY=$(grep '^VITE_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"'\')

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# 注意：用进程替换 <(...) 提供 python 脚本，stdin 才能留给 curl 的管道 JSON
curl -s "$URL/rest/v1/rpc/get_all_content" -X POST \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{}' \
| python3 <(cat <<'PY'
import sys, json
rows = sorted(json.load(sys.stdin), key=lambda r: r["game"])
out = ["-- 自动生成（scripts/dump-content.sh）：数据库内容库快照。可重复执行（upsert）。",
       "-- 真源在数据库；App 代码不含内容。此文件仅作灾备 / 全新库重新播种。", "begin;"]
for r in rows:
    g = r["game"]; data = r["data"]
    if not isinstance(data, list):
        sys.stderr.write(f"skip {g}: not array\n"); continue
    j = json.dumps(data, ensure_ascii=False)
    out.append(
        f"insert into public.game_content (game, data, updated_at) values "
        f"('{g}', $seed${j}$seed$::jsonb, now()) "
        f"on conflict (game) do update set data = excluded.data, updated_at = now();")
    sys.stderr.write(f"  {g}: {len(data)} 条\n")
out += ["commit;", "notify pgrst, 'reload schema';"]
print("\n".join(out))
PY
) > "$TMP"

# 校验非空再覆盖，避免网络失败把快照清空
if [ "$(grep -c 'insert into' "$TMP")" -ge 1 ]; then
  mv "$TMP" supabase/seed/content.sql
  echo "wrote supabase/seed/content.sql ($(grep -c 'insert into' supabase/seed/content.sql) banks)" >&2
else
  echo "ERROR: 导出为空，保留原快照不动" >&2; exit 1
fi
