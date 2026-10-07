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
  padding: 24px 16px 56px;
  background: #0a0a0a;
  color: #f5f5f2;
  font-family: Inter, 'Helvetica Neue', Arial, sans-serif;
}
.adm-title { margin: 0 0 20px; font-size: 20px; letter-spacing: 0.08em; }
.adm-section { margin: 0 0 28px; }
.adm-section h2 { margin: 0 0 10px; font-size: 13px; letter-spacing: 0.12em; opacity: 0.6; }
.adm-card { padding: 14px; border: 1px solid rgba(255,255,255,0.14); border-radius: 12px; display: grid; gap: 10px; }
.adm-card.adm-warn { border-color: #ffb454; }
.adm-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.adm-grid { display: grid; gap: 12px; }
.adm-muted { color: rgba(245,245,242,0.6); font-size: 13px; }
.adm-error { color: #ff7a7a; margin: 12px 0; }
.adm-btn, .adm input, .adm select {
  padding: 12px 14px; border: 1px solid rgba(255,255,255,0.3); border-radius: 10px;
  background: transparent; color: inherit; font-size: 15px;
}
.adm select option { color: #000; }
.adm-btn { font-weight: 700; letter-spacing: 0.05em; }
.adm-btn.primary { background: #f5f5f2; color: #0a0a0a; }
.adm-btn.danger { border-color: #ff7a7a; color: #ff7a7a; }
.adm-btn:disabled { opacity: 0.45; }
.adm-on { color: #7dffa1; }
.adm-off { color: #ff7a7a; }
</style>
