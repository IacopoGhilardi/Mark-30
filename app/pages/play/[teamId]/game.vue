<script setup lang="ts">
import { teams } from '../../../datas/teams'
import type { Mission } from '../../../datas/missions'
import type { GameStatus } from '../../../types/admin'
import type {
  ActiveMission,
  CompletedMission,
  TeamState,
} from '../../../types/game'

// ready: missione mostrata | active: in corso | proof: invio prova
// completed: appena completata | finished: nessuna missione nuova
type GameStep = 'ready' | 'active' | 'proof' | 'completed' | 'finished'

// Al quinto tocco su "salta" Vince cede e la missione cambia davvero.
const SKIP_AFTER_CLICKS = 5

const route = useRoute()
const { hideLoader } = useAppLoader()

const teamId = computed(() => Number(route.params.teamId))

const team = computed(() => {
  return teams.find((item) => item.id === teamId.value)
})

const score = ref(0)
const missionNumber = ref(1)
const step = ref<GameStep>('ready')
const showGameIntro = ref(true)

const completedMissionIds = ref<number[]>([])
const currentMission = ref<Mission | null>(null)
const teamState = ref<TeamState | null>(null)

const textProof = ref('')
const selectedFileName = ref('')
const selectedFile = ref<File | null>(null)

const isReady = ref(false)
const loadError = ref('')
const errorMessage = ref('')
const busy = ref(false)
const currentPosition = ref<number | null>(null)
const gameStatus = ref<GameStatus>({
  missionsEnabled: true,
  playEnabled: true,
})

const fakeSkipClicks = ref(0)
const showVinceMessage = ref(false)

const vinceMessages = [
  'BEL TENTATIVO.',
  'SEI SICURO?',
  'VINCE TI STA GIUDICANDO.',
  'LA MISSIONE NON SI SALTA.',
  'VA BENE. CAMBIO.',
]

const vinceMessage = computed(() => {
  const index = Math.min(
    Math.max(fakeSkipClicks.value - 1, 0),
    vinceMessages.length - 1
  )

  return vinceMessages[index]
})

let vinceTimer: ReturnType<typeof setTimeout> | null = null

const playPaused = computed(() => !gameStatus.value.playEnabled)
const missionsPaused = computed(
  () => playPaused.value || !gameStatus.value.missionsEnabled
)
const allDone = computed(() => Boolean(teamState.value?.allDone))
const skippedMissions = computed(() => teamState.value?.skippedMissions ?? [])

const categoryIcon = computed(() => {
  if (!currentMission.value) return '●'

  switch (currentMission.value.category) {
    case 'TAKE THE SHOT':
      return '📸'

    case 'MIX IT UP':
      return '🫱🏼‍🫲🏽'

    case 'CAUSE SOME CHAOS':
      return '🧨'

    case 'FOR MARCO':
      return '❤️'

    default:
      return '●'
  }
})

const proofLabel = computed(() => {
  const type = currentMission.value?.proofType

  switch (type) {
    case 'photo':
      return 'PROVA: FOTO'

    case 'video':
      return 'PROVA: VIDEO'

    case 'text':
      return 'PROVA: TESTO'

    case 'photo_optional':
      return 'FOTO FACOLTATIVA'

    case 'video_or_text':
      return 'PROVA: VIDEO O TESTO'

    case 'optional_text':
      return 'TESTO FACOLTATIVO'

    default:
      return 'NESSUNA PROVA'
  }
})

const needsRequiredProof = computed(() => {
  const type = currentMission.value?.proofType

  return (
    type === 'photo' ||
    type === 'video' ||
    type === 'text' ||
    type === 'video_or_text'
  )
})

const usesTextProof = computed(() => {
  const type = currentMission.value?.proofType

  return (
    type === 'text' ||
    type === 'optional_text' ||
    type === 'video_or_text'
  )
})

const usesFileProof = computed(() => {
  const type = currentMission.value?.proofType

  return (
    type === 'photo' ||
    type === 'video' ||
    type === 'photo_optional' ||
    type === 'video_or_text'
  )
})

const fileAccept = computed(() => {
  const type = currentMission.value?.proofType

  if (type === 'photo' || type === 'photo_optional') {
    return 'image/*'
  }

  if (type === 'video') {
    return 'video/*'
  }

  return 'image/*,video/*'
})

const proofIsValid = computed(() => {
  const type = currentMission.value?.proofType

  if (type === 'photo' || type === 'video') {
    return Boolean(selectedFile.value)
  }

  if (type === 'text') {
    return textProof.value.trim().length > 0
  }

  if (type === 'video_or_text') {
    return (
      Boolean(selectedFile.value) ||
      textProof.value.trim().length > 0
    )
  }

  return true
})

