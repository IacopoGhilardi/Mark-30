import { describe, expect, it } from 'vitest'
import { gameErrorMessage, isNetworkError, isStaleError } from '../../app/utils/gameError'

describe('gameErrorMessage', () => {
  it('traduce i codici del server', () => {
    expect(gameErrorMessage(new Error('game_paused'))).toContain('pausa')
    expect(gameErrorMessage(new Error('missions_paused'))).toContain('nuove missioni')
    expect(gameErrorMessage(new Error('proof_required'))).toContain('prova')
  })

  it('riconosce gli errori di rete dei vari browser', () => {
    for (const message of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource', 'Network request failed']) {
      expect(isNetworkError(new Error(message))).toBe(true)
      expect(gameErrorMessage(new Error(message))).toContain('Connessione')
    }
  })

  it('lascia passare un messaggio sconosciuto', () => {
    expect(gameErrorMessage(new Error('File troppo grande (max 20 MB)'))).toBe('File troppo grande (max 20 MB)')
  })

  it('ha un testo di riserva per errori non standard', () => {
    expect(gameErrorMessage('boh')).toContain('Riprovate')
    expect(gameErrorMessage(null)).toContain('Riprovate')
  })
})

describe('isStaleError', () => {
  it('segnala le missioni cambiate da un altro telefono', () => {
    expect(isStaleError(new Error('mission_skipped'))).toBe(true)
    expect(isStaleError(new Error('mission_not_assigned'))).toBe(true)
  })

  it('non segnala gli altri errori', () => {
    expect(isStaleError(new Error('game_paused'))).toBe(false)
    expect(isStaleError('mission_skipped')).toBe(false)
  })
})
