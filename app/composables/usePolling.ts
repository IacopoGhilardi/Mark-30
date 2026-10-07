// Esegue `task` subito e poi ogni `intervalMs`, ma solo con la scheda visibile
// (un telefono in tasca non interroga il DB). Alla ricomparsa aggiorna subito.
// Va chiamato da setup: si ferma da solo quando la pagina viene chiusa.
export function usePolling(task: () => unknown, intervalMs: number) {
  let timer: ReturnType<typeof setInterval> | undefined
  let running = false

  const tick = async () => {
    if (running) return
    running = true

    try {
      await task()
    } finally {
      running = false
    }
  }

  const start = () => {
    stop()
    timer = setInterval(tick, intervalMs)
  }

  const stop = () => {
    clearInterval(timer)
    timer = undefined
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      tick()
      start()
    } else {
      stop()
    }
  }

  onMounted(() => {
    tick()
    start()
    document.addEventListener('visibilitychange', onVisibility)
  })

  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { refresh: tick }
}
