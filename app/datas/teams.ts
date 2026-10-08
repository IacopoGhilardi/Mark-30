export type Team = {
  id: number
  name: string
  members: string[]
}

export const teams: Team[] = [
  {
    id: 1,
    name: 'GLI IMBUCATI',
    members: ['Seppia', 'Bata', 'Claudia', 'Nedo', 'Scavo'],
  },
  {
    id: 2,
    name: 'I SOSPETTI',
    members: ['Bartolomei', 'Carmen', 'Nico', 'Aras', 'Andre Grossi'],
  },
  {
    id: 3,
    name: 'I DIGIUNI',
    members: ['Fede Stella', 'Vittoria', 'Bianu', 'marzu', 'Federico Filipp'],
  },
  {
    id: 4,
    name: 'LOS CLANDESTINOS',
    members: ['Pasqui', 'Asia Rinzi', 'Ghila', 'Giulia Carni', 'Seminara'],
  },
  {
    id: 5,
    name: 'DRAMA TEAM',
    members: ['Confo', 'Kevin', 'Pozza', 'Azzu', 'Cloe'],
  },
  {
    id: 6,
    name: 'TEAM SOLITI NOTI',
    members: ['Biancone', 'Gianlu', 'Asia', 'Greta', 'Filippo'],
  },
  {
    id: 7,
    name: 'PACCARI TEAM',
    members: ['Santamaria', 'Elisa', 'Ire', 'Lupetta', 'Giacomino'],
  },
  {
    id: 8,
    name: 'TEAM SGAMATI',
    members: ['Filippo Morelli', 'Giordana', 'Caramans', 'Ila Pap', 'Trevi'],
  },
  {
    id: 9,
    name: 'LE RISERVE',
    members: ['Gori', 'Giada', 'Daiana', 'Marchino Pref', 'Ciocia'],
  },
]

export const participants = teams.flatMap((team) => team.members)