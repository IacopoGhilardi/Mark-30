// Stesso limite del bucket `proofs` (vedi migration): 20 MB per file.
// Le foto vengono compresse prima del controllo, quindi pesa soprattutto per i video.
export const MAX_PROOF_BYTES = 20 * 1024 * 1024

// Il file esiste già con lo stesso nome (409 / "already exists").
const alreadyExists = (error: { message: string; statusCode?: string | number }) =>
  String(error.statusCode) === '409' || /already exists/i.test(error.message)

// Carica foto/video della prova nel bucket privato e restituisce il percorso.
// Le foto vengono ridimensionate e compresse nel browser prima dell'upload.
//
// Idempotente: il nome contiene l'hash del contenuto, quindi riprovare con lo
// stesso file (rete caduta, doppio invio, secondo telefono) ricade sullo stesso
// percorso invece di creare una copia. Un file già presente conta come caricato.
export async function uploadProof(
  teamId: number,
  missionId: number,
  file: File
) {
  const upload = await compressImage(file)

  if (upload.size > MAX_PROOF_BYTES) {
    throw new Error(
      'File troppo grande (max 20 MB). Registra un video più corto (circa 15 secondi) o a risoluzione più bassa.'
    )
  }

  const ext = upload.name.includes('.')
    ? upload.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    : 'bin'
  // senza crypto.subtle (pagina non sicura) si torna a un nome unico per tentativo
  const id = (await shortFileHash(upload)) ?? String(Date.now())
  const path = `team-${teamId}/mission-${missionId}-${id}.${ext}`

  const { error } = await useSupabase()
    .storage.from('proofs')
    .upload(path, upload, { contentType: upload.type, upsert: false })

  if (error && !alreadyExists(error)) {
    throw new Error(error.message)
  }

  return path
}
