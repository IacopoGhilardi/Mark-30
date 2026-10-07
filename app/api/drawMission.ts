import type { TeamState } from '../types/game'

// Restituisce la missione attiva, oppure ne assegna una nuova (idempotente).
export function drawMission(teamId: number) {
  return callRpc<TeamState>('draw_mission', { teamId })
}
