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
const updatedAt = ref('')

type Inputs = { assign: number | null; cancel: number | null; delta: number | null; sign: 1 | -1; reason: string }
const inputs = reactive<Record<number, Inputs>>({})
const inputOf = (teamId: number) =>
  (inputs[teamId] ??= { assign: null, cancel: null, delta: null, sign: 1, reason: '' })

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
    updatedAt.value = new Date().toLocaleTimeString('it-IT')
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

const statusLabel = computed(() => {
  const status = overview.value?.status

  if (!status) return ''
  if (!status.playEnabled) return 'GIOCO FERMO'
  if (!status.missionsEnabled) return 'MISSIONI FERME'

  return 'GIOCO ATTIVO'
})

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
  const { delta, sign, reason } = inputOf(team.teamId)
  if (!delta) return
  return run(async () => {
    await adminAdjustPoints(session.pin.value, team.teamId, Math.abs(delta) * sign, reason)
    inputs[team.teamId] = { assign: null, cancel: null, delta: null, sign: 1, reason: '' }
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
      <div class="adm-bar">
        <strong :class="statusLabel === 'GIOCO ATTIVO' ? 'adm-on' : 'adm-off'">● {{ statusLabel }}</strong>
        <button
          class="adm-btn"
          type="button"
          :disabled="busy"
          @click="setGame({ ...overview.status, playEnabled: !overview.status.playEnabled })"
        >
          {{ overview.status.playEnabled ? 'FERMA' : 'RIAVVIA' }}
        </button>
        <button class="adm-btn" type="button" :disabled="busy" @click="refresh()">↻</button>
        <span class="adm-muted" style="margin-left: auto">{{ updatedAt }}</span>
      </div>

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
          <details
            v-for="team in overview.teams"
            :key="team.teamId"
            class="adm-card adm-details"
            :class="{ 'adm-warn': isStuck(team) }"
            :open="isStuck(team)"
          >
            <summary>
              <strong>{{ team.name }}</strong>
              <span>{{ team.score }} pt</span>
              <span v-if="isStuck(team)" class="adm-badge adm-off">FERMA {{ minutesSince(team.activeMission!.assignedAt) }} MIN</span>
              <span v-else-if="!team.activeMission" class="adm-badge adm-muted">SENZA MISSIONE</span>
            </summary>

            <div class="adm-body">
              <p class="adm-muted">
                {{ team.completed }} fatte · {{ team.skipped }} scartate
                <template v-if="team.adjustments"> · {{ team.adjustments > 0 ? '+' : '' }}{{ team.adjustments }} correzioni</template>
              </p>

              <p class="adm-muted">
                <template v-if="team.activeMission">In corso: <strong>{{ team.activeMission.title }}</strong></template>
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

              <div class="adm-grid">
                <div class="adm-row">
                  <button
                    class="adm-btn"
                    :class="{ on: inputOf(team.teamId).sign === 1 }"
                    type="button"
                    @click="inputOf(team.teamId).sign = 1"
                  >+ AGGIUNGI</button>
                  <button
                    class="adm-btn"
                    :class="{ on: inputOf(team.teamId).sign === -1 }"
                    type="button"
                    @click="inputOf(team.teamId).sign = -1"
                  >− TOGLI</button>
                </div>

                <div class="adm-row">
                  <input v-model.number="inputOf(team.teamId).delta" type="number" inputmode="numeric" min="1" placeholder="Punti" style="flex: 1 1 90px" />
                  <input v-model="inputOf(team.teamId).reason" placeholder="Motivo" enterkeyhint="done" style="flex: 3 1 160px" />
                </div>

                <button
                  class="adm-btn"
                  type="button"
                  :disabled="busy || !inputOf(team.teamId).delta || !inputOf(team.teamId).reason.trim()"
                  @click="adjust(team)"
                >APPLICA PUNTI</button>
              </div>

              <button class="adm-btn danger" type="button" :disabled="busy" @click="resetTeam(team)">AZZERA SQUADRA</button>
            </div>
          </details>
        </div>
      </section>

      <section class="adm-section">
        <h2>FOTO E VIDEO</h2>
        <ProofExport :pin="session.pin.value" />
      </section>

      <section class="adm-section">
        <h2>QR DELLE SQUADRE</h2>
        <TeamQrCodes />
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