// ---------------------------------------------------------------- stato locale
// Lo stato del gioco sta nel DB. Nel telefono resta solo ciò che è di
// interfaccia: a che punto della missione si è (iniziata/prova) e la bozza del testo.

const uiKey = computed(() => `marcos30-ui-${teamId.value}`)
const introKey = computed(() => `marcos30-intro-${teamId.value}`)
const draftKey = (missionId: number) => `marcos30-draft-${teamId.value}-${missionId}`

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // storage non disponibile: si perde solo la comodità del ripristino
  }
}

function saveUi() {
  const mission = currentMission.value

  if (
    mission &&
    (step.value === 'ready' || step.value === 'active' || step.value === 'proof')
  ) {
    writeLocal(uiKey.value, JSON.stringify({ missionId: mission.id, step: step.value }))
  } else {
    writeLocal(uiKey.value, null)
  }
}

// Rientrando sulla stessa missione si riprende dal punto salvato. Da un altro
// telefono (niente stato locale) si riparte da "in corso".
function restoreStep(missionId: number, fallback: 'ready' | 'active') {
  try {
    const saved = JSON.parse(readLocal(uiKey.value) ?? 'null')

    if (saved?.missionId === missionId && ['ready', 'active', 'proof'].includes(saved.step)) {
      return saved.step as 'ready' | 'active' | 'proof'
    }
  } catch {
    // stato locale illeggibile: si ignora
  }

  return fallback
}

watch(textProof, (value) => {
  if (step.value === 'proof' && currentMission.value) {
    writeLocal(draftKey(currentMission.value.id), value || null)
  }
})

function resetProof() {
  textProof.value = ''
  selectedFileName.value = ''
  selectedFile.value = null
}

function loadDraft(missionId: number) {
  textProof.value = readLocal(draftKey(missionId)) ?? ''
}

function enterGame() {
  showGameIntro.value = false
  writeLocal(introKey.value, '1')
}

// ---------------------------------------------------------------- stato dal server

const toMission = (mission: ActiveMission) =>
  ({ ...mission, active: true }) as Mission

// La schermata "completata" di un altro telefono ricostruita dall'ultimo completamento.
const fromCompleted = (completed: CompletedMission) =>
  ({
    id: completed.missionId,
    title: completed.title,
    category: completed.category,
    text: '',
    proofType: 'none',
    points: completed.points,
    requiresMarco: false,
    active: true,
  }) as Mission

// Allinea l'interfaccia allo stato del server. `fresh` indica una missione
// appena assegnata (si parte da "ready"), altrimenti si riprende da "active".
async function applyState(
  next: TeamState,
  options: { fresh?: boolean; silent?: boolean; advance?: boolean } = {}
) {
  teamState.value = next
  score.value = next.score
  missionNumber.value = next.missionNumber
  completedMissionIds.value = next.completedMissionIds

  if (next.activeMission) {
    const sameMission = currentMission.value?.id === next.activeMission.id
    const inProgress =
      step.value === 'ready' || step.value === 'active' || step.value === 'proof'

    currentMission.value = toMission(next.activeMission)

    if (!(sameMission && inProgress)) {
      resetProof()
      fakeSkipClicks.value = 0
      showVinceMessage.value = false
      step.value = restoreStep(next.activeMission.id, options.fresh ? 'ready' : 'active')

      if (step.value === 'proof') {
        loadDraft(next.activeMission.id)
      }

      saveUi()
    }

    return
  }

  // nessuna missione attiva per il server. Se la squadra sta guardando la
  // schermata "completata" ci resta, finché non chiede la prossima (advance).
  if (step.value === 'completed' && currentMission.value && !options.advance) {
    return
  }

  if (next.canRedrawSkipped || next.allDone) {
    currentMission.value = null
    step.value = 'finished'
    saveUi()
    return
  }

  if (next.completedMissionIds.length > 0) {
    // squadra che rientra dopo una missione completata (anche da un altro telefono)
    const [last] = await getCompletedMissions({ teamId: teamId.value, limit: 1 })

    if (last) {
      currentMission.value = fromCompleted(last)
      step.value = 'completed'
      saveUi()
      return
    }
  }

  // squadra nuova (o azzerata da un admin): si estrae la prima missione
  try {
    await applyState(await drawMission(teamId.value), { fresh: true, silent: options.silent })
  } catch (error) {
    if (!options.silent) {
      errorMessage.value = gameErrorMessage(error)
    }
  }
}

async function refreshPosition() {
  const rows = await getLeaderboard()
  const mine = rows.find((row) => row.teamId === teamId.value)

  currentPosition.value = mine?.position ?? null
}

