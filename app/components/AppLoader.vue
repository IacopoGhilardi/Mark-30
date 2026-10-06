<script setup lang="ts">
defineProps<{
  show: boolean
  text?: string
}>()
</script>

<template>
  <Transition name="loader-fade">
    <div
      v-if="show"
      class="loader-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="loader-content">
        <div class="loader-ring"></div>

        <p v-if="text" class="loader-text">
          {{ text }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loader-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;

  display: flex;
  align-items: center;
  justify-content: center;

  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.loader-ring {
  width: 54px;
  height: 54px;

  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: #ffffff;
  border-radius: 50%;

  animation: spin 0.8s linear infinite;
}

.loader-text {
  margin: 0;

  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-align: center;
  text-transform: uppercase;
}

.loader-fade-enter-active,
.loader-fade-leave-active {
  transition: opacity 0.25s ease;
}

.loader-fade-enter-from,
.loader-fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>