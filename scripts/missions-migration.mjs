// Genera una migration che allinea il DB a app/datas/missions.ts.
// Uso: npm run db:missions   (poi: npm run db:push)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { missions } from '../app/datas/missions.ts'
import { buildMissionsSql } from './missions-sql.mjs'

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
const file = fileURLToPath(new URL(`../supabase/migrations/${stamp}_sync_missions.sql`, import.meta.url))

writeFileSync(file, buildMissionsSql(missions))
console.log(`Creata ${file.split('/supabase/')[1] ? 'supabase/' + file.split('/supabase/')[1] : file} (${missions.length} missioni)`)
