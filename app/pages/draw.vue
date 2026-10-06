<script setup lang="ts">
import { participants, teams } from '../datas/teams'

type DrawPhase = 'intro' | 'drawing' | 'reveal'

const phase = ref<DrawPhase>('intro')
const shuffledNames = ref<string[]>([...participants])
const progress = ref(0)
const revealedTeams = ref(0)

let shuffleInterval: ReturnType<typeof setInterval> | undefined
let progressInterval: ReturnType<typeof setInterval> | undefined
let revealInterval: ReturnType<typeof setInterval> | undefined
let finishTimeout: ReturnType<typeof setTimeout> | undefined

function shuffle<T>(array: T[]): T[] {
  const result = [...array]

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

    const current = result[i]
    const random = result[j]

    if (current !== undefined && random !== undefined) {
      result[i] = random
      result[j] = current
    }
  }

  return result
}

function startDraw() {
  phase.value = 'drawing'
  progress.value = 0

  shuffleInterval = setInterval(() => {
    shuffledNames.value = shuffle(participants)
  }, 90)

  progressInterval = setInterval(() => {
    if (progress.value < 94) {
      progress.value = Math.min(
        94,
        progress.value + Math.random() * 5
      )
    }
  }, 120)

  finishTimeout = setTimeout(() => {
    if (shuffleInterval) {
      clearInterval(shuffleInterval)
    }

    if (progressInterval) {
      clearInterval(progressInterval)
    }

    progress.value = 100

    setTimeout(() => {
      phase.value = 'reveal'
      startReveal()
    }, 450)
  }, 4500)
}

function startReveal() {
  revealedTeams.value = 0

  revealInterval = setInterval(() => {
    revealedTeams.value += 1

    if (revealedTeams.value >= teams.length && revealInterval) {
      clearInterval(revealInterval)
    }
  }, 280)
}

onUnmounted(() => {
  if (shuffleInterval) {
    clearInterval(shuffleInterval)
  }

  if (progressInterval) {
    clearInterval(progressInterval)
  }

  if (revealInterval) {
    clearInterval(revealInterval)
  }

  if (finishTimeout) {
    clearTimeout(finishTimeout)
  }
})

useHead({
  title: "Sorteggio — Marco's 30th",
})
</script>

<template>
  <main class="draw-page">
    <!-- INTRO -->
    <section
      v-if="phase === 'intro'"
      class="screen intro-screen"
    >
      <header class="brand">
        <p>MARCO'S 30TH</p>
        <span>THE BIRTHDAY GAMES</span>
      </header>

      <div class="intro-content">
        <p class="eyebrow">
          FORMAZIONE SQUADRE
        </p>

        <h1>
          È IL<br>
          MOMENTO.
        </h1>

        <div class="intro-rule"></div>

        <p class="intro-copy">
          <strong>45 PERSONE.</strong><br>
          <strong>9 SQUADRE.</strong><br>
          Vediamo cosa decide il destino.
        </p>

        <button
          class="primary-button"
          type="button"
          @click="startDraw"
        >
          <span>GENERA LE SQUADRE</span>
          <span>→</span>
        </button>
      </div>

      <p class="bottom-label">
        IL DESTINO NON SI DISCUTE.
      </p>
    </section>

    <!-- SORTEGGIO -->
    <section
      v-else-if="phase === 'drawing'"
      class="screen drawing-screen"
    >
      <header class="brand">
        <p>MARCO'S 30TH</p>
        <span>TEAM GENERATOR</span>
      </header>

      <div class="drawing-content">
        <p class="eyebrow pulse">
          ● GENERAZIONE IN CORSO
        </p>

        <h2>
          IL DESTINO<br>
          STA DECIDENDO.
        </h2>

        <div class="names-window">
          <div
            v-for="(name, index) in shuffledNames.slice(0, 9)"
            :key="`${name}-${index}`"
            class="shuffling-name"
            :class="{ active: index === 4 }"
          >
            {{ name }}
          </div>
        </div>

        <div class="progress-wrapper">
          <div class="progress-meta">
            <span>MESCOLANDO I NOMI</span>
            <span>{{ Math.floor(progress) }}%</span>
          </div>

          <div class="progress-track">
            <div
              class="progress-bar"
              :style="{ width: `${progress}%` }"
            ></div>
          </div>
        </div>
      </div>
    </section>

    <!-- RISULTATO -->
    <section
      v-else
      class="screen reveal-screen"
    >
      <header class="brand">
        <p>MARCO'S 30TH</p>
        <span>THE BIRTHDAY GAMES</span>
      </header>

      <div class="reveal-heading">
        <p class="eyebrow">
          SORTEGGIO COMPLETATO
        </p>

        <h2>
          IL DESTINO<br>
          HA PARLATO.
        </h2>

        <p class="reveal-subtitle">
          LE SQUADRE SONO PRONTE.
        </p>
      </div>

      <div class="teams">
        <TransitionGroup name="team-reveal">
          <article
            v-for="(team, index) in teams.slice(0, revealedTeams)"
            :key="team.id"
            class="team-card"
          >
            <div class="team-number">
              {{ String(index + 1).padStart(2, '0') }}
            </div>

            <div class="team-info">
              <h3>{{ team.name }}</h3>

              <div class="members">
                <span
                  v-for="member in team.members"
                  :key="member"
                >
                  {{ member }}
                </span>
              </div>
            </div>
          </article>
        </TransitionGroup>
      </div>

      <div
        v-if="revealedTeams >= teams.length"
        class="final-message"
      >
        <p class="final-title">
          TROVATE LA VOSTRA SQUADRA.
        </p>

        <p>
          Scegliete un telefono.<br>
          Da questo momento giocate insieme.
        </p>
      </div>
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