// Aggiornamento silenzioso: tiene allineati più telefoni della stessa squadra,
// la pausa del gioco e la posizione. Salta se c'è un'azione in corso.
async function syncFromServer() {
  if (!isReady.value || busy.value || !team.value) return

  try {
    const [next, status] = await Promise.all([
      getTeamState(teamId.value),
      getGameStatus(),
      refreshPosition(),
    ])

    gameStatus.value = status

    if (!busy.value) {
      await applyState(next, { silent: true })
    }
  } catch {
    // rete assente: si riprova al prossimo giro
  }
}

async function loadInitial() {
  loadError.value = ''

  try {
    const [next, status] = await withLoader(
      () => Promise.all([getTeamState(teamId.value), getGameStatus()]),
      'PREPARAZIONE MISSIONE...'
    )

    gameStatus.value = status

    // Le regole si vedono la prima volta; chi ricarica o rientra non le rivede
    if (readLocal(introKey.value) === '1') {
      showGameIntro.value = false
    }

    await withLoader(() => applyState(next), 'PREPARAZIONE MISSIONE...')
    await refreshPosition().catch(() => undefined)
    isReady.value = true
  } catch (error) {
    loadError.value = gameErrorMessage(error)
  }
}

// ---------------------------------------------------------------- azioni

// Esegue un'azione sul server mostrando il loader. Su errore mostra un messaggio
// chiaro; se il telefono era rimasto indietro ricarica lo stato.
async function runAction(
  task: () => Promise<TeamState>,
  loaderText: string,
  options: { fresh?: boolean; advance?: boolean } = {}
) {
  if (busy.value) return false

  busy.value = true
  errorMessage.value = ''

  try {
    const next = await withLoader(task, loaderText)
    await applyState(next, options)
    refreshPosition().catch(() => undefined)

    return true
  } catch (error) {
    errorMessage.value = gameErrorMessage(error)

    if (isStaleError(error)) {
      busy.value = false
      await syncFromServer()
    }

    return false
  } finally {
    busy.value = false
  }
}

function startMission() {
  step.value = 'active'
  saveUi()
}

function markMissionDone() {
  if (!currentMission.value) return

  if (currentMission.value.proofType === 'none') {
    finishMission()
    return
  }

  errorMessage.value = ''
  step.value = 'proof'
  loadDraft(currentMission.value.id)
  saveUi()
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  errorMessage.value = ''

  if (file.type.startsWith('video/')) {
    if (file.size > MAX_PROOF_BYTES) {
      errorMessage.value =
        'Il video pesa troppo (max 20 MB). Registratene uno di 10 secondi in 1080p.'
      input.value = ''
      return
    }

    const seconds = await getVideoDuration(file)

    if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
      errorMessage.value = `Il video dura ${Math.round(seconds)} secondi: massimo 10.`
      input.value = ''
      return
    }
  }

  selectedFile.value = file
  selectedFileName.value = file.name
}

function submitProof() {
  if (!proofIsValid.value) return

  finishMission()
}

function skipOptionalProof() {
  if (!currentMission.value) return

  if (
    currentMission.value.proofType !== 'photo_optional' &&
    currentMission.value.proofType !== 'optional_text'
  ) {
    return
  }

  resetProof()
  finishMission()
}

async function finishMission() {
  const mission = currentMission.value

  if (!mission || busy.value) return

  const proof = {
    text: textProof.value.trim() || null,
    file: selectedFile.value,
  }

  // Resta su "proof" finché il server non conferma: se l'invio fallisce
  // (rete, upload) la squadra riprova senza perdere testo o file scelto.
  const done = await runAction(
    async () => {
      step.value = 'proof'
      const next = await completeMission(teamId.value, mission.id, proof)
      step.value = 'completed'
      return next
    },
    proof.file
      ? 'INVIO DELLA PROVA... RESTA SU QUESTA PAGINA'
      : 'INVIO DELLA PROVA...'
  )

  if (done) {
    writeLocal(draftKey(mission.id), null)
    resetProof()
    saveUi()
  } else if (step.value === 'completed') {
    step.value = 'proof'
  }
}

function nextMission() {
  return runAction(
    () => drawMission(teamId.value),
    'ESTRAZIONE NUOVA MISSIONE...',
    { fresh: true, advance: true }
  )
}

function redrawSkipped(missionId?: number) {
  return runAction(
    () => redrawSkippedMission(teamId.value, missionId),
    'RECUPERO LA MISSIONE...',
    { fresh: true, advance: true }
  )
}

// Il salto di Vince: i primi tentativi sono una presa in giro, al quinto
// Vince cede e la missione cambia davvero.
function trySkipMission() {
  fakeSkipClicks.value += 1
  showVinceMessage.value = true

  if (vinceTimer) {
    clearTimeout(vinceTimer)
  }

  vinceTimer = setTimeout(() => {
    showVinceMessage.value = false
  }, 2000)

  if (fakeSkipClicks.value >= SKIP_AFTER_CLICKS && currentMission.value) {
    const mission = currentMission.value

    skipCurrentMission(mission.id)
  }
}

