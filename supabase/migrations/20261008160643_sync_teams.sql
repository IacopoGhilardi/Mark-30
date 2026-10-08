-- Allinea le squadre a app/datas/teams.ts (generato da: npm run db:teams)

insert into public.teams (id, name, members) values
  (1, 'GLI IMBUCATI', array['Seppia', 'Bata', 'Claudia', 'Nedo', 'Scavo']::text[]),
  (2, 'I SOSPETTI', array['Bartolomei', 'Carmen', 'Nico', 'Aras', 'Andre Grossi']::text[]),
  (3, 'I DIGIUNI', array['Fede Stella', 'Vittoria', 'Bianu', 'marzu', 'Federico Filipp']::text[]),
  (4, 'LOS CLANDESTINOS', array['Pasqui', 'Asia Rinzi', 'Ghila', 'Giulia Carni', 'Seminara']::text[]),
  (5, 'DRAMA TEAM', array['Confo', 'Kevin', 'Pozza', 'Azzu', 'Brian']::text[]),
  (6, 'TEAM SOLITI NOTI', array['Biancone', 'Gianlu', 'Asia', 'Greta', 'Cloe']::text[]),
  (7, 'PACCARI TEAM', array['Santamaria', 'Elisa', 'Ire', 'Lupetta', 'Giacomino']::text[]),
  (8, 'TEAM SGAMATI', array['Filippo Morelli', 'Giordana', 'Caramans', 'Ila Pap', 'Trevi']::text[]),
  (9, 'LE RISERVE', array['Gori', 'Giada', 'Daiana', 'Marchino Pref', 'Ciocia']::text[])
on conflict (id) do update set
  name    = excluded.name,
  members = excluded.members;

-- squadre tolte dal file: eliminate solo se non hanno missioni né correzioni di punti
delete from public.teams t
 where t.id <> all (array[1, 2, 3, 4, 5, 6, 7, 8, 9])
   and not exists (select 1 from public.team_missions tm where tm.team_id = t.id)
   and not exists (select 1 from public.point_adjustments pa where pa.team_id = t.id);
