const quote = (value) => `'${String(value).replace(/'/g, "''")}'`

// SQL che allinea la tabella missions a app/datas/missions.ts:
// inserisce le nuove, aggiorna quelle cambiate e disattiva quelle tolte dal file
// (non si cancellano: team_missions può già riferirle).
export function buildMissionsSql(missions) {
  const rows = missions
    .map(
      (m) =>
        `  (${m.id}, ${quote(m.title)}, ${quote(m.category)}, ${quote(m.text)}, ${quote(m.proofType)}, ${m.points}, ${m.requiresMarco}, ${m.active})`
    )
    .join(',\n')

  const ids = missions.map((m) => m.id).join(', ')

  return `-- Allinea le missioni a app/datas/missions.ts (generato da: npm run db:missions)

insert into public.missions (id, title, category, text, proof_type, points, requires_marco, active) values
${rows}
on conflict (id) do update set
  title          = excluded.title,
  category       = excluded.category,
  text           = excluded.text,
  proof_type     = excluded.proof_type,
  points         = excluded.points,
  requires_marco = excluded.requires_marco,
  active         = excluded.active;

-- missioni tolte dal file: disattivate, non cancellate
update public.missions set active = false where id <> all (array[${ids}]);
`
}
