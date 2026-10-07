// Chiave anon di default dei Supabase locali (segreto JWT noto, solo sviluppo).
// `supabase status` non la stampa se auth è escluso da `db:start`.
export const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// Legge l'output di `supabase status -o env`: JSON su una riga (versioni recenti)
// oppure righe CHIAVE="valore" (versioni precedenti).
export function parseStatusEnv(text) {
  const values = {}

  for (const line of text.split('\n')) {
    const trimmed = line.trim()

    if (trimmed.startsWith('{')) {
      try {
        for (const [key, value] of Object.entries(JSON.parse(trimmed))) {
          if (typeof value === 'string') values[key] = value
        }
      } catch {
        // riga non JSON: si ignora
      }

      continue
    }

    const match = trimmed.match(/^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/)

    if (match) {
      values[match[1]] = match[2] ?? match[3]
    }
  }

  return values
}

// Variabili da passare a Nuxt per puntare al Supabase locale.
export function nuxtEnvFromStatus(values) {
  const url = values.API_URL

  if (!url) {
    throw new Error("Non trovo API_URL nell'output di `supabase status`.")
  }

  return {
    NUXT_PUBLIC_SUPABASE_URL: url,
    NUXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY ?? values.PUBLISHABLE_KEY ?? LOCAL_ANON_KEY,
  }
}

// `supabase status` può uscire con codice 0 anche se i container non esistono:
// il DB è acceso solo se l'output contiene davvero l'URL dell'API.
export function isSupabaseRunning(statusOutput) {
  return Boolean(parseStatusEnv(statusOutput).API_URL)
}
