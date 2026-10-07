import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { completeMission } from '../../app/api/completeMission'

const callRpc = vi.fn()
const uploadProof = vi.fn()

beforeEach(() => {
  callRpc.mockReset().mockResolvedValue({ score: 15 })
  uploadProof.mockReset().mockResolvedValue('team-7/mission-12-1.jpg')
  vi.stubGlobal('callRpc', callRpc)
  vi.stubGlobal('uploadProof', uploadProof)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('completeMission', () => {
  it('senza prova non carica nulla e invia null', async () => {
    await completeMission(7, 12)

    expect(uploadProof).not.toHaveBeenCalled()
    expect(callRpc).toHaveBeenCalledWith('complete_mission', {
      teamId: 7,
      missionId: 12,
      proofText: null,
      proofPath: null,
    })
  })

  it('con un file lo carica prima e poi invia il percorso', async () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })

    await completeMission(7, 12, { file })

    expect(uploadProof).toHaveBeenCalledWith(7, 12, file)
    expect(callRpc).toHaveBeenCalledWith('complete_mission', {
      teamId: 7,
      missionId: 12,
      proofText: null,
      proofPath: 'team-7/mission-12-1.jpg',
    })
    expect(uploadProof.mock.invocationCallOrder[0]).toBeLessThan(
      callRpc.mock.invocationCallOrder[0]!
    )
  })

  it('con il testo lo invia senza caricare file', async () => {
    await completeMission(7, 12, { text: 'ciao Marco' })

    expect(uploadProof).not.toHaveBeenCalled()
    expect(callRpc).toHaveBeenCalledWith(
      'complete_mission',
      expect.objectContaining({ proofText: 'ciao Marco', proofPath: null })
    )
  })

  it('non invia i punti: li decide il server', async () => {
    await completeMission(7, 12, { text: 'x' })

    const args = callRpc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(args)).not.toContain('points')
  })

  it('se l\'upload fallisce non completa la missione', async () => {
    uploadProof.mockRejectedValue(new Error('upload fallito'))
    const file = new File(['x'], 'foto.jpg')

    await expect(completeMission(7, 12, { file })).rejects.toThrow('upload fallito')
    expect(callRpc).not.toHaveBeenCalled()
  })

  it('restituisce lo stato restituito dal server', async () => {
    await expect(completeMission(7, 12)).resolves.toEqual({ score: 15 })
  })
})
