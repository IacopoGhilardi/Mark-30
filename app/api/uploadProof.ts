// Stesso limite del bucket `proofs` (vedi migration).
export const MAX_PROOF_BYTES = 50 * 1024 * 1024

// Carica foto/video della prova nel bucket privato e restituisce il percorso.
// Le foto vengono ridimensionate e compresse nel browser prima dell'upload.
export async function uploadProof(
  teamId: number,
  missionId: number,
  file: File
) {
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error(
      'File troppo grande (max 50 MB). Registra un video più corto o a risoluzione più bassa.'
    )
  }

  const upload = await compressImage(file)

  const ext = upload.name.includes('.')
    ? upload.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    : 'bin'
  const path = `team-${teamId}/mission-${missionId}-${Date.now()}.${ext}`

  const { error } = await useSupabase()
    .storage.from('proofs')
    .upload(path, upload, { contentType: upload.type, upsert: false })

  if (error) {
    throw new Error(error.message)
  }

  return path
}
