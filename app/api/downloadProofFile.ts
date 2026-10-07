// Scarica un file di prova dal bucket privato (solo admin).
export async function downloadProofFile(path: string): Promise<Uint8Array> {
  const { data, error } = await useSupabase().storage.from('proofs').download(path)

  if (error || !data) {
    throw new Error(error?.message ?? `Download fallito: ${path}`)
  }

  return new Uint8Array(await data.arrayBuffer())
}
