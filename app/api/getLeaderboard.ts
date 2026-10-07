import type { LeaderboardRow } from '../types/game'

// Classifica ordinata per punti, con posizione.
export function getLeaderboard() {
  return callRpc<LeaderboardRow[]>('get_leaderboard')
}
