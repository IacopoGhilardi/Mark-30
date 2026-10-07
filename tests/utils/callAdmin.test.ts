import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminError, callAdmin, errorMessage } from '../../app/utils/callAdmin'

const callRpc = vi.fn()

beforeEach(() => {
  callRpc.mockReset()
  vi.stubGlobal('callRpc', callRpc)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('callAdmin', () => {
  it('manda il PIN insieme agli argomenti e restituisce i dati', async () => {
    callRpc.mockResolvedValue({ ok: true, data: { x: 1 } })

    await expect(callAdmin('admin_set_game', '1234', { playEnabled: true })).resolves.toEqual({ x: 1 })
    expect(callRpc).toHaveBeenCalledWith('admin_set_game', { pin: '1234', playEnabled: true })
  })

  it('trasforma un errore del server in AdminError con messaggio leggibile', async () => {
    callRpc.mockResolvedValue({ ok: false, error: 'invalid_pin' })

    const error = await callAdmin('admin_get_status', '0000').catch((e) => e)

    expect(error).toBeInstanceOf(AdminError)
    expect(error.code).toBe('invalid_pin')
    expect(error.message).toBe('PIN errato')
  })

  it('segnala il blocco per troppi tentativi', async () => {
    callRpc.mockResolvedValue({ ok: false, error: 'locked' })
    await expect(callAdmin('admin_get_status', 'x')).rejects.toThrow('Troppi tentativi')
  })

  it('un codice sconosciuto resta com\'è', async () => {
    callRpc.mockResolvedValue({ ok: false, error: 'qualcosa_di_nuovo' })
    await expect(callAdmin('admin_get_status', 'x')).rejects.toThrow('qualcosa_di_nuovo')
  })

  it('lascia passare gli errori di rete', async () => {
    callRpc.mockRejectedValue(new Error('rete assente'))
    await expect(callAdmin('admin_get_status', 'x')).rejects.toThrow('rete assente')
  })
})

describe('errorMessage', () => {
  it('usa il messaggio dell\'errore, altrimenti il testo di riserva', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('stringa', 'riserva')).toBe('riserva')
  })
})
