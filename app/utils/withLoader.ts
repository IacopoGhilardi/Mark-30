// Mostra il loader mentre una chiamata è in corso e lo nasconde sempre alla fine
// (anche in caso di errore). Con più chiamate in parallelo il loader resta
// visibile finché non terminano tutte.
export async function withLoader<T>(
  task: () => Promise<T>,
  text = 'CARICAMENTO...'
): Promise<T> {
  const { showLoader, hideLoader } = useAppLoader()
  const pending = useState<number>('app-loader-pending', () => 0)

  pending.value++
  showLoader(text)

  try {
    return await task()
  } finally {
    pending.value--

    if (pending.value <= 0) {
      pending.value = 0
      hideLoader()
    }
  }
}
