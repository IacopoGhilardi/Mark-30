<script setup lang="ts">
import { teams } from '../../../datas/teams'

const route = useRoute()

const teamId = computed(() => {
  return Number(route.params.teamId)
})

const team = computed(() => {
  return teams.find((item) => item.id === teamId.value)
})

// Una squadra che ha già iniziato (missione attiva, completate o scartate) va
// diretta al gioco: la pagina d'ingresso serve solo la prima volta.
const checking = ref(true)

onMounted(async () => {
  if (!team.value) {
    checking.value = false
    return
  }

  try {
    const state = await withLoader(
      () => getTeamState(teamId.value),
      'CARICAMENTO...',
      { minMs: 0 }
    )

    if (hasStartedGame(state)) {
      await navigateTo(`/play/${teamId.value}/game`, { replace: true })
      return
    }
  } catch {
    // rete assente o backend non raggiungibile: si resta sulla pagina d'ingresso
  }

  checking.value = false
})

useHead({
  title: computed(() =>
    team.value
      ? `${team.value.name} — Marco's 30th`
      : "Marco's 30th"
  ),
})
</script>

<template>
  <main class="game-phone-page">
    <section v-if="team && !checking" class="game-phone">
      <header class="brand">
        <p class="brand-title">MARCO'S 30TH</p>
        <p class="brand-subtitle">THE BIRTHDAY GAMES</p>
      </header>

      <div class="team-section">
        <p class="team-label">
          SQUADRA {{ String(team.id).padStart(2, '0') }}
        </p>

        <h1>{{ team.name }}</h1>

        <div class="members">
          <span
            v-for="member in team.members"
            :key="member"
          >
            {{ member }}
          </span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="phone-section">
        <div class="phone-icon">
          📱
        </div>

        <p class="eyebrow">
          DA QUESTO MOMENTO
        </p>

        <h2>
          QUESTO È IL VOSTRO<br>
          GAME PHONE.
        </h2>

        <p class="description">
          Da questo telefono riceverete le vostre missioni
          e invierete le prove.
        </p>

        <p class="keep-it">
          Tenetelo con voi.
        </p>

        <NuxtLink
          :to="`/play/${team.id}/game`"
          class="ready-button"
        >
          <span>SIAMO PRONTI</span>
          <span class="arrow">→</span>
        </NuxtLink>
      </div>

      <footer>
        <span>TEAM {{ String(team.id).padStart(2, '0') }}</span>
        <span>●</span>
        <span>GAME PHONE</span>
      </footer>
    </section>

    <section v-else-if="!team" class="not-found">
      <p class="error-number">404</p>

      <h1>
        SQUADRA<br>
        NON TROVATA.
      </h1>

      <NuxtLink to="/" class="home-link">
        TORNA ALL'INIZIO
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

.game-phone-page {
  min-height: 100dvh;
  background:
    radial-gradient(
      circle at 50% 25%,
      rgba(255, 255, 255, 0.055),
      transparent 30%
    ),
    #090909;
}

.game-phone {
  width: min(100%, 620px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 30px 24px 24px;

  display: flex;
  flex-direction: column;
}

.brand {
  text-align: center;
}

.brand-title {
  margin: 0;

  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.22em;
}

.brand-subtitle {
  margin: 6px 0 0;

  color: #666;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.28em;
}

.team-section {
  padding: 70px 0 40px;
}

.team-label {
  margin: 0 0 13px;

  color: #777;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.2em;
}

.team-section h1 {
  margin: 0 0 25px;

  font-size: clamp(48px, 15vw, 78px);
  font-weight: 950;
  line-height: 0.9;
  letter-spacing: -0.055em;
}

.members {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.members span {
  padding: 9px 12px;

  border: 1px solid #303030;

  color: #aaa;
  font-size: 12px;
  font-weight: 700;
}

.divider {
  width: 100%;
  height: 1px;
  background: #292929;
}

.phone-section {
  flex: 1;
  padding: 50px 0;

  display: flex;
  flex-direction: column;
  justify-content: center;
}

.phone-icon {
  margin-bottom: 25px;
  font-size: 38px;
}

.eyebrow {
  margin: 0 0 14px;

  color: #666;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.phone-section h2 {
  margin: 0;

  font-size: clamp(35px, 10vw, 54px);
  font-weight: 950;
  line-height: 0.93;
  letter-spacing: -0.045em;
}

.description {
  max-width: 420px;
  margin: 28px 0 0;

  color: #8a8a8a;
  font-size: 15px;
  line-height: 1.55;
}

.keep-it {
  margin: 8px 0 35px;

  color: #f4f4f0;
  font-size: 15px;
  font-weight: 800;
}

.ready-button {
  width: 100%;
  min-height: 68px;
  padding: 0 22px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  border: 1px solid #f4f4f0;

  background: #f4f4f0;
  color: #090909;

  text-decoration: none;

  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.13em;
}

.arrow {
  font-size: 22px;
}

footer {
  display: flex;
  justify-content: center;
  gap: 10px;

  color: #444;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.not-found {
  width: min(100%, 620px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 40px 24px;

  display: flex;
  flex-direction: column;
  justify-content: center;
}

.error-number {
  margin: 0 0 15px;

  color: #555;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.2em;
}

.not-found h1 {
  margin: 0 0 40px;

  font-size: clamp(50px, 15vw, 80px);
  font-weight: 950;
  line-height: 0.88;
  letter-spacing: -0.055em;
}

.home-link {
  color: #f4f4f0;

  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

@media (min-width: 700px) {
  .game-phone {
    padding-left: 32px;
    padding-right: 32px;
  }

  .ready-button:hover {
    background: transparent;
    color: #f4f4f0;
  }
}
</style>