// Avvia il Supabase locale solo se non è già acceso. Usato da `npm run test:db`.
import { spawnSync } from 'node:child_process'
import { isSupabaseRunning } from './dev-env.mjs'

const status = spawnSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })

if (isSupabaseRunning(status.stdout ?? '')) {
  console.log('Supabase locale già in esecuzione')
} else {
  const started = spawnSync('npm', ['run', 'db:start'], { stdio: 'inherit' })
  process.exit(started.status ?? 1)
}
