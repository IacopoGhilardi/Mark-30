import type { TeamState } from '../types/game'

// Annulla una missione completata: via i punti, la missione torna disponibile.
export function adminCancelCompletion(pin: string, teamId: number, missionId: number) {
  return callAdmin<TeamState>('admin_cancel_completion', pin, { teamId, missionId })
}
