import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const contentSql = fs.readFileSync(path.join(root, 'supabase/seed/content.sql'), 'utf8')
const partySql = fs.readFileSync(path.join(root, 'supabase/seed/party-content-expansion.sql'), 'utf8')
const outPath = path.join(root, 'deploy/family-games-pocketbase/pb_seed/game_content.json')

function parseGameContent(sql) {
  const rows = new Map()
  const re = /values\s*\('([^']+)',\s*\$[a-zA-Z0-9_]*\$([\s\S]*?)\$[a-zA-Z0-9_]*\$::jsonb/gi
  let match
  while ((match = re.exec(sql))) {
    rows.set(match[1], JSON.parse(match[2]))
  }
  return rows
}

function parsePartyAdditions(sql, label) {
  const re = new RegExp(`\\$${label}\\$([\\s\\S]*?)\\$${label}\\$::jsonb`, 'm')
  const match = sql.match(re)
  return match ? JSON.parse(match[1]) : []
}

function mergeByText(existing, additions) {
  const seen = new Set()
  const out = []
  for (const item of [...existing, ...additions]) {
    const key = item && typeof item.text === 'string' ? item.text : JSON.stringify(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

const rows = parseGameContent(contentSql)
rows.set('charades', mergeByText(rows.get('charades') ?? [], parsePartyAdditions(partySql, 'party_charades')))
rows.set('draw', mergeByText(rows.get('draw') ?? [], parsePartyAdditions(partySql, 'party_draw')))

const payload = Array.from(rows.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([game, data]) => ({ game, data }))

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(payload)}\n`)
console.log(`Wrote ${payload.length} content banks to ${outPath}`)
