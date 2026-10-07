import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminGetStatus } from '../../app/api/adminGetStatus'
import { adminSetGame } from '../../app/api/adminSetGame'
import { adminListProofs } from '../../app/api/adminListProofs'
import { adminOverview } from '../../app/api/adminOverview'
import { adminCancelCompletion } from '../../app/api/adminCancelCompletion'
import { adminAdjustPoints } from '../../app/api/adminAdjustPoints'
import { adminAssignMission } from '../../app/api/adminAssignMission'
import { adminUnblockTeam } from '../../app/api/adminUnblockTeam'
import { adminResetTeam } from '../../app/api/adminResetTeam'
import { adminResetGame } from '../../app/api/adminResetGame'
import { adminGetLog } from '../../app/api/adminGetLog'
import { getGameStatus } from '../../app/api/getGameStatus'
import { adminStorageStats } from '../../app/api/adminStorageStats'

const callAdmin = vi.fn()
const callRpc = vi.fn()

beforeEach(() => {
  callAdmin.mockReset().mockResolvedValue('ok')
  callRpc.mockReset().mockResolvedValue('ok')
  vi.stubGlobal('callAdmin', callAdmin)
  vi.stubGlobal('callRpc', callRpc)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('funzioni admin', () => {
  it('adminGetStatus', async () => {
    await adminGetStatus('1111')
    expect(callAdmin).toHaveBeenCalledWith('admin_get_status', '1111')
  })

  it('adminSetGame passa i due interruttori', async () => {
    await adminSetGame('1111', { missionsEnabled: false, playEnabled: true })
    expect(callAdmin).toHaveBeenCalledWith('admin_set_game', '1111', {
      missionsEnabled: false,
      playEnabled: true,
    })
  })

  it('adminListProofs e adminOverview', async () => {
    await adminListProofs('1111')
    await adminOverview('9999')
    expect(callAdmin).toHaveBeenNthCalledWith(1, 'admin_list_proofs', '1111')
    expect(callAdmin).toHaveBeenNthCalledWith(2, 'admin_overview', '9999')
  })

  it('adminCancelCompletion', async () => {
    await adminCancelCompletion('9999', 3, 12)
    expect(callAdmin).toHaveBeenCalledWith('admin_cancel_completion', '9999', { teamId: 3, missionId: 12 })
  })

  it('adminAdjustPoints', async () => {
    await adminAdjustPoints('9999', 3, -5, 'barato')
    expect(callAdmin).toHaveBeenCalledWith('admin_adjust_points', '9999', { teamId: 3, delta: -5, reason: 'barato' })
  })

  it('adminAssignMission', async () => {
    await adminAssignMission('9999', 3, 12)
    expect(callAdmin).toHaveBeenCalledWith('admin_assign_mission', '9999', { teamId: 3, missionId: 12 })
  })

  it('adminUnblockTeam e adminResetTeam', async () => {
    await adminUnblockTeam('9999', 3)
    await adminResetTeam('9999', 3)
    expect(callAdmin).toHaveBeenNthCalledWith(1, 'admin_unblock_team', '9999', { teamId: 3 })
    expect(callAdmin).toHaveBeenNthCalledWith(2, 'admin_reset_team', '9999', { teamId: 3 })
  })

  it('adminResetGame passa la conferma così com\'è', async () => {
    await adminResetGame('9999', 'RESET')
    expect(callAdmin).toHaveBeenCalledWith('admin_reset_game', '9999', { confirm: 'RESET' })
  })

  it('adminGetLog ha un limite predefinito', async () => {
    await adminGetLog('9999')
    await adminGetLog('9999', 10)
    expect(callAdmin).toHaveBeenNthCalledWith(1, 'admin_get_log', '9999', { limit: 50 })
    expect(callAdmin).toHaveBeenNthCalledWith(2, 'admin_get_log', '9999', { limit: 10 })
  })

  it('adminStorageStats', async () => {
    await adminStorageStats('9999')
    expect(callAdmin).toHaveBeenCalledWith('admin_storage_stats', '9999')
  })

  it('getGameStatus è pubblico: non usa il PIN', async () => {
    await getGameStatus()
    expect(callRpc).toHaveBeenCalledWith('get_game_status')
    expect(callAdmin).not.toHaveBeenCalled()
  })
})
