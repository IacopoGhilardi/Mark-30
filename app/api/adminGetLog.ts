import type { AdminLogRow } from '../types/admin'

// Ultime azioni da admin, dalla più recente.
export function adminGetLog(pin: string, limit = 50) {
  return callAdmin<AdminLogRow[]>('admin_get_log', pin, { limit })
}
