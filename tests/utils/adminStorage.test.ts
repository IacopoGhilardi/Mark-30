import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}))

const { adminStorageClient } = await import('../../app/utils/adminStorage')

beforeEach(() => {
  createClient.mockReset().mockImplementation(() => ({ storage: {} }))
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { supabaseUrl: 'http://x', supabaseAnonKey: 'anon' },
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('adminStorageClient', () => {
  it('manda il PIN nell\'header x-admin-pin e non salva la sessione', () => {
    adminStorageClient('pin-header')

    expect(createClient).toHaveBeenCalledWith(
      'http://x',
      'anon',
      expect.objectContaining({
        global: { headers: { 'x-admin-pin': 'pin-header' } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    )
  })

  it('riusa lo stesso client per lo stesso PIN', () => {
    expect(adminStorageClient('pin-cache')).toBe(adminStorageClient('pin-cache'))
    expect(createClient).toHaveBeenCalledTimes(1)
  })

  it('usa client diversi per PIN diversi', () => {
    adminStorageClient('pin-a')
    adminStorageClient('pin-b')

    expect(createClient).toHaveBeenCalledTimes(2)
  })
})
