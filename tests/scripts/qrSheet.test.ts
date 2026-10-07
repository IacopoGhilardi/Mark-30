import { describe, expect, it } from 'vitest'
import { buildSheetHtml } from '../../scripts/qr-sheet.mjs'

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