function skipCurrentMission(missionId: number) {
  return runAction(
    () => skipMission(teamId.value, missionId),
    'VINCE STA CAMBIANDO LA MISSIONE...',
    { fresh: true }
  )
}

// Sincronizzazione con il server ogni 10 secondi, solo con la scheda visibile
usePolling(syncFromServer, 10000)

onMounted(() => {
  if (team.value) {
    loadInitial()
  } else {
    isReady.value = true
  }
})

onUnmounted(() => {
  hideLoader()

  if (vinceTimer) {
    clearTimeout(vinceTimer)
  }
})

useHead({
  title: computed(() =>
    team.value
      ? `${team.value.name} — Missioni`
      : "Marco's 30th"
  ),
})
</script>

<template>
  <main class="game-page">
    <section
      v-if="team && isReady && !loadError && playPaused"
      class="stop-screen"
      role="status"
    >
      <img
        src="/images/vince-skip.png"
        alt="Vince"
        class="stop-vince"
      >

      <p class="stop-eyebrow">
        STOP AL GIOCO
      </p>

      <h1>
        FERMI<br>
        TUTTI.
      </h1>

      <p class="stop-copy">
        Il gioco è in pausa o è finito.
        Mettete via il telefono: se riparte, lo vedrete qui.
      </p>

      <div class="stop-stats">
        <div>
          <span>POSIZIONE</span>
          <strong>#{{ currentPosition ?? '-' }}</strong>
        </div>

        <div>
          <span>PUNTI</span>
          <strong>{{ score }}</strong>
        </div>

        <div>
          <span>COMPLETATE</span>
          <strong>{{ completedMissionIds.length }}</strong>
        </div>
      </div>

      <NuxtLink
        :to="{ path: '/classifica', query: { team: teamId } }"
        class="leaderboard-link"
      >
        <span>
          VEDI LA CLASSIFICA LIVE
        </span>

        <span>↗</span>
      </NuxtLink>
    </section>

    <section
      v-else-if="team && isReady && !loadError && (currentMission || step === 'finished')"
      class="game-shell"
    >
      <header class="topbar">
        <div>
          <p class="brand">MARCO'S 30TH</p>
          <p class="team-name">{{ team.name }}</p>
        </div>

        <div class="top-stats">
          <div class="top-stat">
            <span>POSIZIONE</span>

            <strong>
              #{{ currentPosition ?? '-' }}
            </strong>
          </div>

          <div class="top-stat score">
            <span>PUNTI</span>
            <strong>{{ score }}</strong>
          </div>
        </div>
      </header>

      <NuxtLink
        v-if="!showGameIntro"
        :to="{ path: '/classifica', query: { team: teamId } }"
        class="leaderboard-link"
      >
        <span>
          VEDI CLASSIFICA LIVE
        </span>

        <span>↗</span>
      </NuxtLink>

      <div class="separator"></div>

      <p
        v-if="missionsPaused"
        class="pause-banner"
        role="status"
      >
        NUOVE MISSIONI IN PAUSA. ASPETTATE CHE RIPARTANO.
      </p>

      <section
        v-if="showGameIntro"
        class="game-intro"
      >
        <p class="intro-eyebrow">
          REGOLE DEL GIOCO
        </p>

        <h1>
          AVETE TUTTA<br>
          LA CENA.
        </h1>

        <p class="intro-copy">
          Le missioni possono arrivare in qualsiasi momento.
          Giocate, mangiate, bevete e aspettate il momento giusto.
        </p>

        <div class="intro-rule">
          <span class="intro-emoji">👀</span>

          <div>
            <strong>NON FATEVI SGAMARE.</strong>
            <p>
              Le altre squadre non devono capire
              quali sono le vostre missioni.
            </p>
          </div>
        </div>

        <div class="intro-rule">
          <span class="intro-emoji">🎂</span>

          <div>
            <strong>AVETE TEMPO FINO ALLA TORTA.</strong>
            <p>
              Quando arriva la torta, il gioco finisce.
            </p>
          </div>
        </div>

        <p class="intro-score">
          PIÙ MISSIONI COMPLETATE,<br>
          PIÙ PUNTI CONQUISTATE.
        </p>

        <button
          class="primary-button intro-button"
          type="button"
          @click="enterGame"
        >
          <span>INIZIA IL GIOCO</span>
          <span>→</span>
        </button>

        <p class="intro-luck">
          BUONA FORTUNA.
        </p>
      </section>

      <section
        v-else-if="step === 'finished'"
        class="mission"
      >
        <template v-if="allDone">
          <h1>AVETE FINITO<br>TUTTE LE MISSIONI.</h1>

          <p class="mission-text">
            Siete leggende. Ora godetevi la festa.
          </p>
        </template>

        <template v-else>
          <h1>MISSIONI NUOVE<br>FINITE.</h1>

          <p class="mission-text">
            Potete riprovare una di quelle che avete scartato.
          </p>

          <div class="action-area">
            <button
              v-for="skipped in skippedMissions"
              :key="skipped.id"
              class="skip-button"
              type="button"
              :disabled="busy || missionsPaused"
              @click="redrawSkipped(skipped.id)"
            >
              {{ skipped.title }} · +{{ skipped.points }} PT
            </button>

            <button
              class="primary-button"
              type="button"
              :disabled="busy || missionsPaused"
              @click="redrawSkipped()"
            >
              <span>DAMMENE UNA A CASO</span>
              <span>→</span>
            </button>

            <p
              v-if="errorMessage"
              class="game-error"
              role="alert"
            >
              {{ errorMessage }}
            </p>
          </div>
        </template>
      </section>

      <section
        v-else-if="currentMission"
        class="mission"
      >
        <div class="mission-meta">
          <span>
            MISSIONE
            #{{ String(missionNumber).padStart(2, '0') }}
          </span>

          <span
            v-if="step === 'active'"
            class="live"
          >
            ● IN CORSO
          </span>
        </div>

        <div class="category">
          <span>{{ categoryIcon }}</span>
          <span>{{ currentMission.category }}</span>
        </div>

        <h1>{{ currentMission.title }}</h1>

        <p
          v-if="currentMission.text"
          class="mission-text"
        >
          {{ currentMission.text }}
        </p>

        <div class="mission-details">
          <div class="detail">
            <span class="detail-label">
              PROVA
            </span>

            <strong>
              {{ proofLabel }}
            </strong>
          </div>

          <div class="detail points-detail">
            <span class="detail-label">
              VALORE
            </span>

            <strong>
              +{{ currentMission.points }} PT
            </strong>
          </div>
        </div>

        <div
          v-if="step === 'ready'"
          class="action-area"
        >
          <p class="hint">
            Quando siete pronti, fate partire la missione.
          </p>

          <button
            class="primary-button"
            type="button"
            @click="startMission"
          >
            <span>INIZIA LA MISSIONE</span>
            <span>→</span>
          </button>
        </div>

        <div
          v-else-if="step === 'active'"
          class="action-area"
        >
          <p class="active-message">
            LA MISSIONE È ATTIVA.
          </p>

          <p class="hint">
            Tornate qui quando l'avete completata.
          </p>

          <button
            class="primary-button"
            type="button"
            :disabled="playPaused"
            @click="markMissionDone"
          >
            <span>MISSIONE COMPLETATA</span>
            <span>✓</span>
          </button>

          <button
            class="vince-skip-button"
            type="button"
            :disabled="missionsPaused"
            @click="trySkipMission"
          >
            <img
              src="/images/vince-skip.png"
              alt="Vince"
              class="vince-face"
            >

            <span class="vince-skip-copy">
              <span class="vince-small">NON AVETE VOGLIA?</span>
              <strong>SALTA MISSIONE</strong>
            </span>

            <span class="vince-arrow">→</span>
          </button>

          <p
            v-if="errorMessage"
            class="game-error"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <Transition name="vince-pop">
            <div
              v-if="showVinceMessage"
              class="vince-message"
            >
              <img
                src="/images/vince-skip.png"
                alt="Vince"
                class="vince-message-face"
              >

              <div>
                <p>{{ vinceMessage }}</p>
                <span>VINCE NON APPROVA.</span>
              </div>
            </div>
          </Transition>
        </div>

        <div
          v-else-if="step === 'proof'"
          class="proof-area"
        >
          <div class="proof-heading">
            <div class="proof-icon">
              {{
                currentMission.proofType === 'video'
                  ? '🎥'
                  : currentMission.proofType === 'text' ||
                      currentMission.proofType === 'optional_text'
                    ? '✍️'
                    : '📸'
              }}
            </div>

            <p class="proof-eyebrow">
              PROVA O NON È SUCCESSO.
            </p>

            <h2>MANDA LA PROVA.</h2>

            <p>
              Questa potrebbe finire nei ricordi di Marco. 👀
            </p>
          </div>

          <label
            v-if="usesFileProof"
            class="file-picker"
          >
            <input
              type="file"
              :accept="fileAccept"
              @change="handleFile"
            >

            <span class="file-plus">+</span>

            <span v-if="!selectedFileName">
              {{
                currentMission.proofType === 'video'
                  ? 'SCEGLI O REGISTRA UN VIDEO'
                  : currentMission.proofType === 'video_or_text'
                    ? 'SCEGLI FOTO O VIDEO'
                    : 'SCEGLI O SCATTA UNA FOTO'
              }}
            </span>

            <span
              v-else
              class="selected-file"
            >
              ✓ {{ selectedFileName }}
            </span>
          </label>

          <div
            v-if="usesTextProof"
            class="text-proof"
          >
            <label for="proof-text">
              SCRIVI QUI
            </label>

            <textarea
              id="proof-text"
              v-model="textProof"
              maxlength="500"
              placeholder="La vostra risposta..."
            ></textarea>

            <span class="counter">
              {{ textProof.length }}/500
            </span>
          </div>

          <button
            class="primary-button"
            :class="{ disabled: !proofIsValid || playPaused }"
            :disabled="!proofIsValid || busy || playPaused"
            type="button"
            @click="submitProof"
          >
            <span>
              {{
                needsRequiredProof
                  ? 'INVIA LA PROVA'
                  : 'SALVA E COMPLETA'
              }}
            </span>

            <span>→</span>
          </button>

          <p
            v-if="errorMessage"
            class="game-error"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <button
            v-if="
              currentMission.proofType === 'photo_optional' ||
              currentMission.proofType === 'optional_text'
            "
            class="skip-button"
            type="button"
            @click="skipOptionalProof"
          >
            CONTINUA SENZA PROVA
          </button>
        </div>

        <div
          v-else-if="step === 'completed'"
          class="completed-area"
        >
          <div class="check">
            ✓
          </div>

          <p class="completed-label">
            MISSIONE COMPLETATA
          </p>

          <p class="points-earned">
            +{{ currentMission.points }} PT
          </p>

          <p class="new-position">
            ORA SIETE IN POSIZIONE
            <strong>#{{ currentPosition ?? '-' }}</strong>
          </p>

          <p class="memory-message">
            Questa finirà nei ricordi di Marco. 👀
          </p>

          <p
            v-if="errorMessage"
            class="game-error"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <button
            class="primary-button"
            type="button"
            :disabled="busy || missionsPaused"
            @click="nextMission"
          >
            <span>
              ESTRAI UNA NUOVA MISSIONE
            </span>

            <span>→</span>
          </button>
        </div>
      </section>

      <footer>
        <span>
          SQUADRA {{ String(team.id).padStart(2, '0') }}
        </span>

        <span>●</span>

        <span>
          {{ completedMissionIds.length }} COMPLETATE
        </span>
      </footer>
    </section>

    <section
      v-else-if="!team"
      class="error-screen"
    >
      <p>404</p>

      <h1>
        SQUADRA NON TROVATA.
      </h1>

      <NuxtLink to="/">
        TORNA ALL'INIZIO
      </NuxtLink>
    </section>

    <section
      v-else-if="loadError"
      class="error-screen"
    >
      <p>OPS</p>

      <h1>
        {{ loadError }}
      </h1>

      <a
        href="#"
        @click.prevent="loadInitial"
      >
        RIPROVA
      </a>
    </section>

    <section
      v-else
      class="loading-screen"
    >
      <p>
        PREPARAZIONE MISSIONE...
      </p>
    </section>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(html),
