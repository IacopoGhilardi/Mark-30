import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const download = vi.fn()
const createClient = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}))

const { downloadProofFile } = await import('../../app/api/downloadProofFile')

beforeEach(() => {
  download.mockReset().mockResolvedValue({
    data: new Blob([new Uint8Array([1, 2, 3])]),
    error: null,
  })
  createClient.mockReset().mockReturnValue({
    storage: { from: () => ({ download }) },
  })
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { supabaseUrl: 'http://x', supabaseAnonKey: 'anon' },
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('downloadProofFile', () => {
  it('manda il PIN nell\'header x-admin-pin', async () => {
    await downloadProofFile('pin-header', 'team-1/a.jpg')

    expect(createClient).toHaveBeenCalledWith(
      'http://x',
      'anon',
      expect.objectContaining({
        global: { headers: { 'x-admin-pin': 'pin-header' } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    )
  })

  it('restituisce i byte del file', async () => {
    await expect(downloadProofFile('pin-bytes', 'team-1/a.jpg')).resolves.toEqual(
      new Uint8Array([1, 2, 3])
    )
    expect(download).toHaveBeenCalledWith('team-1/a.jpg')
  })

  it('riusa lo stesso client per lo stesso PIN', async () => {
    await downloadProofFile('pin-cache', 'team-1/a.jpg')
    await downloadProofFile('pin-cache', 'team-1/b.jpg')

    expect(createClient).toHaveBeenCalledTimes(1)
  })

  it('lancia un errore se lo Storage risponde con errore', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'Object not found' } })

    await expect(downloadProofFile('pin-err', 'team-1/x.jpg')).rejects.toThrow('Object not found')
  })

  it('lancia un errore se non arriva nessun dato', async () => {
    download.mockResolvedValue({ data: null, error: null })

    await expect(downloadProofFile('pin-empty', 'team-1/x.jpg')).rejects.toThrow('Download fallito')
  })
})
