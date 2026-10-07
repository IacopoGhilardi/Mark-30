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

export type SkippedMission = {
  id: number
  title: string
  category: string
  points: number
}

export type TeamState = {
  teamId: number
  name: string
  score: number
  missionNumber: number
  step: 'ready' | 'active'
  completedMissionIds: number[]
  activeMission: ActiveMission | null
  skippedMissions: SkippedMission[]
  // missioni mai assegnate a questa squadra
  freshRemaining: number
  // nessuna nuova e nessuna attiva, ma ci sono scartate da riavere
  canRedrawSkipped: boolean
  // nessuna nuova, nessuna attiva, nessuna scartata: ha finito tutto
  allDone: boolean
}

export type LeaderboardRow = {
  position: number
  teamId: number
  name: string
  score: number
  completedMissions: number
  lastCompletedAt: string | null
}

export type CompletedMission = {
  id: string
  teamId: number
  teamName: string
  missionId: number
  title: string
  category: string
  points: number
  completedAt: string
}

export type Proof = {
  text?: string | null
  file?: File | null
}
