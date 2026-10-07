// Genera una migration che allinea il DB ai dati in app/datas/.
// Uso: npm run db:missions | db:teams | db:sync   (poi: npm run db:push)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { missions } from '../app/datas/missions.ts'
import { teams } from '../app/datas/teams.ts'
import { buildMissionsSql } from './missions-sql.mjs'
import { buildTeamsSql } from './teams-sql.mjs'

const kind = process.argv[2] ?? 'all'
const parts = []

if (kind === 'teams' || kind === 'all') parts.push({ sql: buildTeamsSql(teams), label: `${teams.length} squadre` })
if (kind === 'missions' || kind === 'all') parts.push({ sql: buildMissionsSql(missions), label: `${missions.length} missioni` })

if (!parts.length) {
  console.error('Uso: node scripts/sync-migration.mjs [missions|teams|all]')
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
const file = fileURLToPath(new URL(`../supabase/migrations/${stamp}_sync_${kind}.sql`, import.meta.url))

writeFileSync(file, parts.map((part) => part.sql).join('\n'))
console.log(`Creata supabase/migrations/${stamp}_sync_${kind}.sql (${parts.map((part) => part.label).join(', ')})`)
console.log('Per applicarla: npm run db:push')
