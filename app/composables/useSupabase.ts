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
    // nessun login: l'identità della squadra arriva dal link /play/{teamId}
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return client
}
