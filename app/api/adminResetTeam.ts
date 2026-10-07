import type { TeamState } from '../types/game'

// Azzera una squadra: missioni e correzioni di punti.
export function adminResetTeam(pin: string, teamId: number) {
  return callAdmin<TeamState>('admin_reset_team', pin, { teamId })
}
