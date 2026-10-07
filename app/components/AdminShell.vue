<script setup lang="ts">
defineProps<{ title: string }>()

useHead({ meta: [{ name: 'robots', content: 'noindex' }] })
</script>

<template>
  <main class="adm">
    <h1 class="adm-title">{{ title }}</h1>
    <slot />
  </main>
</template>

<style>
.adm {
  min-height: 100dvh;
  padding: 20px 16px 72px;
  background: #0a0a0a;
  color: #f5f5f2;
  font-family: Inter, 'Helvetica Neue', Arial, sans-serif;
  -webkit-text-size-adjust: 100%;
  touch-action: manipulation;
}
.adm * { box-sizing: border-box; }
.adm-title { margin: 0 0 16px; font-size: 20px; letter-spacing: 0.08em; }
.adm-section { margin: 0 0 28px; }
.adm-section h2 { margin: 0 0 10px; font-size: 13px; letter-spacing: 0.12em; opacity: 0.6; }
.adm-card { padding: 14px; border: 1px solid rgba(255,255,255,0.14); border-radius: 12px; display: grid; gap: 12px; }
.adm-card.adm-warn { border-color: #ffb454; }
.adm-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.adm-row > .adm-btn { flex: 1 1 120px; }
.adm-row > select, .adm-row > input { flex: 2 1 160px; min-width: 0; }
.adm-grid { display: grid; gap: 12px; }
.adm-muted { color: rgba(245,245,242,0.6); font-size: 14px; margin: 0; }
.adm-error { color: #ff7a7a; margin: 12px 0; font-size: 15px; line-height: 1.4; }

/* 16px+: sotto, Safari su iPhone ingrandisce la pagina quando si tocca un campo */
.adm-btn, .adm input, .adm select {
  min-height: 48px; padding: 12px 14px; border: 1px solid rgba(255,255,255,0.3); border-radius: 10px;
  background: transparent; color: inherit; font-size: 16px; font-family: inherit;
}
.adm select { max-width: 100%; }
.adm select option { color: #000; }
.adm-btn { font-weight: 700; letter-spacing: 0.04em; width: 100%; }
.adm-btn.primary { background: #f5f5f2; color: #0a0a0a; }
.adm-btn.danger { border-color: #ff7a7a; color: #ff7a7a; }
.adm-btn.on { background: #f5f5f2; color: #0a0a0a; }
.adm-btn:disabled { opacity: 0.45; }
.adm-btn:active:not(:disabled) { transform: scale(0.98); }
.adm-on { color: #7dffa1; }
.adm-off { color: #ff7a7a; }

/* barra fissa in alto: stato del gioco sempre visibile e a portata di pollice */
.adm-bar {
  position: sticky; top: 0; z-index: 10; margin: 0 -16px 20px; padding: 10px 16px;
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: rgba(10,10,10,0.96); border-bottom: 1px solid rgba(255,255,255,0.14);
  backdrop-filter: blur(8px);
}
.adm-bar .adm-btn { width: auto; min-height: 40px; padding: 8px 12px; font-size: 14px; }
.adm-bar strong { font-size: 14px; letter-spacing: 0.06em; }

/* schede richiudibili (un tocco sul titolo) */
.adm-details { padding: 0; gap: 0; }
.adm-details > summary {
  list-style: none; cursor: pointer; padding: 14px; min-height: 56px;
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
}
.adm-details > summary::-webkit-details-marker { display: none; }
.adm-details > summary::after { content: '▾'; opacity: 0.6; margin-left: auto; }
.adm-details[open] > summary::after { content: '▴'; }
.adm-details > .adm-body { padding: 0 14px 14px; display: grid; gap: 12px; }
.adm-badge { font-size: 12px; font-weight: 800; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 999px; border: 1px solid currentColor; }
</style>
