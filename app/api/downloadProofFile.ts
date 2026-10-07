// Scarica un file di prova dal bucket privato (PIN di Marco o di Irene).
export async function downloadProofFile(pin: string, path: string): Promise<Uint8Array> {
  const { data, error } = await adminStorageClient(pin).storage.from('proofs').download(path)

  if (error || !data) {
    throw new Error(error?.message ?? `Download fallito: ${path}`)
  }

  return new Uint8Array(await data.arrayBuffer())
}
