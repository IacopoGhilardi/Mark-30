import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const clients = new Map<string, SupabaseClient>()

// Client dedicato al download: manda il PIN nell'header x-admin-pin,
// che la policy dello Storage verifica nel DB.
function storageClient(pin: string) {
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

// Scarica un file di prova dal bucket privato.
export async function downloadProofFile(pin: string, path: string): Promise<Uint8Array> {
  const { data, error } = await storageClient(pin).storage.from('proofs').download(path)

  if (error || !data) {
    throw new Error(error?.message ?? `Download fallito: ${path}`)
  }

  return new Uint8Array(await data.arrayBuffer())
}
