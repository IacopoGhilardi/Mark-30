import type { CompletedMission } from '../types/game'

// Missioni completate con i punti: di una squadra, oppure di tutte (feed).
export function getCompletedMissions(options: { teamId?: number; limit?: number } = {}) {
  return callRpc<CompletedMission[]>('get_completed_missions', {
    ...(options.teamId !== undefined && { teamId: options.teamId }),
    ...(options.limit !== undefined && { limit: options.limit }),
  })
}
