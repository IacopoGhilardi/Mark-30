import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOADER_MIN_MS, withLoader } from '../../app/utils/withLoader'

const showLoader = vi.fn()
const hideLoader = vi.fn()
const states = new Map<string, { value: unknown }>()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  showLoader.mockReset()
  hideLoader.mockReset()
  states.clear()

  vi.stubGlobal('useAppLoader', () => ({ showLoader, hideLoader }))
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!states.has(key)) states.set(key, { value: init() })
    return states.get(key)!
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('withLoader', () => {
  it('mostra il loader con il testo e restituisce il risultato subito', async () => {
    const result = await withLoader(async () => 'ok', 'INVIO...')

    expect(result).toBe('ok')
    expect(showLoader).toHaveBeenCalledWith('INVIO...')
  })

  it('una chiamata veloce non fa sparire subito il loader', async () => {
    await withLoader(async () => 'ok')

    expect(hideLoader).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(LOADER_MIN_MS - 1)
    expect(hideLoader).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(hideLoader).toHaveBeenCalledTimes(1)
  })

  it('una chiamata lenta chiude il loader appena finisce', async () => {
    const promise = withLoader(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return 'lenta'
    })

    await vi.advanceTimersByTimeAsync(2000)
    await promise

    expect(hideLoader).toHaveBeenCalledTimes(1)
  })

  it('conta solo il tempo che manca al minimo', async () => {
    const promise = withLoader(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
    })

    await vi.advanceTimersByTimeAsync(500)
    await promise
    expect(hideLoader).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(LOADER_MIN_MS - 500)
    expect(hideLoader).toHaveBeenCalledTimes(1)
  })

  it('il minimo è di 2 secondi', () => {
    expect(LOADER_MIN_MS).toBe(2000)
  })

  it('se la chiamata fallisce il loader si chiude subito, senza attendere il minimo', async () => {
    await expect(
      withLoader(async () => {
        throw new Error('rete assente')
      })
    ).rejects.toThrow('rete assente')

    expect(hideLoader).toHaveBeenCalledTimes(1)
  })

  it('con minMs 0 non aspetta', async () => {
    await withLoader(async () => 'ok', 'X', { minMs: 0 })
    expect(hideLoader).toHaveBeenCalledTimes(1)
  })

  it('con più chiamate in parallelo chiude solo quando finiscono tutte', async () => {
    const slow = withLoader(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
    })
    const fast = withLoader(async () => 'veloce', 'X', { minMs: 0 })

    await fast
    expect(hideLoader).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)
    await slow
    expect(hideLoader).toHaveBeenCalledTimes(1)
  })

  it('se parte un\'altra chiamata durante l\'attesa il loader resta', async () => {
    await withLoader(async () => 'prima') // nasconderebbe il loader a t = 2000
    await vi.advanceTimersByTimeAsync(300)

    const second = withLoader(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000))
    })

    // a t = 2300 è scaduta l'attesa della prima chiamata, ma la seconda è ancora in corso
    await vi.advanceTimersByTimeAsync(LOADER_MIN_MS)
    expect(hideLoader).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)
    await second
    expect(hideLoader).toHaveBeenCalledTimes(1)
  })
})
