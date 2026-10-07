const MESSAGES: Record<string, string> = {
  game_paused: 'Il gioco è in pausa. Aspettate che riparta!',
  missions_paused: 'Le nuove missioni sono ferme per ora. Aspettate che riparta!',
  proof_required: 'Manca la prova per questa missione.',
  invalid_proof_path: 'Qualcosa è andato storto con il file. Riprovate.',
  mission_skipped: 'Questa missione è stata cambiata. Aggiorno...',
  mission_not_assigned: 'Questa missione non è più la vostra. Aggiorno...',
  fresh_available: 'Ci sono ancora missioni nuove da fare.',
  mission_not_skipped: 'Questa missione non è tra quelle scartate.',
  team_not_found: 'Squadra non trovata.',
}

// Errori che indicano che il telefono è rimasto indietro rispetto al server:
// conviene ricaricare lo stato invece di restare sulla schermata vecchia.
export const STALE_ERRORS = ['mission_skipped', 'mission_not_assigned']

export const isStaleError = (error: unknown) =>
  error instanceof Error && STALE_ERRORS.includes(error.message)

export function isNetworkError(error: unknown) {
  return (
    error instanceof Error &&
    /failed to fetch|networkerror|load failed|network request failed/i.test(error.message)
  )
}

// Messaggio leggibile per i giocatori a partire da un errore del server o della rete.
export function gameErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Connessione assente o troppo lenta. Controllate la rete e riprovate.'
  }

  if (error instanceof Error) {
    return MESSAGES[error.message] ?? error.message
  }

  return 'Qualcosa è andato storto. Riprovate.'
}
