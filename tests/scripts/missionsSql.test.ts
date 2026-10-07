import { describe, expect, it } from 'vitest'
import { buildMissionsSql } from '../../scripts/missions-sql.mjs'
import { missions } from '../../app/datas/missions'

const mission = (overrides = {}) => ({
  id: 1,
  title: 'THE ALBUM COVER',
  category: 'TAKE THE SHOT',
  text: 'Foto seria.',
  proofType: 'photo',
  points: 15,
  requiresMarco: true,
  active: true,
  ...overrides,
})

describe('buildMissionsSql', () => {
  it('fa upsert di ogni missione', () => {
    const sql = buildMissionsSql([mission(), mission({ id: 2 })])

    expect(sql).toContain("(1, 'THE ALBUM COVER', 'TAKE THE SHOT', 'Foto seria.', 'photo', 15, true, true)")
    expect(sql).toContain('(2, ')
    expect(sql).toContain('on conflict (id) do update set')
  })

  it('raddoppia gli apici nei testi', () => {
    const sql = buildMissionsSql([mission({ text: "L'ultima foto dell'anno" })])
    expect(sql).toContain("'L''ultima foto dell''anno'")
  })

  it('disattiva le missioni non più presenti nel file', () => {
    const sql = buildMissionsSql([mission({ id: 3 }), mission({ id: 7 })])
    expect(sql).toContain('where id <> all (array[3, 7])')
  })

  it('non cancella mai missioni (potrebbero avere assegnazioni)', () => {
    expect(buildMissionsSql([mission()])).not.toMatch(/delete\s+from/i)
  })

  it('copre tutte le missioni reali del progetto', () => {
    const sql = buildMissionsSql(missions)
    for (const m of missions) {
      expect(sql).toContain(`(${m.id}, `)
    }
  })
})