button {
  font: inherit;
}

.draw-page {
  min-height: 100dvh;
  background:
    radial-gradient(
      circle at 50% 30%,
      rgba(255, 255, 255, 0.055),
      transparent 32%
    ),
    #090909;
  color: #f4f4f0;
}

.screen {
  width: min(100%, 620px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 30px 24px;
}

.intro-screen,
.drawing-screen {
  display: flex;
  flex-direction: column;
}

.brand {
  text-align: center;
}

.brand p {
  margin: 0;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.22em;
}

.brand span {
  display: block;
  margin-top: 6px;
  color: #666;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.28em;
}

.intro-content,
.drawing-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.eyebrow {
  margin: 0 0 18px;
  color: #777;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.2em;
}

.intro-content h1,
.drawing-content h2,
.reveal-heading h2 {
  margin: 0;
  font-size: clamp(48px, 15vw, 78px);
  font-weight: 950;
  line-height: 0.88;
  letter-spacing: -0.06em;
}

.intro-rule {
  width: 42px;
  height: 3px;
  margin: 30px 0;
  background: #f4f4f0;
}

.intro-copy {
  margin: 0 0 40px;
  color: #888;
  font-size: 16px;
  line-height: 1.55;
}

.intro-copy strong {
  color: #f4f4f0;
}

.primary-button {
  width: 100%;
  min-height: 68px;
  padding: 0 22px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  border: 1px solid #f4f4f0;
  background: #f4f4f0;
  color: #090909;

  cursor: pointer;

  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.13em;
}

.bottom-label {
  margin: 0;
  color: #444;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-align: center;
}

.pulse {
  color: #f4f4f0;
  animation: pulse 0.8s ease-in-out infinite alternate;
}

.names-window {
  height: 290px;
  margin: 38px 0;
  overflow: hidden;

  border-top: 1px solid #282828;
  border-bottom: 1px solid #282828;
}

.shuffling-name {
  height: 32px;

  display: flex;
  align-items: center;
  justify-content: center;

  color: #454545;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.shuffling-name.active {
  color: #f4f4f0;
  font-size: 23px;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;

  color: #777;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.progress-track {
  height: 2px;
  overflow: hidden;
  background: #252525;
}

.progress-bar {
  height: 100%;
  background: #f4f4f0;
  transition: width 120ms linear;
}

.reveal-screen {
  padding-bottom: 60px;
}

.reveal-heading {
  padding: 70px 0 40px;
}

.reveal-heading h2 {
  font-size: clamp(44px, 13vw, 70px);
}

.reveal-subtitle {
  margin: 20px 0 0;
  color: #777;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.teams {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.team-card {
  display: flex;
  min-height: 122px;

  border: 1px solid #292929;
  background: rgba(255, 255, 255, 0.025);
}

.team-number {
  width: 66px;
  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-right: 1px solid #292929;

  color: #4b4b4b;
  font-size: 22px;
  font-weight: 900;
}

.team-info {
  padding: 19px 18px;
}

.team-info h3 {
  margin: 0 0 13px;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.16em;
}

.members {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 13px;
}

.members span {
  color: #aaa;
  font-size: 13px;
}

.final-message {
  margin-top: 45px;
  padding-top: 28px;
  border-top: 1px solid #333;

  color: #888;
  font-size: 14px;
  line-height: 1.55;
}

.final-title {
  margin: 0 0 12px;
  color: #f4f4f0;
  font-size: 15px;
  font-weight: 950;
  letter-spacing: 0.06em;
}

.team-reveal-enter-active {
  transition:
    opacity 450ms ease,
    transform 450ms ease;
}

.team-reveal-enter-from {
  opacity: 0;
  transform: translateY(22px);
}

@keyframes pulse {
  from {
    opacity: 0.4;
  }

  to {
    opacity: 1;
  }
}

@media (min-width: 700px) {
  .screen {
    padding-left: 32px;
    padding-right: 32px;
  }

  .primary-button:hover {
    background: transparent;
    color: #f4f4f0;
  }
}
</style>