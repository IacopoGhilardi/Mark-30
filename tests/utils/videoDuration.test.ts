import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_VIDEO_SECONDS, getVideoDuration } from '../../app/utils/videoDuration'

type FakeVideo = {
  preload: string
  src: string
  duration: number
  onloadedmetadata: (() => void) | null
  onerror: (() => void) | null
}

let video: FakeVideo
const revoke = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  video = { preload: '', src: '', duration: 0, onloadedmetadata: null, onerror: null }
  revoke.mockReset()
  vi.stubGlobal('document', { createElement: () => video })
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: revoke })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('getVideoDuration', () => {
  it('legge la durata dai metadati e libera l\'URL', async () => {
    const promise = getVideoDuration(new File(['x'], 'v.mp4'))
    video.duration = 9.6
    video.onloadedmetadata?.()

    await expect(promise).resolves.toBe(9.6)
    expect(video.preload).toBe('metadata')
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })

  it('restituisce null se il file non si legge', async () => {
    const promise = getVideoDuration(new File(['x'], 'v.mp4'))
    video.onerror?.()

    await expect(promise).resolves.toBeNull()
  })

  it('restituisce null se la durata non è un numero finito', async () => {
    const promise = getVideoDuration(new File(['x'], 'v.mp4'))
    video.duration = Infinity
    video.onloadedmetadata?.()

    await expect(promise).resolves.toBeNull()
  })

  it('non resta in attesa all\'infinito', async () => {
    const promise = getVideoDuration(new File(['x'], 'v.mp4'))
    await vi.advanceTimersByTimeAsync(4000)

    await expect(promise).resolves.toBeNull()
  })

  it('la soglia ha un po\' di tolleranza oltre i 10 secondi', () => {
    expect(MAX_VIDEO_SECONDS).toBeGreaterThan(10)
  })
})
