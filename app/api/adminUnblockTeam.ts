import type { TeamState } from '../types/game'

// Sblocca una squadra ferma: toglie la missione attiva e ne assegna un'altra.
export function adminUnblockTeam(pin: string, teamId: number) {
  return callAdmin<TeamState>('admin_unblock_team', pin, { teamId })
}
