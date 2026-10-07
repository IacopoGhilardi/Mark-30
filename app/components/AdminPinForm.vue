<script setup lang="ts">
defineProps<{ busy?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [pin: string] }>()

const pin = ref('')

function submit() {
  emit('submit', pin.value.trim())
}
</script>

<template>
  <form class="adm-grid" @submit.prevent="submit">
    <input
      v-model="pin"
      type="password"
      inputmode="numeric"
      autocomplete="off"
      placeholder="PIN"
      required
    />
    <button class="adm-btn primary" type="submit" :disabled="busy">ENTRA</button>
    <p v-if="error" class="adm-error" role="alert">{{ error }}</p>
  </form>
</template>
