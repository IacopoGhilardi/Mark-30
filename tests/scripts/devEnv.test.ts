import { describe, expect, it } from 'vitest'
import { nuxtEnvFromStatus, parseStatusEnv } from '../../scripts/dev-env.mjs'

describe('parseStatusEnv', () => {
  it('legge le righe CHIAVE="valore"', () => {
    const values = parseStatusEnv('API_URL="http://127.0.0.1:54321"\nANON_KEY="abc.def"\nDB_URL="postgresql://x"\n')

    expect(values.API_URL).toBe('http://127.0.0.1:54321')
    expect(values.ANON_KEY).toBe('abc.def')
  })

  it('accetta anche valori senza virgolette e ignora il resto', () => {
    const values = parseStatusEnv('Stopped services: [x]\nPORT=54321\n\nnon è una chiave\n')

    expect(values).toEqual({ PORT: '54321' })
  })
})

describe('nuxtEnvFromStatus', () => {
  it('produce le variabili che Nuxt si aspetta', () => {
    expect(nuxtEnvFromStatus({ API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'k' })).toEqual({
      NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NUXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
    })
  })

  it('usa la chiave pubblicabile se manca ANON_KEY', () => {
    expect(nuxtEnvFromStatus({ API_URL: 'http://x', PUBLISHABLE_KEY: 'sb_pub' }).NUXT_PUBLIC_SUPABASE_ANON_KEY).toBe('sb_pub')
  })

  it('segnala chiavi mancanti con un errore chiaro', () => {
    expect(() => nuxtEnvFromStatus({})).toThrow('API_URL')
    expect(() => nuxtEnvFromStatus({ API_URL: 'http://x' })).toThrow('ANON_KEY')
  })
})
