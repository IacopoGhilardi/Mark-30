import type { TeamState } from '../types/game'

// Assegna una missione precisa a una squadra (anche con il gioco in pausa).
export function adminAssignMission(pin: string, teamId: number, missionId: number) {
  return callAdmin<TeamState>('admin_assign_mission', pin, { teamId, missionId })
}
