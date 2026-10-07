<script setup lang="ts">
import type { GameStatus } from '../types/admin'

const props = defineProps<{ status: GameStatus; busy?: boolean }>()
const emit = defineEmits<{ change: [status: GameStatus] }>()

function toggle(key: keyof GameStatus) {
  emit('change', { ...props.status, [key]: !props.status[key] })
}
</script>

<template>
  <div class="adm-grid">
    <div class="adm-card">
      <strong>Gioco</strong>
      <span :class="status.playEnabled ? 'adm-on' : 'adm-off'">
        {{ status.playEnabled ? 'ATTIVO' : 'FERMO: nessuno può giocare' }}
      </span>
      <button class="adm-btn" type="button" :disabled="busy" @click="toggle('playEnabled')">
        {{ status.playEnabled ? 'FERMA IL GIOCO' : 'RIAVVIA IL GIOCO' }}
      </button>
    </div>

    <div class="adm-card">
      <strong>Nuove missioni</strong>
      <span :class="status.missionsEnabled ? 'adm-on' : 'adm-off'">
        {{ status.missionsEnabled ? 'ATTIVE' : 'FERME: nessuna nuova missione' }}
      </span>
      <button class="adm-btn" type="button" :disabled="busy" @click="toggle('missionsEnabled')">
        {{ status.missionsEnabled ? 'FERMA LE NUOVE MISSIONI' : 'RIPRENDI LE MISSIONI' }}
      </button>
    </div>
  </div>
</template>
