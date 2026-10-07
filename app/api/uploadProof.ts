// Carica foto/video della prova nel bucket privato e restituisce il percorso.
export async function uploadProof(
  teamId: number,
  missionId: number,
  file: File
) {
  const ext = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    : 'bin'
  const path = `team-${teamId}/mission-${missionId}-${Date.now()}.${ext}`

  const { error } = await useSupabase()
    .storage.from('proofs')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) {
    throw new Error(error.message)
  }

  return path
}
