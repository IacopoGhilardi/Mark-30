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
