import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const clients = new Map<string, SupabaseClient>()

// Client per lo Storage delle prove: manda il PIN nell'header x-admin-pin,
// che le policy del bucket verificano nel DB (lettura: Marco o Irene, eliminazione: Irene).
export function adminStorageClient(pin: string) {
  let client = clients.get(pin)

  if (!client) {
    const { supabaseUrl, supabaseAnonKey } = useRuntimeConfig().public

    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-admin-pin': pin } },
    })
    clients.set(pin, client)
  }

  return client
}