:global(body),
:global(#__nuxt) {
  margin: 0;
  min-height: 100%;
}

:global(body) {
  background: #090909;
  color: #f4f4f0;
  font-family: Inter, "Helvetica Neue", Arial, sans-serif;
}

button,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.game-page {
  min-height: 100dvh;
  background:
    radial-gradient(
      circle at 50% 22%,
      rgba(255, 255, 255, 0.05),
      transparent 28%
    ),
    #090909;
}

.game-shell {
  width: min(100%, 620px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 27px 24px 22px;

  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 15px;
}

.brand {
  margin: 0;

  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.19em;
}

.team-name {
  margin: 6px 0 0;

  color: #666;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.17em;
}

.top-stats {
  display: flex;
  align-items: flex-end;
  gap: 18px;

  text-align: right;
}

.top-stat span {
  display: block;

  color: #666;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: 0.15em;
}

.top-stat strong {
  display: block;
  margin-top: 3px;

  font-size: 23px;
  font-weight: 950;
  line-height: 1;
}

.leaderboard-link {
  margin-top: 20px;
  padding: 12px 0;

  display: flex;
  align-items: center;
  justify-content: space-between;

  color: #777;

  font-size: 7px;
  font-weight: 950;
  letter-spacing: 0.15em;

  text-decoration: none;
}

.leaderboard-link:hover {
  color: #f4f4f0;
}

.separator {
  height: 1px;
  background: #292929;
}

.mission {
  flex: 1;
  padding: 42px 0 50px;
}

.mission-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;

  color: #666;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.17em;
}

