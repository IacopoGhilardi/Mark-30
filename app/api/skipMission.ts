import type { TeamState } from '../types/game'

// Salta la missione attiva e restituisce lo stato con una missione nuova.
// Si passa la missione mostrata dal telefono: se nel frattempo è già cambiata
// (altro telefono) il server non salta anche quella nuova.
export function skipMission(teamId: number, missionId: number) {
  return callRpc<TeamState>('skip_mission', { teamId, missionId })
}
