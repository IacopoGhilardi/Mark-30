import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callRpc } from '../../app/utils/repository'

const rpc = vi.fn()

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null })
  vi.stubGlobal('useSupabase', () => ({ rpc }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('callRpc', () => {
  it('converte gli argomenti in snake_case con prefisso p_', async () => {
    await callRpc('complete_mission', { teamId: 7, missionId: 12, proofText: null })

    expect(rpc).toHaveBeenCalledWith('complete_mission', {
      p_team_id: 7,
      p_mission_id: 12,
      p_proof_text: null,
    })
  })

  it('senza argomenti chiama la funzione con un oggetto vuoto', async () => {
    await callRpc('get_leaderboard')
    expect(rpc).toHaveBeenCalledWith('get_leaderboard', {})
  })

  it('riporta in camelCase le chiavi delle righe restituite', async () => {
    rpc.mockResolvedValue({
      data: [{ team_id: 1, completed_missions: 2, last_completed_at: null }],
      error: null,
    })

    await expect(callRpc('get_leaderboard')).resolves.toEqual([
      { teamId: 1, completedMissions: 2, lastCompletedAt: null },
    ])
  })

  it('lascia invariato un oggetto (jsonb già in camelCase)', async () => {
    const state = { teamId: 7, activeMission: null }
    rpc.mockResolvedValue({ data: state, error: null })

    await expect(callRpc('get_team_state', { teamId: 7 })).resolves.toBe(state)
  })

  it('lancia un errore con il messaggio del DB', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'proof_required' } })

    await expect(callRpc('complete_mission', { teamId: 1 })).rejects.toThrow(
      'proof_required'
    )
  })
})
