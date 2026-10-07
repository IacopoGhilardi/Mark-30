<script setup lang="ts">
import type { ProofRow } from '../types/export'

useHead({ title: 'Export prove', meta: [{ name: 'robots', content: 'noindex' }] })

const email = ref<string | null>(null)
const loginEmail = ref('')
const loginPassword = ref('')
const rows = ref<ProofRow[]>([])
const error = ref('')
const progress = ref<Record<number, string>>({})
const busyTeam = ref<number | null>(null)

const teamsWithProofs = computed(() => {
  const groups = new Map<number, { teamId: number; name: string; rows: ProofRow[] }>()

  for (const row of rows.value) {
    const group = groups.get(row.teamId) ?? { teamId: row.teamId, name: row.teamName, rows: [] }
    group.rows.push(row)
    groups.set(row.teamId, group)
  }

  return [...groups.values()]
})

const filesCount = (list: ProofRow[]) => list.filter((row) => row.proofPath).length

async function load() {
  error.value = ''

  try {
    rows.value = await withLoader(() => listProofs(), 'CARICO LE PROVE...')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Errore nel caricamento'
  }
}

async function login() {
  error.value = ''

  try {
    await withLoader(() => adminSignIn(loginEmail.value, loginPassword.value), 'ACCESSO...')
    email.value = await getAdminEmail()
    loginPassword.value = ''
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Accesso non riuscito'
  }
}

async function logout() {
  await adminSignOut()
  email.value = null
  rows.value = []
}

async function downloadTeam(team: { teamId: number; name: string; rows: ProofRow[] }) {
  error.value = ''
  busyTeam.value = team.teamId

  try {
    const zip = await buildZip(team.rows, downloadProofFile, (done, total) => {
      progress.value = { ...progress.value, [team.teamId]: `${done}/${total}` }
    })

    saveFile(`${team.name}.zip`, zip, 'application/zip')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Download non riuscito'
  } finally {
    busyTeam.value = null
  }
}

function downloadCsv() {
  saveFile('prove.csv', buildCsv(rows.value), 'text/csv;charset=utf-8')
}

onMounted(async () => {
  email.value = await getAdminEmail()

  if (email.value) {
    await load()
  }
})
</script>

<template>
  <main class="export">
    <h1>EXPORT PROVE</h1>

    <form v-if="!email" class="login" @submit.prevent="login">
      <input v-model="loginEmail" type="email" placeholder="Email" autocomplete="username" required />
      <input v-model="loginPassword" type="password" placeholder="Password" autocomplete="current-password" required />
      <button type="submit">ACCEDI</button>
    </form>

    <template v-else>
      <p class="who">
        {{ email }}
        <button class="link" type="button" @click="logout">Esci</button>
      </p>

      <button class="primary" type="button" :disabled="!rows.length" @click="downloadCsv">
        SCARICA INDICE (CSV)
      </button>

      <p v-if="!rows.length && !error" class="empty">Nessuna missione completata (o non sei admin).</p>

      <ul class="teams">
        <li v-for="team in teamsWithProofs" :key="team.teamId">
          <div>
            <strong>{{ team.name }}</strong>
            <span>{{ team.rows.length }} missioni · {{ filesCount(team.rows) }} file</span>
          </div>

          <button
            type="button"
            :disabled="busyTeam !== null"
            @click="downloadTeam(team)"
          >
            {{ busyTeam === team.teamId ? `SCARICO ${progress[team.teamId] ?? ''}` : 'SCARICA ZIP' }}
          </button>
        </li>
      </ul>
    </template>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>
.export {
  min-height: 100dvh;
  padding: 24px 20px 48px;
  background: #0a0a0a;
  color: #f5f5f2;
  font-family: Inter, 'Helvetica Neue', Arial, sans-serif;
}

h1 {
  margin: 0 0 24px;
  font-size: 22px;
  letter-spacing: 0.08em;
}

.login,
.teams {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

input {
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font-size: 16px;
}

button {
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font-weight: 700;
  letter-spacing: 0.06em;
}

button.primary,
.login button {
  margin-bottom: 20px;
  background: #f5f5f2;
  color: #0a0a0a;
}

button:disabled {
  opacity: 0.45;
}

.teams li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
}

.teams li div {
  display: grid;
  gap: 4px;
}

.teams span,
.who,
.empty {
  color: rgba(245, 245, 242, 0.6);
  font-size: 13px;
}

button.link {
  padding: 0 0 0 8px;
  border: 0;
  font-weight: 400;
  text-decoration: underline;
}

.error {
  margin-top: 20px;
  color: #ff7a7a;
}
</style>
