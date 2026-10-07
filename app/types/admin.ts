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

export type StorageLevel = 'ok' | 'warning' | 'critical'

export type StorageStats = {
  limitBytes: number
  usedBytes: number
  fileCount: number
  percent: number
  level: StorageLevel
  images: { count: number; bytes: number }
  videos: { count: number; bytes: number }
  // file caricati ma non collegati a nessuna missione completata
  orphans: { count: number; bytes: number }
  perTeam: { teamId: number; count: number; bytes: number }[]
  database: { usedBytes: number; limitBytes: number }
}
