-- Aree admin con PIN, pausa del gioco e azioni di Irene. Eseguire con: npm run test:db
begin;
select no_plan();

insert into public.admin_pins (role, pin_hash) values
  ('marco',     extensions.crypt('1111', extensions.gen_salt('bf'))),
  ('irenegade', extensions.crypt('9999', extensions.gen_salt('bf')))
on conflict (role) do update set pin_hash = excluded.pin_hash;

create temp table ctx as
select (select id from public.missions where proof_type = 'none' and active order by id limit 1) as none_id,
       (select points from public.missions where proof_type = 'none' and active order by id limit 1) as none_points;

-- ---------------------------------------------------------------- PIN

select is(public.admin_get_status('0000') ->> 'error', 'invalid_pin', 'PIN errato rifiutato');
select is(public.admin_get_status(null) ->> 'error', 'invalid_pin', 'PIN assente rifiutato');
select is((public.admin_get_status('1111') ->> 'ok')::boolean, true, 'PIN di Marco valido');
select is((public.admin_get_status('9999') ->> 'ok')::boolean, true, 'il PIN di Irene vale anche per le funzioni di Marco');
select is(public.admin_overview('1111') ->> 'error', 'forbidden', 'Marco non accede alle funzioni di Irene');
select is((public.admin_overview('9999') ->> 'ok')::boolean, true, 'Irene accede alla panoramica');
select is(
  jsonb_array_length(public.admin_overview('9999') -> 'data' -> 'teams'), 9,
  'la panoramica ha tutte le squadre'
);
select is(public.admin_cancel_completion('1111', 1, 1) ->> 'error', 'forbidden', 'Marco non può annullare missioni');
select is(public.admin_reset_game('1111', 'RESET') ->> 'error', 'forbidden', 'Marco non può azzerare il gioco');

-- ---------------------------------------------------------------- permessi sulle tabelle

set local role anon;
select throws_ok($$ select * from public.admin_pins $$, '42501', null, 'anon non legge i PIN');
select throws_ok($$ select * from public.admin_log $$, '42501', null, 'anon non legge il registro');
select throws_ok($$ select * from public.game_settings $$, '42501', null, 'anon non legge le impostazioni direttamente');
select throws_ok($$ update public.game_settings set play_enabled = false $$, '42501', null, 'anon non può fermare il gioco da solo');
select lives_ok($$ select public.get_game_status() $$, 'anon può leggere lo stato di pausa');
select is((public.admin_get_status('1111') ->> 'ok')::boolean, true, 'le funzioni admin sono chiamabili da anon col PIN giusto');
reset role;

-- ---------------------------------------------------------------- pausa del gioco

select is(
  public.get_game_status(), '{"missionsEnabled": true, "playEnabled": true}'::jsonb,
  'di default tutto è attivo'
);

select public.draw_mission(2);  -- squadra 2 ha una missione attiva

select is(
  public.admin_set_game('1111', false, true) -> 'data', '{"missionsEnabled": false, "playEnabled": true}'::jsonb,
  'Marco ferma le nuove missioni'
);
select throws_ok($$ select public.draw_mission(1) $$, '55000', 'missions_paused', 'con le missioni ferme draw_mission è rifiutata');
select throws_ok(
  format('select public.skip_mission(2, %s)', (select mission_id from public.team_missions where team_id = 2 and status = 'active')),
  '55000', 'missions_paused',
  'con le missioni ferme non si può saltare (e quindi riceverne una nuova)'
);
select is(
  (select count(*)::int from public.team_missions where team_id = 2 and status = 'active'), 1,
  'il salto rifiutato non ha cambiato la missione attiva'
);

select public.admin_set_game('1111', true, false);
select throws_ok($$ select public.draw_mission(1) $$, '55000', 'game_paused', 'con il gioco fermo draw_mission è rifiutata');
select throws_ok(
  format('select public.complete_mission(2, %s, ''x'', ''team-2/x.jpg'')', (select mission_id from public.team_missions where team_id = 2 and status = 'active')),
  '55000', 'game_paused',
  'con il gioco fermo non si completa nulla'
);

-- Irene può muovere le squadre anche in pausa
select is(
  (public.admin_assign_mission('9999', 3, (select none_id from ctx)) ->> 'ok')::boolean, true,
  'Irene assegna una missione anche con il gioco fermo'
);

select public.admin_set_game('1111', true, true);
select lives_ok($$ select public.draw_mission(1) $$, 'riavviato il gioco, draw_mission funziona');

-- ---------------------------------------------------------------- annullo, correzioni, sblocco

select public.complete_mission(3, (select none_id from ctx));
select is(
  ((public.get_team_state(3)) ->> 'score')::int, (select none_points from ctx),
  'squadra 3: punti dalla missione completata'
);

