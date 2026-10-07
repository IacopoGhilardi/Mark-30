import { describe, expect, it } from 'vitest'
import { buildSheetHtml, teamUrl } from '../../scripts/qr-sheet.mjs'

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
    for (const bad of ['', 'marcos30.netlify.app', 'ftp://x.it', undefined]) {
      expect(() => teamUrl(bad as string, 1)).toThrow('Indirizzo non valido')
    }
  })
})

describe('buildSheetHtml', () => {
  const item = (id: number, name = `TEAM ${id}`) => ({
    id,
    name,
    url: `https://x.it/play/${id}`,
    svg: '<svg></svg>',
  })

  it('ha un riquadro per squadra con numero, nome, QR e link', () => {
    const html = buildSheetHtml([item(1), item(2)])

    expect(html.match(/class="card"/g)).toHaveLength(2)
    expect(html).toContain('SQUADRA 01')
    expect(html).toContain('TEAM 2')
    expect(html).toContain('<svg></svg>')
    expect(html).toContain('https://x.it/play/2')
  })

  it('protegge i nomi dai caratteri HTML', () => {
    const html = buildSheetHtml([item(1, '<b>"Team" & co</b>')])

    expect(html).toContain('&lt;b&gt;&quot;Team&quot; &amp; co&lt;/b&gt;')
    expect(html).not.toContain('<b>')
  })
})
