export type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const MESSAGES: Record<string, string> = {
  invalid_pin: 'PIN errato',
  locked: 'Troppi tentativi sbagliati. Riprova tra qualche minuto.',
  forbidden: 'Questo PIN non ha accesso a questa pagina',
  not_completed: 'La missione non risulta completata',
  invalid_adjustment: 'Indica un valore diverso da 0 e un motivo',
  team_not_found: 'Squadra non trovata',
  mission_not_found: 'Missione non trovata',
  already_completed: 'La squadra ha già completato questa missione',
  confirmation_required: 'Conferma mancante',
}

export class AdminError extends Error {
  constructor(public code: string) {
    super(MESSAGES[code] ?? code)
  }
}

// Le funzioni admin non sollevano errori SQL (così i PIN errati restano
// registrati dal blocco anti-tentativi): rispondono {ok, data | error}.
export async function callAdmin<T>(
  fn: string,
  pin: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const result = await callRpc<AdminResult<T>>(fn, { pin, ...args })

  if (!result.ok) {
    throw new AdminError(result.error)
  }

  return result.data
}

export function errorMessage(error: unknown, fallback = 'Qualcosa è andato storto') {
  return error instanceof Error ? error.message : fallback
}
