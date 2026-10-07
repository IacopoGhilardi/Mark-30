import { describe, expect, it } from 'vitest'
import { buildTeamsSql } from '../../scripts/teams-sql.mjs'
import { teams } from '../../app/datas/teams'

const team = (overrides = {}) => ({ id: 1, name: 'TEAM 1', members: ['Ada', 'Bruno'], ...overrides })

describe('buildTeamsSql', () => {
  it('fa upsert di ogni squadra con i componenti come array', () => {
    const sql = buildTeamsSql([team(), team({ id: 2, name: 'TEAM 2', members: ['Carla'] })])

    expect(sql).toContain("(1, 'TEAM 1', array['Ada', 'Bruno']::text[])")
    expect(sql).toContain("(2, 'TEAM 2', array['Carla']::text[])")
    expect(sql).toContain('on conflict (id) do update set')
  })

  it('raddoppia gli apici nei nomi', () => {
    const sql = buildTeamsSql([team({ members: ["Dell'Orto", "L'Aquila"] })])

    expect(sql).toContain("array['Dell''Orto', 'L''Aquila']")
  })

  it('toglie le squadre sparite dal file solo se non hanno giocato', () => {
    const sql = buildTeamsSql([team({ id: 3 }), team({ id: 5 })])

    expect(sql).toContain('t.id <> all (array[3, 5])')
    expect(sql).toContain('not exists (select 1 from public.team_missions')
    expect(sql).toContain('not exists (select 1 from public.point_adjustments')
  })

  it('copre tutte le squadre reali del progetto', () => {
    const sql = buildTeamsSql(teams)

    for (const item of teams) {
      expect(sql).toContain(`(${item.id}, `)
      for (const member of item.members) {
        expect(sql).toContain(member.replace(/'/g, "''"))
      }
    }
  })
})
