<script setup lang="ts">
import type { ProofRow } from '../types/export'

const props = defineProps<{ pin: string }>()

const rows = ref<ProofRow[]>([])
const error = ref('')
const progress = ref<Record<number, string>>({})
const busyTeam = ref<number | null>(null)

const teams = computed(() => {
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
    rows.value = await withLoader(() => adminListProofs(props.pin), 'CARICO LE PROVE...')
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function downloadTeam(team: { teamId: number; name: string; rows: ProofRow[] }) {
  error.value = ''
  busyTeam.value = team.teamId

  try {
    const zip = await buildZip(
      team.rows,
      (path) => downloadProofFile(props.pin, path),
      (done, total) => {
        progress.value = { ...progress.value, [team.teamId]: `${done}/${total}` }
      }
    )

    saveFile(`${team.name}.zip`, zip, 'application/zip')
  } catch (e) {
    error.value = errorMessage(e, 'Download non riuscito')
  } finally {
    busyTeam.value = null
  }
}

function downloadCsv() {
  saveFile('prove.csv', buildCsv(rows.value), 'text/csv;charset=utf-8')
}
</script>

<template>
  <div class="adm-grid">
    <div class="adm-row">
      <button class="adm-btn" type="button" @click="load">CARICA ELENCO PROVE</button>
      <button class="adm-btn primary" type="button" :disabled="!rows.length" @click="downloadCsv">
        SCARICA INDICE (CSV)
      </button>
    </div>

    <p v-if="error" class="adm-error" role="alert">{{ error }}</p>

    <div v-for="team in teams" :key="team.teamId" class="adm-card">
      <div class="adm-row">
        <strong>{{ team.name }}</strong>
        <span class="adm-muted">{{ team.rows.length }} missioni · {{ filesCount(team.rows) }} file</span>
      </div>
      <button class="adm-btn" type="button" :disabled="busyTeam !== null" @click="downloadTeam(team)">
        {{ busyTeam === team.teamId ? `SCARICO ${progress[team.teamId] ?? ''}` : 'SCARICA ZIP' }}
      </button>
    </div>
  </div>
</template>
