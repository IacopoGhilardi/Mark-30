const quote = (value) => `'${String(value).replace(/'/g, "''")}'`

// SQL che allinea la tabella teams a app/datas/teams.ts: inserisce le nuove squadre,
// aggiorna nome e componenti di quelle cambiate e toglie quelle sparite dal file,
// ma solo se non hanno ancora giocato (le altre restano, per non perdere la loro storia).
export function buildTeamsSql(teams) {
  const rows = teams
    .map((team) => `  (${team.id}, ${quote(team.name)}, array[${team.members.map(quote).join(', ')}]::text[])`)
    .join(',\n')

  const ids = teams.map((team) => team.id).join(', ')

  return `-- Allinea le squadre a app/datas/teams.ts (generato da: npm run db:teams)

insert into public.teams (id, name, members) values
${rows}
on conflict (id) do update set
  name    = excluded.name,
  members = excluded.members;

-- squadre tolte dal file: eliminate solo se non hanno missioni né correzioni di punti
delete from public.teams t
 where t.id <> all (array[${ids}])
   and not exists (select 1 from public.team_missions tm where tm.team_id = t.id)
   and not exists (select 1 from public.point_adjustments pa where pa.team_id = t.id);
`
}
