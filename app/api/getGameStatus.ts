import type { GameStatus } from '../types/admin'

// Stato di pausa del gioco (pubblico): serve alle pagine di gioco.
export function getGameStatus() {
  return callRpc<GameStatus>('get_game_status')
}
