-- Test delle regole di gioco nel DB. Eseguire con: npm run test:db
-- Tutto gira in una transazione che viene annullata a fine test.
begin;
select no_plan();

-- missioni di riferimento per tipo di prova
create temp table ctx as
select
  (select id from public.missions where proof_type = 'photo' and active order by id limit 1) as photo_id,
  (select points from public.missions where proof_type = 'photo' and active order by id limit 1) as photo_points,
  (select id from public.missions where proof_type = 'text' and active order by id limit 1) as text_id,
  (select points from public.missions where proof_type = 'text' and active order by id limit 1) as text_points,
  (select id from public.missions where proof_type = 'none' and active order by id limit 1) as none_id,
  (select points from public.missions where proof_type = 'none' and active order by id limit 1) as none_points;

-- ------------------------------------------------------------ seed

select is((select count(*)::int from public.teams), 9, 'ci sono 9 squadre');
select ok((select count(*) from public.missions) >= 1, 'le missioni sono caricate');

-- ------------------------------------------------------------ stato iniziale

select is(
  (public.get_team_state(2))->>'step', 'ready',
  'una squadra nuova è in stato ready'
);
select is(
  ((public.get_team_state(2))->>'score')::int, 0,
  'una squadra nuova ha 0 punti'
);
select is(
  ((public.get_team_state(2))->>'missionNumber')::int, 1,
  'la prima missione è la numero 1'
);
select throws_ok(
  $$ select public.get_team_state(999) $$,
  'P0002', 'team_not_found',
  'squadra inesistente: errore'
);

-- ------------------------------------------------------------ draw_mission

select isnt(
  (public.draw_mission(3))->'activeMission', 'null'::jsonb,
  'draw_mission assegna una missione'
);
select is(
  (public.draw_mission(3))->'activeMission'->>'id',
  (public.draw_mission(3))->'activeMission'->>'id',
  'draw_mission ripetuta restituisce la stessa missione (idempotente)'
);
select is(
  (select count(*)::int from public.team_missions where team_id = 3 and status = 'active'),
  1,
  'esiste una sola missione attiva per squadra'
);
select throws_ok(
  $$ insert into public.team_missions (team_id, mission_id)
     select 3, id from public.missions
      where id <> (select mission_id from public.team_missions where team_id = 3)
      limit 1 $$,
  '23505', null,
  'il DB rifiuta una seconda missione attiva per la stessa squadra'
);
select throws_ok(
  $$ select public.draw_mission(999) $$,
  'P0002', 'team_not_found',
  'draw_mission su squadra inesistente: errore'
);

-- ------------------------------------------------------------ complete_mission (foto)

insert into public.team_missions (team_id, mission_id)
select 1, photo_id from ctx;

select throws_ok(
  format($$ select public.complete_mission(1, %s) $$, (select photo_id from ctx)),
  '22023', 'proof_required',
  'missione photo senza file: rifiutata'
);
select throws_ok(
  format($$ select public.complete_mission(1, %s, null, 'team-2/x.jpg') $$, (select photo_id from ctx)),
  '22023', 'invalid_proof_path',
  'percorso della prova di un''altra squadra: rifiutato'
);
select throws_ok(
  format($$ select public.complete_mission(1, %s) $$, (select none_id from ctx)),
  'P0002', 'mission_not_assigned',
  'missione non assegnata alla squadra: rifiutata'
);
select lives_ok(
  format($$ select public.complete_mission(1, %s, null, 'team-1/foto.jpg') $$, (select photo_id from ctx)),
  'missione photo con file: completata'
);
select is(
  ((public.get_team_state(1))->>'score')::int, (select photo_points from ctx),
  'i punti arrivano dalla missione'
);
select lives_ok(
  format($$ select public.complete_mission(1, %s, null, 'team-1/foto.jpg') $$, (select photo_id from ctx)),
  'secondo invio: nessun errore'
);
select is(
  ((public.get_team_state(1))->>'score')::int, (select photo_points from ctx),
  'secondo invio: i punti non si raddoppiano (idempotente)'
);
select is(
  (select count(*)::int from public.team_missions where team_id = 1 and status = 'completed'),
  1,
  'una sola completion registrata'
);
select is(
  (select proof_path from public.team_missions where team_id = 1),
  'team-1/foto.jpg',
  'il percorso della prova è salvato'
);
select is(
  (public.get_team_state(1))->>'step', 'ready',
  'dopo il completamento la squadra torna in ready'
);

-- ------------------------------------------------------------ complete_mission (testo)

insert into public.team_missions (team_id, mission_id)
select 4, text_id from ctx;

select throws_ok(
  format($$ select public.complete_mission(4, %s, '   ') $$, (select text_id from ctx)),
  '22023', 'proof_required',
  'missione text con testo vuoto: rifiutata'
);
select lives_ok(
  format($$ select public.complete_mission(4, %s, 'ciao Marco') $$, (select text_id from ctx)),
  'missione text con testo: completata'
);
select is(
  ((public.get_team_state(4))->>'score')::int, (select text_points from ctx),
  'punti assegnati per la missione text'
);

-- ------------------------------------------------------------ nessuna missione ripetuta

-- resta attiva solo la missione "none": la squadra 5 può riceverla una volta sola
update public.missions set active = false where id <> (select none_id from ctx);

select is(
  (public.draw_mission(5))->'activeMission'->>'id',
  (select none_id::text from ctx),
  'viene assegnata l''unica missione disponibile'
);
select lives_ok(
  format($$ select public.complete_mission(5, %s) $$, (select none_id from ctx)),
  'missione none: completata senza prova'
);
select is(
  (public.draw_mission(5))->'activeMission', 'null'::jsonb,
  'una missione completata non viene riassegnata'
);
select is(
  (public.get_team_state(5))->>'step', 'ready',
  'finite le missioni la squadra resta in ready'
);

-- ------------------------------------------------------------ classifica

select is((select count(*)::int from public.get_leaderboard()), 9, 'la classifica ha tutte le squadre');
select is(
  (select score from public.get_leaderboard() where team_id = 1), (select photo_points from ctx),
  'classifica: punteggio squadra 1'
);
select is(
  (select completed_missions from public.get_leaderboard() where team_id = 1), 1,
  'classifica: missioni completate squadra 1'
);
select is(
  (select score from public.get_leaderboard() where team_id = 2), 0,
  'classifica: squadra senza missioni a 0'
);
select ok(
  (select array_agg(score) from public.get_leaderboard())
    = (select array_agg(score order by score desc) from public.get_leaderboard()),
  'classifica ordinata per punteggio decrescente'
);

-- ------------------------------------------------------------ sicurezza (ruolo anon)

set local role anon;

select throws_ok(
  $$ select * from public.team_missions $$,
  '42501', null,
  'anon non può leggere team_missions'
);
select throws_ok(
  $$ insert into public.team_missions (team_id, mission_id) values (6, 1) $$,
  '42501', null,
  'anon non può inserire in team_missions'
);
select throws_ok(
  $$ update public.team_missions set points_awarded = 9999 $$,
  '42501', null,
  'anon non può modificare i punti'
);
select throws_ok(
  $$ select * from public.missions $$,
  '42501', null,
  'anon non può leggere le missioni'
);
select lives_ok(
  $$ select * from public.get_leaderboard() $$,
  'anon può leggere la classifica'
);
select lives_ok(
  $$ select * from public.teams $$,
  'anon può leggere le squadre'
);
select lives_ok(
  $$ select public.get_team_state(1) $$,
  'anon può chiamare get_team_state'
);

reset role;

select * from finish();
rollback;
