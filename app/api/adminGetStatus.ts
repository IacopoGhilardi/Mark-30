import type { GameStatus } from '../types/admin'

// Marco o Irene. Serve anche da "login": valida il PIN con la prima chiamata.
export function adminGetStatus(pin: string) {
  return callAdmin<GameStatus>('admin_get_status', pin)
}
