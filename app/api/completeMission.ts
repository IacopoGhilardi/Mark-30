import type { Proof, TeamState } from '../types/game'

// Carica l'eventuale file e chiude la missione. I punti li decide il server;
// un secondo invio restituisce lo stato senza riassegnarli.
export async function completeMission(
  teamId: number,
  missionId: number,
  proof: Proof = {}
) {
  const proofPath = proof.file
    ? await uploadProof(teamId, missionId, proof.file)
    : null

  return callRpc<TeamState>('complete_mission', {
    teamId,
    missionId,
    proofText: proof.text ?? null,
    proofPath,
  })
}
