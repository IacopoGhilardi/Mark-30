import type { TeamState } from '../types/game'

// Stato completo della squadra: punteggio, missione attiva, completate.
export function getTeamState(teamId: number) {
  return callRpc<TeamState>('get_team_state', { teamId })
}
