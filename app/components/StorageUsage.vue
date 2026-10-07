<script setup lang="ts">
import type { StorageLevel, StorageStats } from '../types/admin'

const props = defineProps<{ pin: string }>()

const stats = ref<StorageStats | null>(null)
const error = ref('')

let timer: ReturnType<typeof setInterval> | undefined

const MESSAGES: Record<StorageLevel, string> = {
  ok: '',
  warning: 'Stiamo arrivando al limite di spazio: meglio evitare i video lunghi.',
  critical: 'Spazio quasi finito! Gli upload potrebbero fallire a breve.',
}

const bar = computed(() => Math.min(100, stats.value?.percent ?? 0))
const percentOf = (bytes: number, total: number) => (total ? Math.round((100 * bytes) / total) : 0)

async function load() {
  try {
    stats.value = await adminStorageStats(props.pin)
    error.value = ''
  } catch (e) {
    error.value = errorMessage(e)
  }
}

onMounted(() => {
  load()
  timer = setInterval(load, 60000)
})

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div v-if="stats" class="adm-grid">
    <p v-if="stats.level !== 'ok'" class="adm-card" :class="stats.level === 'critical' ? 'adm-off' : 'adm-warn'" role="alert">
      <strong>{{ MESSAGES[stats.level] }}</strong>
    </p>

    <div class="adm-card" :class="{ 'adm-warn': stats.level === 'warning' }">
      <div class="adm-row">
        <strong>{{ formatBytes(stats.usedBytes) }}</strong>
        <span class="adm-muted">di {{ formatBytes(stats.limitBytes) }} · {{ stats.percent }}%</span>
        <span class="adm-muted">{{ stats.fileCount }} file</span>
      </div>

      <div class="storage-bar" :class="`level-${stats.level}`">
        <div :style="{ width: `${bar}%` }" />
      </div>

      <p class="adm-muted">
        Foto: {{ stats.images.count }} ({{ formatBytes(stats.images.bytes) }}) ·
        Video: {{ stats.videos.count }} ({{ formatBytes(stats.videos.bytes) }})
      </p>

      <p v-if="stats.orphans.count" class="adm-muted">
        {{ stats.orphans.count }} file non collegati a missioni completate
        ({{ formatBytes(stats.orphans.bytes) }}): upload non conclusi o doppi.
      </p>

      <p class="adm-muted">
        Database: {{ formatBytes(stats.database.usedBytes) }} di {{ formatBytes(stats.database.limitBytes) }}
        ({{ percentOf(stats.database.usedBytes, stats.database.limitBytes) }}%)
      </p>
    </div>

    <ul v-if="stats.perTeam.length" class="adm-muted" style="list-style: none; padding: 0; margin: 0">
      <li v-for="team in stats.perTeam" :key="team.teamId">
        Squadra {{ team.teamId }}: {{ team.count }} file · {{ formatBytes(team.bytes) }}
      </li>
    </ul>
  </div>

  <p v-else-if="error" class="adm-error" role="alert">{{ error }}</p>
</template>

<style scoped>
.storage-bar {
  height: 10px;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
}
.storage-bar div {
  height: 100%;
  background: #7dffa1;
  transition: width 0.4s;
}
.level-warning div { background: #ffb454; }
.level-critical div { background: #ff7a7a; }
</style>
