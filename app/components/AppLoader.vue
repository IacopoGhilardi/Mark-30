<script setup lang="ts">
withDefaults(
  defineProps<{
    show: boolean
    text?: string
  }>(),
  {
    text: 'CARICAMENTO...',
  }
)
</script>

<template>
  <Transition name="loader-fade">
    <div v-if="show" class="loader-overlay">
      <div class="loader-content">

        <img
          src="/images/vince-loader.png"
          alt=""
          class="vince-loader"
        >

        <p class="loader-text">
          {{ text }}
        </p>

        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>

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

  background: rgba(5, 5, 5, 0.95);
  backdrop-filter: blur(10px);
}

.loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;

  padding: 24px;
  text-align: center;
}

.vince-loader {
  width: min(70vw, 280px);
  height: auto;

  object-fit: contain;

  filter: drop-shadow(
    0 18px 30px rgba(0, 0, 0, 0.6)
  );

  animation: vince-pulse 0.9s ease-in-out infinite alternate;
}

.loader-text {
  margin: 25px 0 0;

  color: #f4f4f0;

  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.16em;

  text-transform: uppercase;
}

.loading-dots {
  margin-top: 18px;

  display: flex;
  gap: 7px;
}

.loading-dots span {
  width: 5px;
  height: 5px;

  border-radius: 50%;
  background: #f4f4f0;

  animation: dot-pulse 0.9s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.loader-fade-enter-active,
.loader-fade-leave-active {
  transition: opacity 0.2s ease;
}

.loader-fade-enter-from,
.loader-fade-leave-to {
  opacity: 0;
}

@keyframes vince-pulse {
  from {
    transform: scale(0.96);
  }

  to {
    transform: scale(1.04);
  }
}

@keyframes dot-pulse {
  0%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }

  50% {
    opacity: 1;
    transform: translateY(-4px);
  }
}
</style>