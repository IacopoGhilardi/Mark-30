// Elimina tutte le foto e i video dal bucket delle prove (solo Irene) e restituisce
// quanti file sono stati eliminati. Pensato per il reset prima della festa.
export async function adminClearProofs(pin: string): Promise<number> {
  const storage = adminStorageClient(pin).storage.from('proofs')

  const { data: folders, error } = await storage.list('', { limit: 1000 })

  if (error) {
    throw new Error(error.message)
  }

  let removed = 0

  for (const folder of folders ?? []) {
    // una voce senza id è una cartella (team-N); con id è un file nella radice
    const paths = folder.id
      ? [folder.name]
      : ((await storage.list(folder.name, { limit: 1000 })).data ?? []).map(
          (file) => `${folder.name}/${file.name}`
        )

    if (!paths.length) continue

    const { data: deleted, error: removeError } = await storage.remove(paths)

    if (removeError) {
      throw new Error(removeError.message)
    }

    // se la policy nega l'eliminazione lo Storage non dà errore: restituisce meno file
    if ((deleted ?? []).length < paths.length) {
      throw new Error('Alcuni file non sono stati eliminati: controlla il PIN di Irene.')
    }

    removed += paths.length
  }

  await callAdmin('admin_log_event', pin, { action: 'clear_proofs', details: { removed } })

  return removed
}
