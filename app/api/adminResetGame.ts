// Azzera tutte le squadre. Il server vuole la conferma esatta 'RESET'.
export function adminResetGame(pin: string, confirm: string) {
  return callAdmin<{ rows: number }>('admin_reset_game', pin, { confirm })
}
