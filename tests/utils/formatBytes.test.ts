import { describe, expect, it } from 'vitest'
import { formatBytes } from '../../app/utils/formatBytes'

describe('formatBytes', () => {
  it('formatta le unità con la virgola', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1,5 KB')
    expect(formatBytes(20 * 1024 * 1024)).toBe('20,0 MB')
    expect(formatBytes(1073741824)).toBe('1,0 GB')
  })

  it('gestisce valori vuoti o non validi', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(null)).toBe('0 B')
    expect(formatBytes(undefined)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
  })
})
