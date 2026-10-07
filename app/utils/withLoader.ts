// Tempo minimo in cui il loader resta visibile: senza, una chiamata veloce
// (per esempio in locale) lo farebbe lampeggiare o non comparire affatto.
export const LOADER_MIN_MS = 2000

export type LoaderOptions = {
  // durata minima di visibilità in millisecondi (0 per disattivarla)
  minMs?: number
}

// Mostra il loader mentre una chiamata è in corso e lo nasconde sempre alla fine
// (anche in caso di errore). Con più chiamate in parallelo il loader resta
// visibile finché non terminano tutte. Il risultato torna subito al chiamante:
// a restare più a lungo, se serve, è solo il loader. In caso di errore il loader
// si chiude subito, così il messaggio non resta nascosto.
export async function withLoader<T>(
  task: () => Promise<T>,
  text = 'CARICAMENTO...',
  options: LoaderOptions = {}
): Promise<T> {
  const { showLoader, hideLoader } = useAppLoader()
  const pending = useState<number>('app-loader-pending', () => 0)
  const shownAt = useState<number>('app-loader-shown-at', () => 0)
  const minMs = options.minMs ?? LOADER_MIN_MS

  if (pending.value === 0) {
    shownAt.value = Date.now()
  }

  pending.value++
  showLoader(text)

  let succeeded = false

  try {
    const result = await task()
    succeeded = true

    return result
  } finally {
    pending.value = Math.max(0, pending.value - 1)

    if (pending.value === 0) {
      const wait = succeeded ? Math.max(0, minMs - (Date.now() - shownAt.value)) : 0

      const hide = () => {
        // se nel frattempo è partita un'altra chiamata, il loader resta
        if (pending.value === 0) {
          hideLoader()
        }
      }

      if (wait > 0) {
        setTimeout(hide, wait)
      } else {
        hide()
      }
    }
  }
}
