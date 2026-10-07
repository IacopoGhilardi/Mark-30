import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

// Unico punto di accesso a Supabase: client condiviso (singleton).
export function useSupabase(): SupabaseClient {
  if (client) {
    return client
  }

  const { supabaseUrl, supabaseAnonKey } = useRuntimeConfig().public

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase non configurato: imposta NUXT_PUBLIC_SUPABASE_URL e NUXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  client = createClient(supabaseUrl, supabaseAnonKey, {
    // i giocatori non fanno login (l'identità arriva dal link /play/{teamId});
    // la sessione serve solo all'admin della pagina /export
    auth: { persistSession: true, autoRefreshToken: true },
  })

  return client
}
