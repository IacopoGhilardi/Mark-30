<script setup lang="ts">
const { isLoading, loaderText } = useAppLoader()
</script>

<template>
  <div>
    <NuxtPage />

    <AppLoader
      :show="isLoading"
      :text="loaderText"
    />
  </div>
</template>