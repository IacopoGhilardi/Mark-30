import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatBytes } from '../../app/utils/formatBytes'
import { clearSummary, resetSummary } from '../../app/utils/adminSummary'

beforeEach(() => {
  vi.stubGlobal('formatBytes', formatBytes)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resetSummary', () => {
  it('riassume missioni e punti di tutte le squadre', () => {
    const text = resetSummary([
      { score: 30, completed: 2 },
      { score: 15, completed: 1 },
    ])

    expect(text).toContain('3 missioni completate')
    expect(text).toContain('45 punti totali')
  })

  it('usa il singolare per una sola missione', () => {
    expect(resetSummary([{ score: 5, completed: 1 }])).toContain('1 missione completata')
  })

  it('funziona anche a gioco vuoto', () => {
    const text = resetSummary([])

    expect(text).toContain('0 missioni completate')
    expect(text).toContain('0 punti totali')
  })
})

describe('clearSummary', () => {
  it('riassume file e spazio', () => {
    const text = clearSummary({ fileCount: 12, usedBytes: 5 * 1024 * 1024 })

    expect(text).toContain('12 file')
    expect(text).toContain('5,0 MB')
  })

  it('ha un testo generico se le statistiche non sono disponibili', () => {
    expect(clearSummary(null)).toContain('TUTTE le foto e i video')
  })
})
