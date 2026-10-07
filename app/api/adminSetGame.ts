import type { GameStatus } from '../types/admin'

// Ferma o riavvia le nuove missioni e/o il gioco in generale.
export function adminSetGame(pin: string, status: GameStatus) {
  return callAdmin<GameStatus>('admin_set_game', pin, { ...status })
}
