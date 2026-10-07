<script setup lang="ts">
import type { AdminLogRow, AdminOverview, AdminTeam, GameStatus } from '../../types/admin'

useHead({ title: 'Admin' })

const STUCK_MINUTES = 20

const session = useAdminSession('irenegade')
const overview = ref<AdminOverview | null>(null)
const log = ref<AdminLogRow[]>([])
const error = ref('')
const busy = ref(false)
const now = ref(Date.now())

type Inputs = { assign: number | null; cancel: number | null; delta: number | null; reason: string }
const inputs = reactive<Record<number, Inputs>>({})
const inputOf = (teamId: number) =>
  (inputs[teamId] ??= { assign: null, cancel: null, delta: null, reason: '' })

let refreshTimer: ReturnType<typeof setInterval> | undefined

function minutesSince(iso: string) {
  return Math.max(0, Math.floor((now.value - new Date(iso).getTime()) / 60000))
}

const isStuck = (team: AdminTeam) =>
  !!team.activeMission && minutesSince(team.activeMission.assignedAt) >= STUCK_MINUTES

async function refresh(options: { silent?: boolean } = {}) {
  now.value = Date.now()

  try {
    const load = () => adminOverview(session.pin.value)
    overview.value = options.silent ? await load() : await withLoader(load, 'CARICO...')
  } catch (e) {
    if (!options.silent) error.value = errorMessage(e)
  }
}

