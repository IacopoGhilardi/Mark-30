import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_PROOF_BYTES, uploadProof } from '../../app/api/uploadProof'
import { shortFileHash } from '../../app/utils/fileHash'

const upload = vi.fn()
const from = vi.fn()
const compressImage = vi.fn()

const hash8 = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 8)
const photo = (content: string, name = 'Foto.JPG') => new File([content], name, { type: 'image/jpeg' })

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null })
  from.mockReset().mockReturnValue({ upload })
  compressImage.mockReset().mockImplementation(async (file: File) => file)
  vi.stubGlobal('compressImage', compressImage)
  vi.stubGlobal('shortFileHash', shortFileHash)
  vi.stubGlobal('useSupabase', () => ({ storage: { from } }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadProof', () => {
  it('carica nel bucket proofs con percorso team/missione/hash del contenuto', async () => {
    const file = photo('abc')

    const path = await uploadProof(7, 12, file)

    expect(path).toBe(`team-7/mission-12-${hash8('abc')}.jpg`)
    expect(from).toHaveBeenCalledWith('proofs')
    expect(upload).toHaveBeenCalledWith(path, file, { contentType: 'image/jpeg', upsert: false })
  })

  it('è idempotente: lo stesso file dà sempre lo stesso percorso', async () => {
    const first = await uploadProof(7, 12, photo('stessi byte'))
    const second = await uploadProof(7, 12, photo('stessi byte'))

    expect(second).toBe(first)
  })

  it('un file diverso dà un percorso diverso (non sostituisce quello precedente)', async () => {
    const first = await uploadProof(7, 12, photo('foto uno'))
    const second = await uploadProof(7, 12, photo('foto due'))

    expect(second).not.toBe(first)
  })

  it('non sovrascrive mai (upsert false)', async () => {
    await uploadProof(7, 12, photo('x'))
    expect(upload.mock.calls[0]![2]).toMatchObject({ upsert: false })
  })

  it('un file già presente (409) conta come caricato', async () => {
    upload.mockResolvedValue({ error: { message: 'The resource already exists', statusCode: '409' } })

    await expect(uploadProof(7, 12, photo('abc'))).resolves.toBe(`team-7/mission-12-${hash8('abc')}.jpg`)
  })

  it('riconosce il duplicato anche dal solo messaggio', async () => {
    upload.mockResolvedValue({ error: { message: 'Asset Already Exists' } })

    await expect(uploadProof(7, 12, photo('abc'))).resolves.toMatch(/^team-7\//)
  })

  it('gli altri errori dello storage vengono lanciati', async () => {
    upload.mockResolvedValue({ error: { message: 'file troppo grande', statusCode: '413' } })

    await expect(uploadProof(1, 2, photo('abc'))).rejects.toThrow('file troppo grande')
  })

  it('il percorso rispetta la regola della policy (team-<id>/)', async () => {
    const path = await uploadProof(3, 1, new File(['x'], 'v.mp4'))
    expect(path).toMatch(/^team-[0-9]+\//)
  })

  it('usa "bin" se il file non ha estensione', async () => {
    const path = await uploadProof(1, 2, new File(['x'], 'senzaestensione'))
    expect(path).toBe(`team-1/mission-2-${hash8('x')}.bin`)
  })

  it('carica la versione compressa della foto e ne usa l\'hash', async () => {
    const original = new File(['grande'], 'Foto.HEIC', { type: 'image/heic' })
    const compressed = new File(['piccola'], 'Foto.jpg', { type: 'image/jpeg' })
    compressImage.mockResolvedValue(compressed)

    const path = await uploadProof(7, 12, original)

    expect(compressImage).toHaveBeenCalledWith(original)
    expect(path).toBe(`team-7/mission-12-${hash8('piccola')}.jpg`)
    expect(upload).toHaveBeenCalledWith(path, compressed, { contentType: 'image/jpeg', upsert: false })
  })

  it('senza crypto.subtle torna a un nome unico per tentativo', async () => {
    vi.stubGlobal('shortFileHash', async () => null)
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

    await expect(uploadProof(1, 2, photo('abc'))).resolves.toBe('team-1/mission-2-1700000000000.jpg')
  })

  it('rifiuta un file oltre 20 MB senza caricarlo', async () => {
    const big = new File(['x'], 'video.mp4', { type: 'video/mp4' })
    Object.defineProperty(big, 'size', { value: MAX_PROOF_BYTES + 1 })

    await expect(uploadProof(1, 2, big)).rejects.toThrow('File troppo grande')
    expect(upload).not.toHaveBeenCalled()
  })

  it('controlla il peso dopo la compressione, non prima', async () => {
    const hugePhoto = photo('x', 'foto.jpg')
    Object.defineProperty(hugePhoto, 'size', { value: MAX_PROOF_BYTES * 2 })
    compressImage.mockResolvedValue(photo('piccola', 'foto.jpg'))

    await expect(uploadProof(1, 2, hugePhoto)).resolves.toMatch(/^team-1\//)
  })

  it('accetta un file esattamente al limite', async () => {
    const edge = new File(['x'], 'video.mp4', { type: 'video/mp4' })
    Object.defineProperty(edge, 'size', { value: MAX_PROOF_BYTES })

    await expect(uploadProof(1, 2, edge)).resolves.toMatch(/^team-1\//)
  })
})
