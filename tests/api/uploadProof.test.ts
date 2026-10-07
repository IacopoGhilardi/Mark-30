import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_PROOF_BYTES, uploadProof } from '../../app/api/uploadProof'

const upload = vi.fn()
const from = vi.fn()
const compressImage = vi.fn()

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null })
  from.mockReset().mockReturnValue({ upload })
  compressImage.mockReset().mockImplementation(async (file: File) => file)
  vi.stubGlobal('compressImage', compressImage)
  vi.stubGlobal('useSupabase', () => ({ storage: { from } }))
  vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadProof', () => {
  it('carica nel bucket proofs con percorso team/missione/timestamp', async () => {
    const file = new File(['x'], 'Foto.JPG', { type: 'image/jpeg' })

    const path = await uploadProof(7, 12, file)

    expect(path).toBe('team-7/mission-12-1700000000000.jpg')
    expect(from).toHaveBeenCalledWith('proofs')
    expect(upload).toHaveBeenCalledWith(path, file, {
      contentType: 'image/jpeg',
      upsert: false,
    })
  })

  it('il percorso rispetta la regola della policy (team-<id>/)', async () => {
    const path = await uploadProof(3, 1, new File(['x'], 'v.mp4'))
    expect(path).toMatch(/^team-[0-9]+\//)
  })

  it('usa "bin" se il file non ha estensione', async () => {
    const path = await uploadProof(1, 2, new File(['x'], 'senzaestensione'))
    expect(path).toBe('team-1/mission-2-1700000000000.bin')
  })

  it('lancia un errore se lo storage risponde con errore', async () => {
    upload.mockResolvedValue({ error: { message: 'file troppo grande' } })

    await expect(
      uploadProof(1, 2, new File(['x'], 'a.png'))
    ).rejects.toThrow('file troppo grande')
  })

  it('carica la versione compressa della foto', async () => {
    const original = new File(['grande'], 'Foto.HEIC', { type: 'image/heic' })
    const compressed = new File(['piccola'], 'Foto.jpg', { type: 'image/jpeg' })
    compressImage.mockResolvedValue(compressed)

    const path = await uploadProof(7, 12, original)

    expect(compressImage).toHaveBeenCalledWith(original)
    expect(path).toBe('team-7/mission-12-1700000000000.jpg')
    expect(upload).toHaveBeenCalledWith(path, compressed, {
      contentType: 'image/jpeg',
      upsert: false,
    })
  })

  it('rifiuta un file oltre 50 MB senza caricarlo', async () => {
    const big = new File(['x'], 'video.mp4', { type: 'video/mp4' })
    Object.defineProperty(big, 'size', { value: MAX_PROOF_BYTES + 1 })

    await expect(uploadProof(1, 2, big)).rejects.toThrow('File troppo grande')
    expect(upload).not.toHaveBeenCalled()
  })

  it('accetta un file esattamente al limite', async () => {
    const edge = new File(['x'], 'video.mp4', { type: 'video/mp4' })
    Object.defineProperty(edge, 'size', { value: MAX_PROOF_BYTES })

    await expect(uploadProof(1, 2, edge)).resolves.toMatch(/^team-1\//)
  })
})
