import { describe, expect, it } from 'vitest'
import { hasStartedGame } from '../../app/utils/teamProgress'

const state = (overrides = {}) => ({
  activeMission: null,
  completedMissionIds: [] as number[],
  skippedMissions: [] as { id: number; title: string; category: string; points: number }[],
  ...overrides,
})

describe('hasStartedGame', () => {
  it('una squadra nuova non ha iniziato', () => {
    expect(hasStartedGame(state())).toBe(false)
  })

  it('con una missione attiva ha iniziato', () => {
    expect(
      hasStartedGame(
        state({
          activeMission: { id: 1, title: 'X', category: 'Y', text: '', proofType: 'none', points: 5, requiresMarco: false },
        })
      )
    ).toBe(true)
  })

  it('con missioni completate ha iniziato', () => {
    expect(hasStartedGame(state({ completedMissionIds: [3] }))).toBe(true)
  })

  it('anche con sole missioni scartate ha iniziato', () => {
    expect(
      hasStartedGame(state({ skippedMissions: [{ id: 2, title: 'X', category: 'Y', points: 5 }] }))
    ).toBe(true)
  })
})
