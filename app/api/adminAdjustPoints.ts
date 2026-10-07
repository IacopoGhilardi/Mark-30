import type { TeamState } from '../types/game'

// Aggiunge o toglie punti a mano (delta positivo o negativo), con un motivo.
export function adminAdjustPoints(pin: string, teamId: number, delta: number, reason: string) {
  return callAdmin<TeamState>('admin_adjust_points', pin, { teamId, delta, reason })
}
