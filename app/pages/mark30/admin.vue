<script setup lang="ts">
import type { GameStatus } from '../../types/admin'

useHead({ title: 'Admin' })

const session = useAdminSession('marco')
const status = ref<GameStatus | null>(null)
const error = ref('')
const busy = ref(false)

// Il PIN si valida con la prima chiamata vera: nessun login a parte.
async function enter(pin: string) {
  error.value = ''
  busy.value = true

  try {
    status.value = await withLoader(() => adminGetStatus(pin), 'ACCESSO...')
    session.save(pin)
  } catch (e) {
    session.clear()
    status.value = null
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

async function change(next: GameStatus) {
  error.value = ''
  busy.value = true

  try {
    status.value = await withLoader(() => adminSetGame(session.pin.value, next))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

function logout() {
  session.clear()
  status.value = null
}

onMounted(async () => {
  session.restore()

  if (session.pin.value) {
    await enter(session.pin.value)
  }
})
</script>

<template>
  <AdminShell title="MARCO · ADMIN">
    <AdminPinForm v-if="!status" :busy="busy" :error="error" @submit="enter" />

    <template v-else>
      <section class="adm-section">
        <h2>GIOCO</h2>
        <GameSwitches :status="status" :busy="busy" @change="change" />
        <p v-if="error" class="adm-error" role="alert">{{ error }}</p>
      </section>

      <section class="adm-section">
        <h2>FOTO E VIDEO</h2>
        <ProofExport :pin="session.pin.value" />
      </section>

      <button class="adm-btn" type="button" @click="logout">ESCI</button>
    </template>
  </AdminShell>
</template>
