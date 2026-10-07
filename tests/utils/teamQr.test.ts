import { describe, expect, it } from 'vitest'
import { isLocalOrigin, makeQrSvg, teamUrl } from '../../app/utils/teamQr'

describe('teamUrl', () => {
  it('punta a /play/{id} sul dominio indicato', () => {
    expect(teamUrl('https://marcos30.netlify.app', 7)).toBe('https://marcos30.netlify.app/play/7')
  })

  it('ignora spazi e barre finali', () => {
    expect(teamUrl('  https://marcos30.netlify.app/// ', 3)).toBe('https://marcos30.netlify.app/play/3')
  })

  it('accetta anche http con porta (prove in rete locale)', () => {
    expect(teamUrl('http://192.168.1.20:3000', 1)).toBe('http://192.168.1.20:3000/play/1')
  })

  it('rifiuta indirizzi non validi', () => {
    for (const bad of ['', 'marcos30.netlify.app', 'ftp://x.it', undefined, null]) {
      expect(() => teamUrl(bad, 1)).toThrow('Indirizzo non valido')
    }
  })
})

describe('isLocalOrigin', () => {
  it('riconosce gli indirizzi locali', () => {
    for (const local of [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.1.20:3000',
      'http://10.0.0.5',
      'http://172.16.0.9',
      'http://172.31.255.1',
      'http://mac-di-iacopo.local:3000',
    ]) {
      expect(isLocalOrigin(local)).toBe(true)
    }
  })

  it('non segnala i domini pubblici', () => {
    for (const pub of ['https://marcos30.netlify.app', 'https://172.32.0.1', 'https://example.com:8443', '']) {
      expect(isLocalOrigin(pub)).toBe(false)
    }
  })
})

describe('makeQrSvg', () => {
  it('genera un SVG', async () => {
    const svg = await makeQrSvg('https://marcos30.netlify.app/play/1')

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('</svg>')
  })

  it('indirizzi diversi danno QR diversi', async () => {
    expect(await makeQrSvg('https://x.it/play/1')).not.toBe(await makeQrSvg('https://x.it/play/2'))
  })
})
