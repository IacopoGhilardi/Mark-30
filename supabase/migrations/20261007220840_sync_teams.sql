-- Allinea le squadre a app/datas/teams.ts (generato da: npm run db:teams)

insert into public.teams (id, name, members) values
  (1, 'TEAM 1', array['Seppia', 'Bata', 'Claudia', 'Nedo', 'Scavo']::text[]),
  (2, 'TEAM 2', array['Bartolomei', 'Carmen', 'Nico', 'Aras', 'Andre Grossi']::text[]),
  (3, 'TEAM 3', array['Fede Stella', 'Vittoria', 'Bianu', 'marzu', 'Federico Filipp']::text[]),
  (4, 'TEAM 4', array['Pasqui', 'Asia Rinzi', 'Ghila', 'Giulia Carni', 'Semi']::text[]),
  (5, 'TEAM 5', array['Confo', 'Kevin', 'Pozza', 'Azzu', 'Cloe']::text[]),
  (6, 'TEAM 6', array['Biancone', 'Gianlu', 'Asia', 'Greta', 'Filippo']::text[]),
  (7, 'TEAM 7', array['Santamaria', 'Elisa', 'Ire', 'Lupetta', 'Giacomino']::text[]),
  (8, 'TEAM 8', array['Filippo Morelli', 'Giordana', 'Caramans', 'Ila Pap', 'Trevi']::text[]),
  (9, 'TEAM 9', array['Gori', 'Giada', 'Daiana', 'Marchino Pref', 'Ciocia']::text[])
on conflict (id) do update set
  name    = excluded.name,
  members = excluded.members;

-- squadre tolte dal file: eliminate solo se non hanno missioni né correzioni di punti
delete from public.teams t
 where t.id <> all (array[1, 2, 3, 4, 5, 6, 7, 8, 9])
   and not exists (select 1 from public.team_missions tm where tm.team_id = t.id)
   and not exists (select 1 from public.point_adjustments pa where pa.team_id = t.id);
