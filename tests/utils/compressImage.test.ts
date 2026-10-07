import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compressImage } from '../../app/utils/compressImage'

const drawImage = vi.fn()
let blobSize = 100
let created: { width: number; height: number }[] = []

class FakeOffscreenCanvas {
  constructor(public width: number, public height: number) {
    created.push({ width, height })
  }
  getContext() {
    return { drawImage }
  }
  async convertToBlob(options: { type: string; quality: number }) {
    return new Blob([new Uint8Array(blobSize)], { type: options.type })
  }
}

const bitmap = (width: number, height: number) => ({
  width,
  height,
  close: vi.fn(),
})

function image(name: string, type: string, size: number) {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  created = []
  blobSize = 100
  drawImage.mockReset()
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap(4000, 3000)))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('compressImage', () => {
  it('non tocca i file che non sono immagini', async () => {
    const video = image('v.mp4', 'video/mp4', 5000)
    await expect(compressImage(video)).resolves.toBe(video)
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('ridimensiona mantenendo le proporzioni (lato max 1600)', async () => {
    await compressImage(image('a.jpg', 'image/jpeg', 5000))
    expect(created).toEqual([{ width: 1600, height: 1200 }])
  })

  it('non ingrandisce le foto piccole', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap(800, 600)))
    await compressImage(image('a.jpg', 'image/jpeg', 5000))
    expect(created).toEqual([{ width: 800, height: 600 }])
  })

  it('gestisce le foto verticali', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap(3000, 4000)))
    await compressImage(image('a.jpg', 'image/jpeg', 5000))
    expect(created).toEqual([{ width: 1200, height: 1600 }])
  })

  it('restituisce un JPEG con estensione .jpg', async () => {
    const result = await compressImage(image('Foto.HEIC', 'image/heic', 5000))
    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('Foto.jpg')
  })

  it('applica l\'orientamento EXIF', async () => {
    await compressImage(image('a.jpg', 'image/jpeg', 5000))
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), {
      imageOrientation: 'from-image',
    })
  })

  it('usa le opzioni passate', async () => {
    await compressImage(image('a.jpg', 'image/jpeg', 5000), { maxSide: 800 })
    expect(created).toEqual([{ width: 800, height: 600 }])
  })

  it('tiene l\'originale se la versione compressa non è più leggera', async () => {
    blobSize = 6000
    const original = image('a.jpg', 'image/jpeg', 5000)
    await expect(compressImage(original)).resolves.toBe(original)
  })

  it('tiene l\'originale se il browser non riesce a decodificarla', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no')))
    const original = image('a.heic', 'image/heic', 5000)
    await expect(compressImage(original)).resolves.toBe(original)
  })
})
