import type { AdminOverview } from '../types/admin'

// Solo Irene: tutte le squadre con missione attiva, punti e scartate.
export function adminOverview(pin: string) {
  return callAdmin<AdminOverview>('admin_overview', pin)
}
