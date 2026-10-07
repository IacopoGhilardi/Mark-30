import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePolling } from '../../app/composables/usePolling'

let mounted: (() => void) | undefined
let unmounted: (() => void) | undefined
let visibility: 'visible' | 'hidden' = 'visible'
const listeners = new Map<string, () => void>()

beforeEach(() => {
  vi.useFakeTimers()
  mounted = undefined
  unmounted = undefined
  visibility = 'visible'
  listeners.clear()

  vi.stubGlobal('onMounted', (fn: () => void) => (mounted = fn))
  vi.stubGlobal('onBeforeUnmount', (fn: () => void) => (unmounted = fn))
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility
    },
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('usePolling', () => {
  it('esegue subito e poi a intervalli', async () => {
    const task = vi.fn()
    usePolling(task, 1000)
    mounted?.()

    await vi.advanceTimersByTimeAsync(0)
    expect(task).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(3000)
    expect(task).toHaveBeenCalledTimes(4)
  })

  it('si ferma quando la scheda è nascosta e riparte subito alla ricomparsa', async () => {
    const task = vi.fn()
    usePolling(task, 1000)
    mounted?.()
    await vi.advanceTimersByTimeAsync(0)

    visibility = 'hidden'
    listeners.get('visibilitychange')?.()
    await vi.advanceTimersByTimeAsync(5000)
    expect(task).toHaveBeenCalledTimes(1)

    visibility = 'visible'
    listeners.get('visibilitychange')?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(task).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(3)
  })

  it('non sovrappone due esecuzioni se la precedente non è finita', async () => {
    let finish: () => void = () => undefined
    const task = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    usePolling(task, 1000)
    mounted?.()

    await vi.advanceTimersByTimeAsync(3500)
    expect(task).toHaveBeenCalledTimes(1)

    finish()
    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('si ferma e rimuove il listener quando la pagina viene chiusa', async () => {
    const task = vi.fn()
    usePolling(task, 1000)
    mounted?.()
    await vi.advanceTimersByTimeAsync(0)

    unmounted?.()
    await vi.advanceTimersByTimeAsync(5000)

    expect(task).toHaveBeenCalledTimes(1)
    expect(listeners.has('visibilitychange')).toBe(false)
  })
})
