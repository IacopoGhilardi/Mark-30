export type GameStatus = {
  missionsEnabled: boolean
  playEnabled: boolean
}

export type AdminTeam = {
  teamId: number
  name: string
  score: number
  adjustments: number
  completed: number
  skipped: number
  completedMissions: { id: number; title: string; points: number }[]
  activeMission: { id: number; title: string; assignedAt: string } | null
}

export type AdminOverview = {
  status: GameStatus
  teams: AdminTeam[]
  missions: { id: number; title: string; active: boolean }[]
}

export type AdminLogRow = {
  id: number
  role: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}
