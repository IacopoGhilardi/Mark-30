export type ProofRow = {
  id: string
  teamId: number
  teamName: string
  missionId: number
  title: string
  category: string
  points: number
  completedAt: string
  proofText: string | null
  proofPath: string | null
  sizeBytes: number | null
}
