<script setup lang="ts">
useHead({
  title: "Marco's 30th — The Birthday Games",
  meta: [
    {
      name: 'description',
      content: "Marco's 30th Birthday Games",
    },
  ],
})
</script>

<template>
  <main class="home">
    <section class="hero">
      <header class="brand">
        <p class="brand-title">MARCO'S 30TH</p>
        <p class="brand-subtitle">THE BIRTHDAY GAMES</p>
      </header>

      <div class="content">
        <h1 class="headline">
          <span>30 ANNI.</span>
          <span>1 SERA.</span>
          <span class="outline">TUTTO PUÒ</span>
          <span class="outline">SUCCEDERE.</span>
        </h1>

        <div class="warning">
          <span></span>
          <p>NON FARTI SCOPRIRE. 👀</p>
          <span></span>
        </div>

        <div class="instructions">
          <p>Trova la tua squadra.</p>
          <p>Completa le tue missioni.</p>
          <p class="strong">Crea ricordi per Marco.</p>
        </div>

        <<a href="/draw" class="start-button">
  <span>INIZIA IL GIOCO</span>
  <span class="arrow">→</span>
</a>
      </div>

      <footer class="footer">
        30TH BIRTHDAY&nbsp;&nbsp; ● &nbsp;&nbsp;THE GAME STARTS HERE
      </footer>
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
  background: #0a0a0a;
  font-family: Inter, "Helvetica Neue", Arial, sans-serif;
}

.home {
  min-height: 100dvh;
  background:
    radial-gradient(
      circle at 50% 25%,
      rgba(255, 255, 255, 0.055),
      transparent 32%
    ),
    #0a0a0a;
  color: #f5f5f2;
}

.hero {
  min-height: 100dvh;
  width: min(100%, 620px);
  margin: 0 auto;
  padding: 32px 24px 24px;

  display: flex;
  flex-direction: column;
}

.brand {
  text-align: center;
}

.brand-title {
  margin: 0;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.24em;
}

.brand-subtitle {
  margin: 7px 0 0;
  color: #888;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.32em;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px 0 42px;
}

.headline {
  margin: 0;
  font-size: clamp(48px, 14vw, 82px);
  font-weight: 950;
  line-height: 0.88;
  letter-spacing: -0.065em;
  text-transform: uppercase;
}

.headline span {
  display: block;
}

.headline .outline {
  color: transparent;
  -webkit-text-stroke: 1.5px #f5f5f2;
}

.warning {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 42px 0 28px;
}

.warning span {
  width: 100%;
  height: 1px;
  background: #383838;
}

.warning p {
  flex-shrink: 0;
  margin: 0;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.15em;
}

.instructions {
  margin-bottom: 38px;
}

.instructions p {
  margin: 5px 0;
  color: #aaa;
  font-size: 15px;
  line-height: 1.45;
}

.instructions .strong {
  color: #f5f5f2;
  font-weight: 700;
}

.start-button {
  width: 100%;
  min-height: 68px;
  padding: 0 22px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  border: 1px solid #f5f5f2;
  background: #f5f5f2;
  color: #0a0a0a;

  text-decoration: none;

  font-size: 13px;
  font-weight: 950;
  letter-spacing: 0.12em;

  transition:
    background 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.start-button:active {
  transform: scale(0.985);
}

.arrow {
  font-size: 24px;
  font-weight: 400;
}

.footer {
  color: #555;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-align: center;
}

@media (min-width: 700px) {
  .hero {
    padding-left: 32px;
    padding-right: 32px;
  }

  .start-button:hover {
    background: transparent;
    color: #f5f5f2;
  }
}
</style>