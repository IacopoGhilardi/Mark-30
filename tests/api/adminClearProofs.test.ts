import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminClearProofs } from '../../app/api/adminClearProofs'

const list = vi.fn()
const remove = vi.fn()
const callAdmin = vi.fn()

const folder = (name: string) => ({ name, id: null })
const file = (name: string) => ({ name, id: `id-${name}` })

beforeEach(() => {
  list.mockReset()
  remove.mockReset().mockImplementation(async (paths: string[]) => ({
    data: paths.map((name) => ({ name })),
    error: null,
  }))
  callAdmin.mockReset().mockResolvedValue({ logged: true })

  vi.stubGlobal('adminStorageClient', () => ({ storage: { from: () => ({ list, remove }) } }))
  vi.stubGlobal('callAdmin', callAdmin)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('adminClearProofs', () => {
  it('elimina i file di ogni cartella e restituisce il totale', async () => {
    list.mockImplementation(async (prefix: string) => {
      if (prefix === '') return { data: [folder('team-1'), folder('team-2')], error: null }
      if (prefix === 'team-1') return { data: [file('a.jpg'), file('b.jpg')], error: null }
      return { data: [file('c.mp4')], error: null }
    })

    await expect(adminClearProofs('9999')).resolves.toBe(3)

    expect(remove).toHaveBeenCalledWith(['team-1/a.jpg', 'team-1/b.jpg'])
    expect(remove).toHaveBeenCalledWith(['team-2/c.mp4'])
  })

  it('salta le cartelle vuote', async () => {
    list.mockImplementation(async (prefix: string) =>
      prefix === '' ? { data: [folder('team-1')], error: null } : { data: [], error: null }
    )

    await expect(adminClearProofs('9999')).resolves.toBe(0)
    expect(remove).not.toHaveBeenCalled()
  })

  it('elimina anche un file nella radice', async () => {
    list.mockResolvedValue({ data: [file('orfano.jpg')], error: null })

    await expect(adminClearProofs('9999')).resolves.toBe(1)
    expect(remove).toHaveBeenCalledWith(['orfano.jpg'])
  })

  it('registra l\'azione con il numero di file eliminati', async () => {
    list.mockImplementation(async (prefix: string) =>
      prefix === '' ? { data: [folder('team-1')], error: null } : { data: [file('a.jpg')], error: null }
    )

    await adminClearProofs('9999')

    expect(callAdmin).toHaveBeenCalledWith('admin_log_event', '9999', {
      action: 'clear_proofs',
      details: { removed: 1 },
    })
  })

  it('segnala se la policy nega l\'eliminazione (lo Storage non dà errore)', async () => {
    list.mockImplementation(async (prefix: string) =>
      prefix === '' ? { data: [folder('team-1')], error: null } : { data: [file('a.jpg'), file('b.jpg')], error: null }
    )
    remove.mockResolvedValue({ data: [], error: null })

    await expect(adminClearProofs('1111')).rejects.toThrow('non sono stati eliminati')
    expect(callAdmin).not.toHaveBeenCalled()
  })

  it('lancia gli errori dello Storage', async () => {
    list.mockResolvedValue({ data: null, error: { message: 'rete assente' } })

    await expect(adminClearProofs('9999')).rejects.toThrow('rete assente')
  })
})
