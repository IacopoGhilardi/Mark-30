<script setup lang="ts">
import { teams } from '../datas/teams'

type LeaderboardTeam = {
  id: number
  name: string
  score: number
  completed: number
  position: number
}

const leaderboard = ref<LeaderboardTeam[]>([])
const lastUpdated = ref('')
const totalCompleted = ref(0)
const hasError = ref(false)

async function refreshLeaderboard() {
  try {
    // loader solo al primo caricamento, poi aggiornamenti silenziosi
    const rows = leaderboard.value.length
      ? await getLeaderboard()
      : await withLoader(() => getLeaderboard(), 'CARICO LA CLASSIFICA...')

    leaderboard.value = rows.map((row) => ({
      id: row.teamId,
      name: row.name,
      score: row.score,
      completed: row.completedMissions,
      position: row.position,
    }))

    totalCompleted.value = rows.reduce(
      (total, row) => total + row.completedMissions,
      0
    )

    lastUpdated.value = new Date().toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    hasError.value = false
  } catch {
    // si tiene l'ultima classifica nota e si riprova al prossimo giro
    hasError.value = true
  }
}

// Primo caricamento con il loader, poi aggiornamenti silenziosi ogni 5 secondi
usePolling(refreshLeaderboard, 5000)

function positionLabel(position: number) {
  return String(position).padStart(2, '0')
}

// Se si arriva dal gioco (?team=N) compaiono "torna alla missione" e l'evidenza della propria squadra
const route = useRoute()

const myTeamId = computed(() => {
  const id = Number(route.query.team)

  return teams.some((team) => team.id === id) ? id : null
})

useHead({
  title: "Live Leaderboard — Marco's 30th",
})
</script>

<template>
  <main class="leaderboard-page">
    <section class="leaderboard-shell">
      <header class="header">
        <div>
          <p class="brand">MARCO'S 30TH</p>
          <p class="edition">THE BIRTHDAY GAMES</p>
        </div>

        <div class="live-badge">
          <span class="live-dot"></span>
          <span>GAME LIVE</span>
        </div>
      </header>

      <section class="hero">
        <p class="eyebrow">
          LIVE LEADERBOARD
        </p>

        <h1>
          CHI È<br>
          IN TESTA?
        </h1>

        <p class="subtitle">
          Tutto può ancora succedere.
        </p>
      </section>

      <section class="ranking">
        <article
          v-for="item in leaderboard"
          :key="item.id"
          class="team-row"
          :class="{
            leader: item.position === 1,
            podium: item.position <= 3,
            mine: item.id === myTeamId,
          }"
        >
          <div class="position">
            {{ positionLabel(item.position) }}
          </div>

          <div class="team-info">
            <div class="team-line">
              <h2>{{ item.name }}</h2>

              <span
                v-if="item.id === myTeamId"
                class="you-badge"
              >
                VOI
              </span>

              <span
                v-if="item.position === 1"
                class="crown"
              >
                👑
              </span>
            </div>

            <p>
              {{ item.completed }}
              {{
                item.completed === 1
                  ? 'MISSIONE COMPLETATA'
                  : 'MISSIONI COMPLETATE'
              }}
            </p>
          </div>

          <div class="team-score">
            <strong>{{ item.score }}</strong>
            <span>PT</span>
          </div>
        </article>
      </section>

      <section class="game-stats">
        <div class="stat">
          <span class="stat-label">
            SQUADRE
          </span>

          <strong>
            {{ teams.length }}
          </strong>
        </div>

        <div class="stat">
          <span class="stat-label">
            MISSIONI COMPLETATE
          </span>

          <strong>
            {{ totalCompleted }}
          </strong>
        </div>

        <div class="stat">
          <span class="stat-label">
            AGGIORNATO
          </span>

          <strong class="time">
            {{ lastUpdated || '--:--:--' }}
          </strong>
        </div>
      </section>

      <footer>
        <div class="footer-live">
          <span class="live-dot small"></span>
          {{ hasError ? 'CONNESSIONE INSTABILE · RIPROVO' : 'CLASSIFICA IN AGGIORNAMENTO' }}
        </div>

        <p>
          30 ANNI. 9 SQUADRE. UNA SOLA SERATA.
        </p>
      </footer>

      <NuxtLink
        v-if="myTeamId"
        :to="`/play/${myTeamId}/game`"
        class="back-to-mission"
      >
        <span>←</span>
        <span>TORNA ALLA MISSIONE</span>
      </NuxtLink>
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

.leaderboard-page {
  min-height: 100dvh;

  background:
    radial-gradient(
      circle at 50% 12%,
      rgba(255, 255, 255, 0.055),
      transparent 26%
    ),
    #090909;
}