select is(
  (public.admin_adjust_points('9999', 3, 5, 'bonus foto') ->> 'ok')::boolean, true,
  'Irene aggiunge punti'
);
select is(
  ((public.get_team_state(3)) ->> 'score')::int, (select none_points from ctx) + 5,
  'la correzione entra nel punteggio'
);
select is(
  (select score from public.get_leaderboard() where team_id = 3), (select none_points from ctx) + 5,
  'e nella classifica'
);
select is(public.admin_adjust_points('9999', 3, 0, 'x') ->> 'error', 'invalid_adjustment', 'correzione a 0 rifiutata');
select is(public.admin_adjust_points('9999', 3, 5, '   ') ->> 'error', 'invalid_adjustment', 'correzione senza motivo rifiutata');

select is(
  (public.admin_cancel_completion('9999', 3, (select none_id from ctx)) ->> 'ok')::boolean, true,
  'Irene annulla la missione completata'
);
select is(
  ((public.get_team_state(3)) ->> 'score')::int, 5,
  'restano solo le correzioni di punti'
);
select is(
  jsonb_array_length((public.get_team_state(3)) -> 'completedMissionIds'), 0,
  'la missione non risulta più completata'
);
select is(
  (select count(*)::int from public.team_missions where team_id = 3 and mission_id = (select none_id from ctx)),
  0,
  'la missione annullata torna disponibile (riga rimossa)'
);
select is(
  public.admin_cancel_completion('9999', 3, (select none_id from ctx)) ->> 'error', 'not_completed',
  'annullare una missione non completata: errore'
);
select ok(
  exists (select 1 from public.admin_log where action = 'cancel_completion'),
  'l''annullo è nel registro'
);

-- assegnazione: una completata non si riassegna, una scartata si riattiva
select public.admin_assign_mission('9999', 3, (select none_id from ctx));
select public.complete_mission(3, (select none_id from ctx));
select is(
  public.admin_assign_mission('9999', 3, (select none_id from ctx)) ->> 'error', 'already_completed',
  'non si riassegna una missione già completata'
);
select is(public.admin_assign_mission('9999', 3, 99999) ->> 'error', 'mission_not_found', 'missione inesistente');

-- sblocco
select public.draw_mission(4);
create temp table before_unblock as
  select mission_id as id from public.team_missions where team_id = 4 and status = 'active';
select is(
  (public.admin_unblock_team('9999', 4) ->> 'ok')::boolean, true,
  'Irene sblocca la squadra 4'
);
select is(
  (select count(*)::int from public.team_missions where team_id = 4 and status = 'active'), 1,
  'dopo lo sblocco c''è una sola missione attiva'
);
select isnt(
  (select mission_id from public.team_missions where team_id = 4 and status = 'active'),
  (select id from before_unblock),
  'ed è diversa da quella che bloccava la squadra'
);
select is(
  (select count(*)::int from public.team_missions where team_id = 4 and status = 'skipped'), 0,
  'la missione tolta non conta come scartata'
);
select public.admin_set_game('1111', false, false);
select is(
  (public.admin_unblock_team('9999', 4) ->> 'ok')::boolean, true,
  'lo sblocco funziona anche con il gioco fermo'
);
select public.admin_set_game('1111', true, true);

-- ---------------------------------------------------------------- reset

select public.admin_adjust_points('9999', 4, 3, 'test');
select is(
  (public.admin_reset_team('9999', 4) ->> 'ok')::boolean, true, 'Irene azzera la squadra 4'
);
select is(
  (select count(*)::int from public.team_missions where team_id = 4), 0, 'azzerata: nessuna missione'
);
select is(((public.get_team_state(4)) ->> 'score')::int, 0, 'azzerata: nessuna correzione di punti');

select is(public.admin_reset_game('9999', 'reset') ->> 'error', 'confirmation_required', 'serve scrivere RESET');
select is(public.admin_reset_game('9999', null) ->> 'error', 'confirmation_required', 'conferma assente rifiutata');
select is((public.admin_reset_game('9999', 'RESET') ->> 'ok')::boolean, true, 'reset completo con la conferma giusta');
select is((select count(*)::int from public.team_missions), 0, 'dopo il reset non resta nessuna missione');
select is((select count(*)::int from public.point_adjustments), 0, 'né correzioni di punti');
select ok(
  (select count(*) from public.admin_log where action = 'reset_game') = 1,
  'il reset è nel registro (il registro non viene cancellato)'
);

-- ---------------------------------------------------------------- download delle foto (header x-admin-pin)

insert into storage.objects (bucket_id, name) values ('proofs', 'team-1/a.jpg');

set local role anon;
select set_config('request.headers', '{"x-admin-pin": "1111"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 1, 'con il PIN di Marco si vedono i file');
select set_config('request.headers', '{"x-admin-pin": "0000"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 0, 'con un PIN errato no');
select set_config('request.headers', '{}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 0, 'senza PIN no');
reset role;

select is(
  (select file_size_limit from storage.buckets where id = 'proofs'), 20971520::bigint,
  'limite del bucket: 20 MB'
);

-- ---------------------------------------------------------------- blocco dei tentativi (sempre per ultimo)

select public.admin_get_status('x' || g) from generate_series(1, 10) g;
select is(
  public.admin_get_status('1111') ->> 'error', 'locked',
  'dopo troppi PIN errati anche quello giusto è bloccato'
);

select * from finish();
rollback;
