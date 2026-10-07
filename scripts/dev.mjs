// Sviluppo locale in un comando: Supabase locale + migrations + dati di prova + Nuxt.
//   npm run dev:all
// Usa sempre il Supabase locale (ignora l'eventuale .env verso il cloud).
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isSupabaseRunning, nuxtEnvFromStatus, parseStatusEnv } from './dev-env.mjs'

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options })
}

function step(text) {
  console.log(`\n▶ ${text}`)
}

function fail(text) {
  console.error(`\n✖ ${text}`)
  process.exit(1)
}

// 1. Supabase locale (avvia solo se non è già acceso)
step('Supabase locale')

if (!isSupabaseRunning(run('npx', ['supabase', 'status', '-o', 'env']).stdout ?? '')) {
  const started = run('npm', ['run', 'db:start'], { stdio: 'inherit' })

  if (started.status !== 0) {
    fail('Impossibile avviare Supabase. Docker/Podman è acceso?')
  }
} else {
  console.log('già in esecuzione')
}

// 2. Migrations non ancora applicate (senza cancellare i dati)
step('Migrations')

if (run('npx', ['supabase', 'migration', 'up', '--local'], { stdio: 'inherit' }).status !== 0) {
  fail('Migrations fallite. Per ripartire da zero: npm run db:reset')
}

// 3. Dati di prova (PIN admin locali), idempotenti
if (existsSync('supabase/seed.sql')) {
  step('Dati di prova (PIN locali: marco 1111, irenegade 9999)')

  const seeded = run('psql', [DB_URL, '-q', '-f', 'supabase/seed.sql'])

  if (seeded.status !== 0) {
    console.warn('Seed non applicato (psql assente o DB non raggiungibile):', seeded.stderr?.trim())
    console.warn('Le pagine admin non accetteranno PIN finché non lo applichi.')
  }
}

// 4. Chiavi del Supabase locale -> Nuxt
step('Nuxt')

const status = run('npx', ['supabase', 'status', '-o', 'env'])
let env

try {
  env = nuxtEnvFromStatus(parseStatusEnv(status.stdout))
} catch (error) {
  fail(error.message)
}

console.log(`API locale: ${env.NUXT_PUBLIC_SUPABASE_URL}`)
console.log('Per fermare il DB quando hai finito: npm run db:stop\n')

const nuxt = spawn('npx', ['nuxt', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ...env },
})

nuxt.on('exit', (code) => process.exit(code ?? 0))