.leaderboard-shell {
  width: min(100%, 900px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 28px 22px 24px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding-bottom: 22px;

  border-bottom: 1px solid #292929;
}

.brand {
  margin: 0;

  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.19em;
}

.edition {
  margin: 6px 0 0;

  color: #555;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.17em;
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 8px;

  font-size: 8px;
  font-weight: 950;
  letter-spacing: 0.14em;
}

.live-dot {
  width: 7px;
  height: 7px;

  display: inline-block;

  border-radius: 50%;
  background: #f4f4f0;

  animation: livePulse 0.8s ease-in-out infinite alternate;
}

.live-dot.small {
  width: 5px;
  height: 5px;
}

.hero {
  padding: 50px 0 44px;
}

.eyebrow {
  margin: 0 0 16px;

  color: #666;

  font-size: 8px;
  font-weight: 950;
  letter-spacing: 0.2em;
}

.hero h1 {
  margin: 0;

  font-size: clamp(56px, 15vw, 105px);
  font-weight: 950;
  line-height: 0.8;
  letter-spacing: -0.07em;
}

.subtitle {
  margin: 25px 0 0;

  color: #777;
  font-size: 13px;
}

.ranking {
  border-top: 1px solid #292929;
}

.team-row {
  min-height: 94px;
  padding: 17px 4px;

  display: grid;
  grid-template-columns: 50px 1fr auto;
  align-items: center;
  gap: 12px;

  border-bottom: 1px solid #292929;

  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}

.team-row.podium {
  min-height: 102px;
}

.team-row.leader {
  border-top: 1px solid #f4f4f0;
  border-bottom: 1px solid #f4f4f0;
}

.position {
  color: #555;

  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.08em;
}

.leader .position {
  color: #f4f4f0;
}

.team-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.team-info h2 {
  margin: 0;

  font-size: clamp(20px, 6vw, 32px);
  font-weight: 950;
  line-height: 1;
  letter-spacing: -0.04em;
}

.team-info p {
  margin: 7px 0 0;

  color: #555;

  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.11em;
}

.crown {
  font-size: 17px;
}

.team-score {
  display: flex;
  align-items: baseline;
  gap: 5px;

  text-align: right;
}

.team-score strong {
  font-size: clamp(30px, 8vw, 45px);
  font-weight: 950;
  line-height: 1;
  letter-spacing: -0.055em;
}

.team-score span {
  color: #666;

  font-size: 8px;
  font-weight: 950;
  letter-spacing: 0.08em;
}

.game-stats {
  margin-top: 45px;

  display: grid;
  grid-template-columns: repeat(3, 1fr);

  border-top: 1px solid #292929;
  border-bottom: 1px solid #292929;
}

.stat {
  min-width: 0;
  padding: 20px 10px;

  text-align: center;
}

.stat + .stat {
  border-left: 1px solid #292929;
}

.stat-label {
  min-height: 20px;

  display: block;

  color: #555;

  font-size: 6px;
  font-weight: 950;
  line-height: 1.4;
  letter-spacing: 0.12em;
}

.stat strong {
  display: block;
  margin-top: 8px;

  font-size: 24px;
  font-weight: 950;
}

.stat strong.time {
  font-size: 13px;
  letter-spacing: 0.04em;
}

footer {
  padding-top: 30px;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  color: #444;
  text-align: center;

  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.footer-live {
  display: flex;
  align-items: center;
  gap: 7px;

  color: #777;
}

@keyframes livePulse {
  from {
    opacity: 0.25;
    transform: scale(0.85);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.team-row.mine {
  background: rgba(255, 255, 255, 0.07);
  outline: 1px solid rgba(255, 255, 255, 0.35);
}

.you-badge {
  padding: 3px 7px;

  border: 1px solid #f4f4f0;
  border-radius: 999px;

  font-size: 8px;
  font-weight: 950;
  letter-spacing: 0.14em;
}

/* in fondo allo schermo, a portata di pollice */
.back-to-mission {
  position: sticky;
  bottom: 14px;
  z-index: 5;

  margin-top: 18px;
  min-height: 56px;
  padding: 0 20px;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;

  background: #f4f4f0;
  color: #090909;
  text-decoration: none;

  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.12em;
}

@media (min-width: 700px) {
  .leaderboard-shell {
    padding: 36px 38px 30px;
  }

  .team-row {
    grid-template-columns: 65px 1fr auto;
    padding-left: 10px;
    padding-right: 10px;
  }

  .hero {
    padding-top: 65px;
    padding-bottom: 55px;
  }
}
</style>