-- Classifica e storico delle missioni completate. Eseguire con: npm run test:db
begin;
select no_plan();

create temp table ctx as
select
  (select id from public.missions where proof_type = 'none' and active order by id limit 1) as a_id,
  (select id from public.missions where proof_type = 'none' and active order by id offset 1 limit 1) as b_id;

-- team 1: due missioni, team 2: una, team 3: nessuna
insert into public.team_missions (team_id, mission_id, status, completed_at, points_awarded)
select 1, a_id, 'completed', now() - interval '3 minutes', 10 from ctx
union all select 2, a_id, 'completed', now() - interval '2 minutes', 25 from ctx
union all select 1, b_id, 'completed', now() - interval '1 minute', 20 from ctx;

select is((select count(*)::int from public.get_leaderboard()), 9, 'la classifica ha tutte le squadre');
select is(
  (select team_id from public.get_leaderboard() limit 1), 1,
  'prima in classifica la squadra con più punti (30)'
);
select is(
  (select score from public.get_leaderboard() where team_id = 1), 30,
  'punteggio = somma dei punti assegnati'
);
select is(
  (select "position" from public.get_leaderboard() where team_id = 2), 2,
  'seconda posizione'
);
select is(
  (select completed_missions from public.get_leaderboard() where team_id = 1), 2,
  'missioni completate della squadra 1'
);
select is(
  (select "position" from public.get_leaderboard() where team_id = 3),
  (select "position" from public.get_leaderboard() where team_id = 4),
  'squadre a 0 punti: stessa posizione'
);

-- pari punti: ordine per missioni completate
insert into public.team_missions (team_id, mission_id, status, completed_at, points_awarded)
select 5, a_id, 'completed', now(), 15 from ctx
union all select 5, b_id, 'completed', now(), 10 from ctx
union all select 6, a_id, 'completed', now(), 25 from ctx;

select is(
  (select array_agg(team_id order by ord) filter (where team_id in (2, 5, 6))
     from (select team_id, row_number() over () as ord from public.get_leaderboard()) x),
  array[5, 2, 6],
  'a pari punti (25): più missioni prima, poi chi ha completato prima'
);
select is(
  (select "position" from public.get_leaderboard() where team_id = 5),
  (select "position" from public.get_leaderboard() where team_id = 6),
  'a pari punti la posizione è condivisa'
);

-- storico
select is((select count(*)::int from public.get_completed_missions()), 6, 'feed globale: tutte le completate');
select is(
  (select count(*)::int from public.get_completed_missions(1)), 2,
  'storico di una squadra'
);
select is(
  (select points from public.get_completed_missions(1) limit 1), 20,
  'dalla più recente, con i punti'
);
select is(
  (select count(*)::int from public.get_completed_missions(null, 2)), 2,
  'il limite viene rispettato'
);
select is(
  (select count(*)::int from public.get_completed_missions(3)), 0,
  'squadra senza missioni: elenco vuoto'
);

-- anon può chiamarle
set local role anon;
select lives_ok($$ select * from public.get_leaderboard() $$, 'anon può leggere la classifica');
select lives_ok($$ select * from public.get_completed_missions() $$, 'anon può leggere lo storico');
reset role;

select * from finish();
rollback;
