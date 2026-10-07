// Legge l'output di `supabase status -o env` (righe CHIAVE="valore").
export function parseStatusEnv(text) {
  const values = {}

  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/)

    if (match) {
      values[match[1]] = match[2] ?? match[3]
    }
  }

  return values
}

// Variabili da passare a Nuxt per puntare al Supabase locale.
export function nuxtEnvFromStatus(values) {
  const url = values.API_URL
  const key = values.ANON_KEY ?? values.PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error('Non trovo API_URL e ANON_KEY nell\'output di `supabase status`.')
  }

  return {
    NUXT_PUBLIC_SUPABASE_URL: url,
    NUXT_PUBLIC_SUPABASE_ANON_KEY: key,
  }
}