.live {
  color: #f4f4f0;
  animation: pulse 0.8s ease-in-out infinite alternate;
}

.category {
  margin-top: 38px;

  display: flex;
  align-items: center;
  gap: 9px;

  color: #888;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.15em;
}

.mission h1 {
  max-width: 540px;
  margin: 14px 0 0;

  font-size: clamp(48px, 14vw, 76px);
  font-weight: 950;
  line-height: 0.88;
  letter-spacing: -0.06em;
  overflow-wrap: anywhere;
}

.mission-text {
  max-width: 500px;
  margin: 30px 0 0;

  color: #aaa;
  font-size: 17px;
  line-height: 1.55;
}

.mission-details {
  margin-top: 38px;

  display: grid;
  grid-template-columns: 1fr 1fr;

  border-top: 1px solid #292929;
  border-bottom: 1px solid #292929;
}

.detail {
  padding: 18px 0;
}

.points-detail {
  padding-left: 20px;
  border-left: 1px solid #292929;
}

.detail-label {
  display: block;
  margin-bottom: 6px;

  color: #555;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.17em;
}

.detail strong {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.action-area,
.proof-area,
.completed-area {
  margin-top: 45px;
}

.hint {
  margin: 0 0 17px;

  color: #666;
  font-size: 12px;
  line-height: 1.5;
}

.active-message {
  margin: 0 0 8px;

  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.13em;
}

.primary-button {
  width: 100%;
  min-height: 68px;
  padding: 0 21px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  border: 1px solid #f4f4f0;

  background: #f4f4f0;
  color: #090909;

  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.1em;
}

.primary-button.disabled {
  border-color: #333;
  background: #222;
  color: #555;
  cursor: not-allowed;
}

.vince-skip-button {
  width: 100%;
  min-height: 78px;
  margin-top: 14px;
  padding: 8px 15px 8px 8px;

  display: flex;
  align-items: center;
  gap: 13px;

  border: 1px solid #333;
  background: #111;
  color: #f4f4f0;

  text-align: left;
}

.vince-face {
  width: 58px;
  height: 58px;
  flex: 0 0 58px;

  object-fit: cover;
  border-radius: 50%;
  background: #000;
}

.vince-skip-copy {
  min-width: 0;
  flex: 1;

  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vince-small {
  color: #666;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.vince-skip-copy strong {
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.1em;
}

.vince-arrow {
  color: #666;
  font-size: 18px;
}

.vince-message {
  margin-top: 14px;
  padding: 13px;

  display: flex;
  align-items: center;
  gap: 13px;

  border: 1px solid #f4f4f0;
  background: #f4f4f0;
  color: #090909;
}

.vince-message-face {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;

  object-fit: cover;
  border-radius: 50%;
  background: #000;
}

.vince-message p {
  margin: 0;

  font-size: 13px;
  font-weight: 950;
  letter-spacing: 0.06em;
}

.vince-message span {
  display: block;
  margin-top: 4px;

  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.vince-pop-enter-active,
.vince-pop-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.vince-pop-enter-from,
.vince-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.proof-area {
  padding-top: 5px;
}

.proof-icon {
  margin-bottom: 17px;
  font-size: 35px;
}

.proof-eyebrow {
  margin: 0 0 9px !important;

  color: #f4f4f0 !important;
  font-size: 9px !important;
  font-weight: 950;
  letter-spacing: 0.16em;
}

.proof-heading h2 {
  margin: 0;

  font-size: clamp(36px, 10vw, 52px);
  font-weight: 950;
  line-height: 0.93;
  letter-spacing: -0.045em;
}

.proof-heading p {
  margin: 14px 0 0;

  color: #777;
  font-size: 13px;
  line-height: 1.5;
}

.file-picker {
  min-height: 100px;
  margin: 30px 0 18px;
  padding: 20px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;

  border: 1px dashed #555;

  color: #aaa;
  text-align: center;

  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.1em;

  cursor: pointer;
}

.file-picker input {
  display: none;
}

.file-plus {
  color: #f4f4f0;
  font-size: 27px;
  font-weight: 400;
}

.selected-file {
  color: #f4f4f0;
  overflow-wrap: anywhere;
}

.text-proof {
  position: relative;
  margin: 30px 0 18px;
}

.text-proof label {
  display: block;
  margin-bottom: 9px;

  color: #666;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.16em;
}

.text-proof textarea {
  width: 100%;
  min-height: 140px;
  padding: 16px;

  resize: vertical;

  border: 1px solid #333;
  border-radius: 0;
  outline: none;

  background: #111;
  color: #f4f4f0;

  font-size: 15px;
  line-height: 1.5;
}

.text-proof textarea:focus {
  border-color: #777;
}

.counter {
  display: block;
  margin-top: 7px;

  color: #555;
  font-size: 8px;
  text-align: right;
}

.skip-button {
  width: 100%;
  margin-top: 18px;
  padding: 12px;

  border: 0;
  background: transparent;
  color: #666;

  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.11em;
  text-decoration: underline;
}

.completed-area {
  padding: 35px 0 10px;
  text-align: center;
}

.check {
  width: 68px;
  height: 68px;
  margin: 0 auto 24px;

  display: flex;
  align-items: center;
  justify-content: center;

  border: 2px solid #f4f4f0;
  border-radius: 50%;

  font-size: 29px;
  font-weight: 900;
}

.completed-label {
  margin: 0;

  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.15em;
}

.points-earned {
  margin: 12px 0 0;

  font-size: clamp(50px, 14vw, 76px);
  font-weight: 950;
  line-height: 1;
  letter-spacing: -0.05em;
}

.new-position {
  margin: 20px 0 0;

  color: #777;

  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.13em;
}

.new-position strong {
  margin-left: 4px;
  color: #f4f4f0;
}

.memory-message {
  margin: 16px 0 35px;

  color: #777;
  font-size: 13px;
}

footer {
  display: flex;
  justify-content: center;
  gap: 9px;

  color: #444;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.error-screen,
.loading-screen {
  width: min(100%, 620px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 30px 24px;

  display: flex;
  flex-direction: column;
  justify-content: center;
}

.error-screen p,
.loading-screen p {
  color: #666;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.17em;
}

.error-screen h1 {
  margin: 10px 0 35px;

  font-size: 52px;
  line-height: 0.9;
  letter-spacing: -0.05em;
}

.error-screen a {
  color: #f4f4f0;
  font-size: 10px;
  font-weight: 900;
}

@keyframes pulse {
  from {
    opacity: 0.35;
  }

  to {
    opacity: 1;
  }
}

@media (min-width: 700px) {
  .game-shell {
    padding-left: 32px;
    padding-right: 32px;
  }

  .primary-button:not(.disabled):hover {
    background: transparent;
    color: #f4f4f0;
  }
}

.pause-banner {
  margin: 14px 0 0;
  padding: 12px 14px;

  border: 1px solid #ffb454;
  color: #ffb454;

  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-align: center;
}

.game-error {
  margin: 14px 0 0;
  padding: 12px 14px;

  border: 1px solid #ff7a7a;
  color: #ff7a7a;

  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
  text-align: center;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.game-intro {
  padding: 10px 0 6px;
}

.intro-eyebrow {
  margin: 0 0 18px;
  color: #666;
  font-size: 8px;
  font-weight: 950;
  letter-spacing: 0.18em;
}

.game-intro h1 {
  margin: 0;
  color: #f4f4f0;
  font-size: clamp(38px, 12vw, 58px);
  font-weight: 950;
  line-height: 0.9;
  letter-spacing: -0.055em;
}

.intro-copy {
  max-width: 360px;
  margin: 24px 0 25px;
  color: #999;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.65;
}

.intro-rule {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 0;
  border-top: 1px solid #292929;
}

.intro-rule:nth-of-type(2) {
  border-bottom: 1px solid #292929;
}

.intro-emoji {
  flex: 0 0 27px;
  font-size: 21px;
  line-height: 1;
}

.intro-rule strong {
  display: block;
  color: #f4f4f0;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.08em;
}

.intro-rule p {
  margin: 6px 0 0;
  color: #777;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.55;
}

.intro-score {
  margin: 22px 0;
  color: #f4f4f0;
  font-size: 10px;
  font-weight: 950;
  line-height: 1.55;
  letter-spacing: 0.1em;
}

.intro-button {
  margin-top: 4px;
}

.intro-luck {
  margin: 18px 0 0;
  color: #555;
  text-align: center;
  font-size: 8px;
  font-weight: 950;
  letter-spacing: 0.2em;
}

.stop-screen {
  width: min(100%, 620px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 36px 24px 28px;

  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 18px;
}

.stop-vince {
  width: 92px;
  height: 92px;

  object-fit: cover;
  border-radius: 50%;
  background: #000;
  border: 1px solid #333;
}

.stop-eyebrow {
  margin: 0;
  color: #ff7a7a;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.2em;
}

.stop-screen h1 {
  margin: 0;
  font-size: clamp(54px, 18vw, 92px);
  font-weight: 950;
  line-height: 0.88;
  letter-spacing: -0.06em;
}

.stop-copy {
  max-width: 380px;
  margin: 0;
  color: #999;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.65;
}

.stop-stats {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid #292929;
  border-bottom: 1px solid #292929;
}

.stop-stats div {
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stop-stats span {
  color: #666;
  font-size: 8px;
  font-weight: 950;
  letter-spacing: 0.16em;
}

.stop-stats strong {
  font-size: 26px;
  font-weight: 950;
}

.stop-screen .leaderboard-link {
  width: 100%;
}
</style>