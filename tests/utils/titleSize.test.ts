import { describe, expect, it } from 'vitest'
import { missions } from '../../app/datas/missions'
import { longestWordLength } from '../../app/utils/titleSize'

describe('longestWordLength', () => {
  it('restituisce la parola più lunga', () => {
    expect(longestWordLength('THE INTRODUCTION')).toBe(12)
    expect(longestWordLength('THE ALBUM COVER')).toBe(5)
  })

  it('ha un minimo, così i titoli corti non diventano enormi', () => {
    expect(longestWordLength('30')).toBe(5)
    expect(longestWordLength('')).toBe(5)
    expect(longestWordLength('', 3)).toBe(3)
  })

  it('conta le emoji come un solo carattere e ignora gli spazi multipli', () => {
    expect(longestWordLength('ONE  SECOND ❤️')).toBe(6)
  })

  it('funziona su tutte le missioni reali', () => {
    for (const mission of missions) {
      const length = longestWordLength(mission.title)
      expect(length).toBeGreaterThanOrEqual(5)
      expect(length).toBeLessThanOrEqual(20)
    }
  })
})
