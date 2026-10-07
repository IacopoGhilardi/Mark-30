import { describe, expect, it } from 'vitest'
import {
  LOCAL_ANON_KEY,
  isSupabaseRunning,
  nuxtEnvFromStatus,
  parseStatusEnv,
} from '../../scripts/dev-env.mjs'

// output reale di `supabase status -o env` con i servizi di auth esclusi
const JSON_STATUS =
  'Stopped services: [supabase_auth_Mark-30 supabase_studio_Mark-30]\n' +
  '{"linked_project":null,"DB_URL":"postgresql://postgres:postgres@127.0.0.1:54322/postgres","API_URL":"http://127.0.0.1:54321","S3_PROTOCOL_REGION":"local","message":""}\n'

describe('parseStatusEnv', () => {
  it('legge il JSON di status (versioni recenti della CLI)', () => {
    const values = parseStatusEnv(JSON_STATUS)

    expect(values.API_URL).toBe('http://127.0.0.1:54321')
    expect(values.S3_PROTOCOL_REGION).toBe('local')
  })

  it('legge le righe CHIAVE="valore" (versioni precedenti)', () => {
    const values = parseStatusEnv('API_URL="http://127.0.0.1:54321"\nANON_KEY="abc.def"\n')

    expect(values.API_URL).toBe('http://127.0.0.1:54321')
    expect(values.ANON_KEY).toBe('abc.def')
  })

  it('ignora righe e JSON non validi', () => {
    expect(parseStatusEnv('Stopped services: [x]\n{non json\n\nnon è una chiave\n')).toEqual({})
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

  it('con auth escluso (nessuna chiave in status) usa la chiave locale di default', () => {
    const env = nuxtEnvFromStatus(parseStatusEnv(JSON_STATUS))

    expect(env.NUXT_PUBLIC_SUPABASE_ANON_KEY).toBe(LOCAL_ANON_KEY)
  })

  it('la chiave di default è un JWT con ruolo anon', () => {
    const payload = JSON.parse(Buffer.from(LOCAL_ANON_KEY.split('.')[1]!, 'base64url').toString())

    expect(payload.role).toBe('anon')
  })

  it('segnala un URL mancante con un errore chiaro', () => {
    expect(() => nuxtEnvFromStatus({})).toThrow('API_URL')
  })
})

describe('isSupabaseRunning', () => {
  it('è acceso se status contiene l\'URL dell\'API (JSON o righe)', () => {
    expect(isSupabaseRunning(JSON_STATUS)).toBe(true)
    expect(isSupabaseRunning('API_URL="http://127.0.0.1:54321"\n')).toBe(true)
  })

  it('non è acceso se status stampa un errore (anche con codice di uscita 0)', () => {
    expect(
      isSupabaseRunning('{"_tag":"Error","error":{"code":"StatusDbInspectError","message":"no such container"}}')
    ).toBe(false)
    expect(isSupabaseRunning('')).toBe(false)
  })
})
