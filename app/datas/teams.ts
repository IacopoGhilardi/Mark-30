export type Team = {
  id: number
  name: string
  members: string[]
}

export const teams: Team[] = [
  {
    id: 1,
    name: 'TEAM 1',
    members: ['Seppia', 'Bata', 'Claudia', 'Nedo', 'Scavo'],
  },
  {
    id: 2,
    name: 'TEAM 2',
    members: ['Bartolomei', 'Carmen', 'Nico', 'Aras', 'Andre Grossi'],
  },
  {
    id: 3,
    name: 'TEAM 3',
    members: ['Fede Stella', 'Vittoria', 'Bianu', 'marzu', 'Federico Filipp'],
  },
  {
    id: 4,
    name: 'TEAM 4',
    members: ['Pasqui', 'Asia Rinzi', 'Ghila', 'Giulia Carni', 'Crappi'],
  },
  {
    id: 5,
    name: 'TEAM 5',
    members: ['Confo', 'Kevin', 'Pozza', 'Azzu', 'Cloe'],
  },
  {
    id: 6,
    name: 'TEAM 6',
    members: ['Biancone', 'Gianlu', 'Asia', 'Greta', 'Filippo'],
  },
  {
    id: 7,
    name: 'TEAM 7',
    members: ['Santamaria', 'Elisa', 'Ire', 'Lupetta', 'Giacomino'],
  },
  {
    id: 8,
    name: 'TEAM 8',
    members: ['Filippo Morelli', 'Giordana', 'Caramans', 'Ila Pap', 'Trevi'],
  },
  {
    id: 9,
    name: 'TEAM 9',
    members: ['Gori', 'Giada', 'Daiana', 'Marchino Pref', 'Ciocia'],
  },
]

export const participants = teams.flatMap((team) => team.members)