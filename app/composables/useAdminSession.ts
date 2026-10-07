// PIN dell'admin, tenuto solo per la durata della scheda (sessionStorage):
// una ricarica non richiede di reinserirlo, chiudere la scheda sì.
export function useAdminSession(scope: 'marco' | 'irenegade') {
  const pin = useState<string>(`admin-pin-${scope}`, () => '')
  const key = `marcos30-admin-${scope}`

  function restore() {
    try {
      pin.value = sessionStorage.getItem(key) ?? ''
    } catch {
      pin.value = ''
    }
  }

  function save(value: string) {
    pin.value = value

    try {
      sessionStorage.setItem(key, value)
    } catch {
      // storage non disponibile: il PIN resta solo in memoria
    }
  }

  function clear() {
    pin.value = ''

    try {
      sessionStorage.removeItem(key)
    } catch {
      // niente da fare
    }
  }

  return { pin, restore, save, clear }
}