// Il PIN si valida con la prima chiamata vera: nessun login a parte.
async function enter(pin: string) {
  error.value = ''
  busy.value = true
  session.save(pin)

  try {
    overview.value = await withLoader(() => adminOverview(pin), 'ACCESSO...')
    refreshTimer ??= setInterval(() => refresh({ silent: true }), 15000)
  } catch (e) {
    session.clear()
    overview.value = null
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

// Esegue un'azione, poi ricarica la panoramica.
async function run(action: () => Promise<unknown>, loaderText: string) {
  error.value = ''
  busy.value = true

  try {
    await withLoader(action, loaderText)
    await refresh({ silent: true })
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

const setGame = (next: GameStatus) => run(() => adminSetGame(session.pin.value, next), 'AGGIORNO...')

function unblock(team: AdminTeam) {
  if (!confirm(`Sbloccare ${team.name}? La missione attiva torna disponibile e ne riceve un'altra.`)) return
  return run(() => adminUnblockTeam(session.pin.value, team.teamId), 'SBLOCCO...')
}

function assign(team: AdminTeam) {
  const missionId = inputOf(team.teamId).assign
  if (missionId === null) return
  return run(() => adminAssignMission(session.pin.value, team.teamId, missionId), 'ASSEGNO...')
}

function cancel(team: AdminTeam) {
  const missionId = inputOf(team.teamId).cancel
  if (missionId === null || !confirm('Annullare la missione? I punti vengono tolti e la missione torna disponibile.')) return
  inputOf(team.teamId).cancel = null
  return run(() => adminCancelCompletion(session.pin.value, team.teamId, missionId), 'ANNULLO...')
}

function adjust(team: AdminTeam) {
  const { delta, reason } = inputOf(team.teamId)
  if (!delta) return
  return run(async () => {
    await adminAdjustPoints(session.pin.value, team.teamId, delta, reason)
    inputs[team.teamId] = { assign: null, cancel: null, delta: null, reason: '' }
  }, 'AGGIORNO PUNTI...')
}

function resetTeam(team: AdminTeam) {
  if (!confirm(`Azzerare ${team.name}? Perde missioni e punti.`)) return
  return run(() => adminResetTeam(session.pin.value, team.teamId), 'AZZERO...')
}

function resetGame() {
  const answer = prompt('Azzera TUTTE le squadre. Scrivi RESET per confermare.')
  if (answer === null) return
  return run(() => adminResetGame(session.pin.value, answer), 'AZZERO TUTTO...')
}

async function loadLog() {
  error.value = ''

  try {
    log.value = await withLoader(() => adminGetLog(session.pin.value), 'CARICO...')
  } catch (e) {
    error.value = errorMessage(e)
  }
}

function logout() {
  session.clear()
  overview.value = null
  clearInterval(refreshTimer)
  refreshTimer = undefined
}

onMounted(async () => {
  session.restore()

  if (session.pin.value) {
    await enter(session.pin.value)
  }
})

onBeforeUnmount(() => clearInterval(refreshTimer))
</script>

<template>
  <AdminShell title="IRENEGADE · ADMIN">
    <AdminPinForm v-if="!overview" :busy="busy" :error="error" @submit="enter" />

    <template v-else>
      <p v-if="error" class="adm-error" role="alert">{{ error }}</p>

      <section class="adm-section">
        <h2>SPAZIO</h2>
        <StorageUsage :pin="session.pin.value" />
      </section>

      <section class="adm-section">
        <h2>GIOCO</h2>
        <GameSwitches :status="overview.status" :busy="busy" @change="setGame" />
      </section>

      <section class="adm-section">
        <h2>SQUADRE</h2>

        <div class="adm-grid">
          <div v-for="team in overview.teams" :key="team.teamId" class="adm-card" :class="{ 'adm-warn': isStuck(team) }">
            <div class="adm-row">
              <strong>{{ team.name }}</strong>
              <span>{{ team.score }} pt</span>
              <span class="adm-muted">{{ team.completed }} fatte · {{ team.skipped }} scartate</span>
              <span v-if="team.adjustments" class="adm-muted">({{ team.adjustments > 0 ? '+' : '' }}{{ team.adjustments }} correzioni)</span>
            </div>

            <p class="adm-muted">
              <template v-if="team.activeMission">
                In corso: {{ team.activeMission.title }}
                <strong v-if="isStuck(team)"> · ferma da {{ minutesSince(team.activeMission.assignedAt) }} min</strong>
              </template>
              <template v-else>Nessuna missione attiva</template>
            </p>

            <button class="adm-btn primary" type="button" :disabled="busy" @click="unblock(team)">
              SBLOCCA SQUADRA
            </button>

            <div class="adm-row">
              <select v-model="inputOf(team.teamId).assign">
                <option :value="null">Assegna una missione…</option>
                <option v-for="m in overview.missions" :key="m.id" :value="m.id">{{ m.id }} · {{ m.title }}</option>
              </select>
              <button class="adm-btn" type="button" :disabled="busy || inputOf(team.teamId).assign === null" @click="assign(team)">ASSEGNA</button>
            </div>

            <div class="adm-row">
              <select v-model="inputOf(team.teamId).cancel">
                <option :value="null">Annulla una completata…</option>
                <option v-for="m in team.completedMissions" :key="m.id" :value="m.id">{{ m.title }} (+{{ m.points }})</option>
              </select>
              <button class="adm-btn danger" type="button" :disabled="busy || inputOf(team.teamId).cancel === null" @click="cancel(team)">ANNULLA</button>
            </div>

            <div class="adm-row">
              <input v-model.number="inputOf(team.teamId).delta" type="number" inputmode="numeric" placeholder="± punti" style="width: 110px" />
              <input v-model="inputOf(team.teamId).reason" placeholder="Motivo" style="flex: 1; min-width: 120px" />
              <button class="adm-btn" type="button" :disabled="busy || !inputOf(team.teamId).delta || !inputOf(team.teamId).reason.trim()" @click="adjust(team)">APPLICA</button>
            </div>

            <button class="adm-btn danger" type="button" :disabled="busy" @click="resetTeam(team)">AZZERA SQUADRA</button>
          </div>
        </div>
      </section>

      <section class="adm-section">
        <h2>FOTO E VIDEO</h2>
        <ProofExport :pin="session.pin.value" />
      </section>

      <section class="adm-section">
        <h2>REGISTRO AZIONI</h2>
        <button class="adm-btn" type="button" @click="loadLog">CARICA REGISTRO</button>
        <ul class="adm-grid adm-muted" style="list-style: none; padding: 0">
          <li v-for="row in log" :key="row.id">
            {{ new Date(row.createdAt).toLocaleTimeString('it-IT') }} · {{ row.role }} · {{ row.action }}
            {{ JSON.stringify(row.details) }}
          </li>
        </ul>
      </section>

      <section class="adm-section">
        <h2>ZONA PERICOLOSA</h2>
        <button class="adm-btn danger" type="button" :disabled="busy" @click="resetGame">AZZERA TUTTO IL GIOCO</button>
      </section>

      <button class="adm-btn" type="button" @click="logout">ESCI</button>
    </template>
  </AdminShell>
</template>
