import type { TeamState } from '../types/game'

// La squadra ha già giocato: ha una missione attiva, ne ha completate o ne ha scartate.
// Serve a rimandarla direttamente al gioco invece che alla pagina d'ingresso.
export function hasStartedGame(
  state: Pick<TeamState, 'activeMission' | 'completedMissionIds' | 'skippedMissions'>
): boolean {
  return (
    state.activeMission !== null ||
    state.completedMissionIds.length > 0 ||
    state.skippedMissions.length > 0
  )
}
