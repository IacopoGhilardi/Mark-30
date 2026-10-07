import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadProofFile } from '../../app/api/downloadProofFile'

const download = vi.fn()
const adminStorageClient = vi.fn()

beforeEach(() => {
  download.mockReset().mockResolvedValue({
    data: new Blob([new Uint8Array([1, 2, 3])]),
    error: null,
  })
  adminStorageClient.mockReset().mockReturnValue({
    storage: { from: () => ({ download }) },
  })
  vi.stubGlobal('adminStorageClient', adminStorageClient)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('downloadProofFile', () => {
  it('scarica con il client del PIN indicato', async () => {
    await downloadProofFile('1111', 'team-1/a.jpg')

    expect(adminStorageClient).toHaveBeenCalledWith('1111')
    expect(download).toHaveBeenCalledWith('team-1/a.jpg')
  })

  it('restituisce i byte del file', async () => {
    await expect(downloadProofFile('1111', 'team-1/a.jpg')).resolves.toEqual(new Uint8Array([1, 2, 3]))
  })

  it('lancia un errore se lo Storage risponde con errore', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'Object not found' } })

    await expect(downloadProofFile('1111', 'team-1/x.jpg')).rejects.toThrow('Object not found')
  })

  it('lancia un errore se non arriva nessun dato', async () => {
    download.mockResolvedValue({ data: null, error: null })

    await expect(downloadProofFile('1111', 'team-1/x.jpg')).rejects.toThrow('Download fallito')
  })
})
