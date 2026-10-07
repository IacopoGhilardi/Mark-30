<script setup lang="ts">
import { teams } from '../datas/teams'

type TeamQr = { id: number; name: string; url: string; svg: string }

const origin = ref('')
const items = ref<TeamQr[]>([])
const error = ref('')
const focused = ref<TeamQr | null>(null)
const copiedId = ref<number | null>(null)

const isLocal = computed(() => isLocalOrigin(origin.value))

async function generate() {
  try {
    items.value = await Promise.all(
      teams.map(async (team) => {
        const url = teamUrl(origin.value, team.id)

        return { id: team.id, name: team.name, url, svg: await makeQrSvg(url) }
      })
    )
    error.value = ''
  } catch (e) {
    items.value = []
    error.value = errorMessage(e)
  }
}

function useCurrentAddress() {
  origin.value = window.location.origin
}

function download(item: TeamQr) {
  saveFile(`qr-team-${item.id}.svg`, item.svg, 'image/svg+xml')
}

async function copy(item: TeamQr) {
  try {
    await navigator.clipboard.writeText(item.url)
    copiedId.value = item.id
    setTimeout(() => (copiedId.value = null), 1500)
  } catch {
    error.value = 'Non riesco a copiare: tieni premuto sul link e copialo a mano.'
  }
}

// Stampa solo i QR: la classe sul body nasconde il resto della pagina (vedi stile).
function printAll() {
  const cleanup = () => document.body.classList.remove('printing-qr')

  document.body.classList.add('printing-qr')
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
}

watch(origin, generate)

onMounted(useCurrentAddress)
</script>

<template>
  <div class="adm-grid qr-print-root">
    <div class="adm-grid qr-controls">
      <input v-model="origin" type="url" inputmode="url" autocapitalize="off" placeholder="https://il-tuo-sito.netlify.app" />

      <button class="adm-btn" type="button" @click="useCurrentAddress">USA L'INDIRIZZO DI QUESTA PAGINA</button>

      <p v-if="isLocal" class="adm-error" role="alert">
        Attenzione: questo indirizzo è locale. I telefoni fuori dalla tua rete non riusciranno ad aprirlo.
        Genera i QR dalla pagina sul dominio vero (es. quello di Netlify).
      </p>

      <p v-if="error" class="adm-error" role="alert">{{ error }}</p>

      <button class="adm-btn primary" type="button" :disabled="!items.length" @click="printAll">
        STAMPA TUTTI I QR
      </button>
    </div>

    <div class="qr-grid">
      <article v-for="item in items" :key="item.id" class="adm-card qr-card">
        <p class="qr-label">SQUADRA {{ String(item.id).padStart(2, '0') }}</p>
        <h3 class="qr-name">{{ item.name }}</h3>
        <div class="qr-image" v-html="item.svg" />
        <p class="adm-muted qr-url">{{ item.url }}</p>

        <div class="adm-row qr-actions">
          <button class="adm-btn" type="button" @click="focused = item">SCHERMO INTERO</button>
          <button class="adm-btn" type="button" @click="download(item)">SCARICA</button>
          <button class="adm-btn" type="button" @click="copy(item)">
            {{ copiedId === item.id ? 'COPIATO ✓' : 'COPIA LINK' }}
          </button>
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div v-if="focused" class="qr-overlay" role="dialog" aria-modal="true" @click="focused = null">
        <p class="qr-overlay-label">SQUADRA {{ String(focused.id).padStart(2, '0') }}</p>
        <h2>{{ focused.name }}</h2>
        <div class="qr-overlay-image" v-html="focused.svg" />
        <p class="qr-overlay-hint">Inquadrate con la fotocamera · tocca per chiudere</p>
      </div>
    </Teleport>
  </div>
</template>

<style>
.qr-grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
@media (min-width: 640px) { .qr-grid { grid-template-columns: 1fr 1fr; } }
.qr-card { text-align: center; }
.qr-label { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.18em; opacity: 0.6; }
.qr-name { margin: 0; font-size: 20px; }
.qr-image svg { width: min(100%, 240px); height: auto; background: #fff; border-radius: 8px; }
.qr-url { word-break: break-all; font-size: 12px; }

/* schermo intero: QR grande su fondo bianco, per farlo inquadrare da un altro telefono */
.qr-overlay {
  position: fixed; inset: 0; z-index: 1000; padding: 24px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  background: #fff; color: #111; text-align: center;
}
.qr-overlay h2 { margin: 0; font-size: 28px; letter-spacing: 0.04em; }
.qr-overlay-label { margin: 0; font-size: 13px; font-weight: 800; letter-spacing: 0.2em; color: #666; }
.qr-overlay-image svg { width: min(86vw, 70dvh); height: auto; }
.qr-overlay-hint { margin: 0; font-size: 13px; color: #666; }

/* stampa: solo i QR, in nero su bianco */
@media print {
  body.printing-qr { background: #fff !important; }
  body.printing-qr * { visibility: hidden; }
  body.printing-qr .qr-print-root,
  body.printing-qr .qr-print-root * { visibility: visible; }
  body.printing-qr .qr-print-root { position: absolute; left: 0; top: 0; width: 100%; color: #111; }
  body.printing-qr .qr-controls,
  body.printing-qr .qr-actions,
  body.printing-qr .qr-overlay { display: none !important; }
  body.printing-qr .qr-grid { grid-template-columns: 1fr 1fr; gap: 8mm; }
  body.printing-qr .qr-card { break-inside: avoid; border: 1.5px solid #111; color: #111; }
  body.printing-qr .qr-label, body.printing-qr .qr-url { color: #555; opacity: 1; }
}
</style>
