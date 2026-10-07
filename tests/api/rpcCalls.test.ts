import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTeamState } from '../../app/api/getTeamState'
import { drawMission } from '../../app/api/drawMission'
import { getLeaderboard } from '../../app/api/getLeaderboard'
import { getCompletedMissions } from '../../app/api/getCompletedMissions'
import { skipMission } from '../../app/api/skipMission'
import { redrawSkippedMission } from '../../app/api/redrawSkippedMission'

const callRpc = vi.fn()

beforeEach(() => {
  callRpc.mockReset().mockResolvedValue('result')
  vi.stubGlobal('callRpc', callRpc)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getTeamState', () => {
  it('chiama get_team_state con il teamId', async () => {
    await expect(getTeamState(7)).resolves.toBe('result')
    expect(callRpc).toHaveBeenCalledWith('get_team_state', { teamId: 7 })
  })
})

describe('drawMission', () => {
  it('chiama draw_mission con il teamId', async () => {
    await drawMission(3)
    expect(callRpc).toHaveBeenCalledWith('draw_mission', { teamId: 3 })
  })
})

describe('getLeaderboard', () => {
  it('chiama get_leaderboard senza argomenti', async () => {
    await getLeaderboard()
    expect(callRpc).toHaveBeenCalledWith('get_leaderboard')
  })
})

describe('getCompletedMissions', () => {
  it('senza opzioni non passa argomenti (feed globale)', async () => {
    await getCompletedMissions()
    expect(callRpc).toHaveBeenCalledWith('get_completed_missions', {})
  })

  it('passa teamId e limit solo se presenti', async () => {
    await getCompletedMissions({ teamId: 4 })
    expect(callRpc).toHaveBeenLastCalledWith('get_completed_missions', { teamId: 4 })

    await getCompletedMissions({ limit: 10 })
    expect(callRpc).toHaveBeenLastCalledWith('get_completed_missions', { limit: 10 })
  })

  it('accetta teamId 0 senza scartarlo', async () => {
    await getCompletedMissions({ teamId: 0 })
    expect(callRpc).toHaveBeenLastCalledWith('get_completed_missions', { teamId: 0 })
  })
})

describe('skipMission', () => {
  it('passa squadra e missione mostrata', async () => {
    await skipMission(7, 12)
    expect(callRpc).toHaveBeenCalledWith('skip_mission', { teamId: 7, missionId: 12 })
  })
})

describe('redrawSkippedMission', () => {
  it('senza missione lascia scegliere al server', async () => {
    await redrawSkippedMission(7)
    expect(callRpc).toHaveBeenCalledWith('redraw_skipped_mission', { teamId: 7 })
  })

  it('con missione sceglie quella', async () => {
    await redrawSkippedMission(7, 12)
    expect(callRpc).toHaveBeenCalledWith('redraw_skipped_mission', { teamId: 7, missionId: 12 })
  })
})
