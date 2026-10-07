export type TeamRow = {
  id: number
  name: string
  members: string[]
}

// teams è leggibile dal browser (policy "teams readable").
export const teamsRepository = createReadRepository<TeamRow>('teams')
