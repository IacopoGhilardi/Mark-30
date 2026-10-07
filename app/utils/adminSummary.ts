// Testi dell'ultima conferma prima di un'azione che non si può annullare:
// dicono quanto si sta per perdere, così non si conferma "a occhi chiusi".

type TeamTotals = { score: number; completed: number }

export function resetSummary(teams: TeamTotals[]): string {
  const completed = teams.reduce((total, team) => total + team.completed, 0)
  const points = teams.reduce((total, team) => total + team.score, 0)

  return (
    `Stai per azzerare TUTTE le squadre:\n` +
    `• ${completed} ${completed === 1 ? 'missione completata' : 'missioni completate'}\n` +
    `• ${points} punti totali\n` +
    `• missioni attive, scartate e correzioni di punti`
  )
}

export function clearSummary(stats: { fileCount: number; usedBytes: number } | null): string {
  if (!stats) {
    return 'Stai per eliminare TUTTE le foto e i video caricati.'
  }

  return (
    `Stai per eliminare TUTTE le foto e i video caricati:\n` +
    `• ${stats.fileCount} ${stats.fileCount === 1 ? 'file' : 'file'}\n` +
    `• ${formatBytes(stats.usedBytes)} di spazio`
  )
}
