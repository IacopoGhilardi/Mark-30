<script setup lang="ts">
import { teams } from '../../../datas/teams'
import {
  activeMissions,
  type Mission,
} from '../../../datas/missions'

type GameStep = 'ready' | 'active' | 'proof' | 'completed'

type SavedGameState = {
  score: number
  missionNumber: number
  step: GameStep
  completedMissionIds: number[]
  currentMissionId: number | null
}

const route = useRoute()
const { showLoader, hideLoader } = useAppLoader()

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

const textProof = ref('')
const selectedFileName = ref('')
const selectedFile = ref<File | null>(null)

const isReady = ref(false)
const currentPosition = ref<number | null>(null)

const fakeSkipClicks = ref(0)
const showVinceMessage = ref(false)

const vinceMessages = [
  'BEL TENTATIVO.',
  'SEI SICURO?',
  'VINCE TI STA GIUDICANDO.',
  'LA MISSIONE NON SI SALTA.',
]

const vinceMessage = computed(() => {
  const index = Math.min(
    Math.max(fakeSkipClicks.value - 1, 0),
    vinceMessages.length - 1
  )

  return vinceMessages[index]
})

let vinceTimer: ReturnType<typeof setTimeout> | null = null
let rankingInterval: ReturnType<typeof setInterval> | null = null

const storageKey = computed(() => {
  return `marcos30-team-${teamId.value}`
})

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

function pickRandomMission(): Mission | null {
  const available = activeMissions.filter(
    (mission) => !completedMissionIds.value.includes(mission.id)
  )

  if (available.length === 0) {
    return null
  }

  const randomIndex = Math.floor(
    Math.random() * available.length
  )

  return available[randomIndex] ?? null
}

function saveGame() {
  if (!import.meta.client) return
  if (!team.value) return
  if (!isReady.value) return

  const state: SavedGameState = {
    score: score.value,
    missionNumber: missionNumber.value,
    step: step.value,
    completedMissionIds: [...completedMissionIds.value],
    currentMissionId: currentMission.value?.id ?? null,
  }

  localStorage.setItem(
    storageKey.value,
    JSON.stringify(state)
  )

  updatePosition()
}

function restoreGame(): boolean {
  if (!import.meta.client) return false

  const raw = localStorage.getItem(storageKey.value)

  if (!raw) {
    return false
  }

  try {
    const saved = JSON.parse(raw) as SavedGameState

    score.value = saved.score ?? 0
    missionNumber.value = saved.missionNumber ?? 1
    step.value = saved.step ?? 'ready'

    completedMissionIds.value = Array.isArray(
      saved.completedMissionIds
    )
      ? saved.completedMissionIds
      : []

    if (saved.currentMissionId) {
      currentMission.value =
        activeMissions.find(
          (mission) => mission.id === saved.currentMissionId
        ) ?? null
    }

    return Boolean(currentMission.value)
  } catch {
    localStorage.removeItem(storageKey.value)
    return false
  }
}

function createNewGame() {
  score.value = 0
  missionNumber.value = 1
  completedMissionIds.value = []
  currentMission.value = pickRandomMission()
  step.value = 'ready'
}

function getSavedTeamState(teamToRead: number): SavedGameState | null {
  if (!import.meta.client) return null

  const raw = localStorage.getItem(
    `marcos30-team-${teamToRead}`
  )

  if (!raw) return null

  try {
    return JSON.parse(raw) as SavedGameState
  } catch {
    return null
  }
}

function updatePosition() {
  if (!import.meta.client) return
  if (!team.value) return

  const ranking = teams.map((item) => {
    const savedState = getSavedTeamState(item.id)

    return {
      id: item.id,
      score: savedState?.score ?? 0,
      completed: savedState?.completedMissionIds?.length ?? 0,
    }
  })

  ranking.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    if (b.completed !== a.completed) {
      return b.completed - a.completed
    }

    return a.id - b.id
  })

  const index = ranking.findIndex(
    (item) => item.id === teamId.value
  )

  currentPosition.value = index >= 0 ? index + 1 : null
}

function resetProof() {
  textProof.value = ''
  selectedFileName.value = ''
  selectedFile.value = null
}

function enterGame() {
  showGameIntro.value = false
}

function startMission() {
  step.value = 'active'
  saveGame()
}

function fakeSkipMission() {
  fakeSkipClicks.value += 1
  showVinceMessage.value = true

  if (vinceTimer) {
    clearTimeout(vinceTimer)
  }

  vinceTimer = setTimeout(() => {
    showVinceMessage.value = false
  }, 2000)
}

function completeMission() {
  if (!currentMission.value) return

  if (currentMission.value.proofType === 'none') {
    finishMission()
    return
  }

  step.value = 'proof'
  saveGame()
}

function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

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

  finishMission()
}

function finishMission() {
  if (!currentMission.value) return

  if (
    !completedMissionIds.value.includes(
      currentMission.value.id
    )
  ) {
    completedMissionIds.value.push(
      currentMission.value.id
    )

    score.value += currentMission.value.points
  }

  step.value = 'completed'
  saveGame()
}

function nextMission() {
  showLoader('ESTRAZIONE NUOVA MISSIONE...')

  window.setTimeout(() => {
    const next = pickRandomMission()

    if (next) {
      currentMission.value = next
      missionNumber.value += 1

      resetProof()

      fakeSkipClicks.value = 0
      showVinceMessage.value = false

      step.value = 'ready'
      saveGame()
    }

    hideLoader()
  }, 1100)
}

onMounted(() => {
  const restored = restoreGame()

  if (!restored) {
    createNewGame()
  }

  isReady.value = true

  saveGame()
  updatePosition()

  rankingInterval = setInterval(() => {
    updatePosition()
  }, 1500)
})

onUnmounted(() => {
  hideLoader()

  if (rankingInterval) {
    clearInterval(rankingInterval)
  }

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
      v-if="team && currentMission && isReady"
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
        to="/classifica"
        class="leaderboard-link"
      >
        <span>
          VEDI CLASSIFICA LIVE
        </span>

        <span>↗</span>
      </NuxtLink>

      <div class="separator"></div>

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
        v-else
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

        <p class="mission-text">
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
            @click="completeMission"
          >
            <span>MISSIONE COMPLETATA</span>
            <span>✓</span>
          </button>

          <button
            class="vince-skip-button"
            type="button"
            @click="fakeSkipMission"
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
            :class="{ disabled: !proofIsValid }"
            :disabled="!proofIsValid"
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

          <button
            class="primary-button"
            type="button"
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

</style>