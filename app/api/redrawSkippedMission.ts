import type { TeamState } from '../types/game'

// Finite le missioni nuove: riassegna una missione scartata. Senza missionId
// ne sceglie una il server, con missionId la squadra sceglie quale.
export function redrawSkippedMission(teamId: number, missionId?: number) {
  return callRpc<TeamState>('redraw_skipped_mission', {
    teamId,
    ...(missionId !== undefined && { missionId }),
  })
}
