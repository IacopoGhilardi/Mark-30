import type { ProofType } from '../datas/missions'

export type ActiveMission = {
  id: number
  title: string
  category: string
  text: string
  proofType: ProofType
  points: number
  requiresMarco: boolean
}

export type TeamState = {
  teamId: number
  name: string
  score: number
  missionNumber: number
  step: 'ready' | 'active'
  completedMissionIds: number[]
  activeMission: ActiveMission | null
}

export type LeaderboardRow = {
  teamId: number
  name: string
  score: number
  completedMissions: number
}

export type Proof = {
  text?: string | null
  file?: File | null
}

// API del gioco: il frontend non conosce l'implementazione server.
export function useGameApi() {
  const supabase = useSupabase()

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(fn, args)

    if (error) {
      throw new Error(error.message)
    }

    return data as T
  }

  function getTeamState(teamId: number) {
    return rpc<TeamState>('get_team_state', { p_team_id: teamId })
  }

  // Restituisce la missione attiva, oppure ne assegna una nuova.
  function drawMission(teamId: number) {
    return rpc<TeamState>('draw_mission', { p_team_id: teamId })
  }

  async function uploadProof(teamId: number, missionId: number, file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `team-${teamId}/mission-${missionId}-${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('proofs')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (error) {
      throw new Error(error.message)
    }

    return path
  }

  // Carica l'eventuale file e poi chiude la missione (idempotente lato server).
  async function completeMission(
    teamId: number,
    missionId: number,
    proof: Proof = {}
  ) {
    const proofPath = proof.file
      ? await uploadProof(teamId, missionId, proof.file)
      : null

    return rpc<TeamState>('complete_mission', {
      p_team_id: teamId,
      p_mission_id: missionId,
      p_proof_text: proof.text ?? null,
      p_proof_path: proofPath,
    })
  }

  async function getLeaderboard(): Promise<LeaderboardRow[]> {
    const { data, error } = await supabase
      .from('team_scores')
      .select('team_id, name, score, completed_missions')

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []).map((row) => ({
      teamId: row.team_id,
      name: row.name,
      score: row.score,
      completedMissions: row.completed_missions,
    }))
  }

  return {
    getTeamState,
    drawMission,
    completeMission,
    uploadProof,
    getLeaderboard,
  }
}
