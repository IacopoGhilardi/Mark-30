-- Salto delle missioni. Eseguire con: npm run test:db
begin;
select no_plan();

-- tre sole missioni disponibili: A, B, C
create temp table ctx as
select array_agg(id order by id) as ids
  from (select id from public.missions where active order by id limit 3) x;

update public.missions set active = false where id <> all ((select ids from ctx));

-- ---------------------------------------------------------------- skip con missioni nuove

select public.draw_mission(1);
create temp table first_pick as
  select mission_id as id from public.team_missions where team_id = 1 and status = 'active';

select lives_ok(
  format('select public.skip_mission(1, %s)', (select id from first_pick)),
  'skip_mission funziona'
);
select is(
  (select status from public.team_missions
    where team_id = 1 and mission_id = (select id from first_pick)),
  'skipped',
  'la missione saltata risulta skipped'
);
select isnt(
  (select mission_id from public.team_missions where team_id = 1 and status = 'active'),
  (select id from first_pick),
  'dopo il salto la squadra riceve una missione diversa'
);
select is(
  (select count(*)::int from public.team_missions where team_id = 1 and status = 'active'),
  1,
  'una sola missione attiva dopo il salto'
);
select is(
  ((public.get_team_state(1))->>'score')::int, 0,
  'saltare non assegna punti'
);

-- doppio tocco (telefono in ritardo): non salta anche la nuova missione
create temp table second_pick as
  select mission_id as id from public.team_missions where team_id = 1 and status = 'active';

select lives_ok(
  format('select public.skip_mission(1, %s)', (select id from first_pick)),
  'saltare di nuovo la vecchia missione non dà errore'
);
select is(
  (select mission_id from public.team_missions where team_id = 1 and status = 'active'),
  (select id from second_pick),
  'e non cambia la missione attiva (idempotente)'
);

-- ---------------------------------------------------------------- finite le nuove

select public.skip_mission(1, (select id from second_pick));  -- riceve la terza (ultima nuova)
select is(
  ((public.get_team_state(1))->>'freshRemaining')::int, 0,
  'le missioni nuove sono finite'
);

create temp table third_pick as
  select mission_id as id from public.team_missions where team_id = 1 and status = 'active';

select is(
  (public.redraw_skipped_mission(1))->'activeMission'->>'id',
  (select id::text from third_pick),
  'redraw con una missione già attiva restituisce lo stato senza cambiarla'
);

select public.skip_mission(1, (select id from third_pick));  -- nessuna nuova: resta senza attiva

select is(
  (public.get_team_state(1))->'activeMission', 'null'::jsonb,
  'nessuna missione nuova: la squadra resta senza missione attiva'
);
select is(
  ((public.get_team_state(1))->>'canRedrawSkipped')::boolean, true,
  'può farsi riassegnare una missione scartata'
);
select is(
  jsonb_array_length((public.get_team_state(1))->'skippedMissions'), 3,
  'elenca le tre missioni scartate'
);
select is(
  (public.draw_mission(1))->'activeMission', 'null'::jsonb,
  'draw_mission non riassegna le scartate da sola'
);

-- la riestrazione casuale evita la missione appena scartata
select lives_ok($$ select public.redraw_skipped_mission(1) $$, 'redraw_skipped_mission funziona');
select isnt(
  (select mission_id from public.team_missions where team_id = 1 and status = 'active'),
  (select id from third_pick),
  'evita la missione appena scartata se ce ne sono altre'
);
select is(
  (select count(*)::int from public.team_missions where team_id = 1 and status = 'active'),
  1,
  'una sola attiva dopo la riestrazione'
);

-- ---------------------------------------------------------------- complete su scartata

select throws_ok(
  format(
    'select public.complete_mission(1, %s)',
    (select mission_id from public.team_missions where team_id = 1 and status = 'skipped' limit 1)
  ),
  '22023', 'mission_skipped',
  'una missione scartata non si può completare'
);

-- ---------------------------------------------------------------- scelta della missione

select public.skip_mission(1, (select mission_id from public.team_missions where team_id = 1 and status = 'active'));
select throws_ok(
  $$ select public.redraw_skipped_mission(1, 999) $$,
  'P0002', 'mission_not_skipped',
  'non si può scegliere una missione mai scartata'
);
select lives_ok(
  format('select public.redraw_skipped_mission(1, %s)', (select id from third_pick)),
  'la squadra può scegliere quale scartata riavere'
);
select is(
  (select mission_id from public.team_missions where team_id = 1 and status = 'active'),
  (select id from third_pick),
  'viene assegnata proprio quella scelta'
);

-- ---------------------------------------------------------------- riestrazione solo a nuove finite

select public.draw_mission(2);  -- squadra 2 ha ancora missioni nuove
select public.skip_mission(2, (select mission_id from public.team_missions where team_id = 2 and status = 'active'));
select is(
  ((public.get_team_state(2))->>'freshRemaining')::int, 1,
  'squadra 2: resta una missione nuova'
);
update public.team_missions set status = 'skipped', skipped_at = clock_timestamp()
 where team_id = 2 and status = 'active';
select throws_ok(
  $$ select public.redraw_skipped_mission(2) $$,
  '22023', 'fresh_available',
  'non si riestraggono le scartate finché ci sono missioni nuove'
);

-- ---------------------------------------------------------------- una completata non torna mai

select public.draw_mission(3);
select public.complete_mission(
  3,
  (select mission_id from public.team_missions where team_id = 3 and status = 'active'),
  'ok', 'team-3/x.jpg'
);
select public.draw_mission(3);
select public.skip_mission(3, (select mission_id from public.team_missions where team_id = 3 and status = 'active'));
select is(
  (select count(distinct mission_id)::int from public.team_missions where team_id = 3),
  count(*)::int,
  'nessuna missione assegnata due volte alla stessa squadra'
) from public.team_missions where team_id = 3;

-- ---------------------------------------------------------------- allDone

select public.draw_mission(4);
select public.complete_mission(
  4,
  (select mission_id from public.team_missions where team_id = 4 and status = 'active'),
  'ok', 'team-4/x.jpg'
);
select public.draw_mission(4);
select public.complete_mission(
  4,
  (select mission_id from public.team_missions where team_id = 4 and status = 'active'),
  'ok', 'team-4/x.jpg'
);
select public.draw_mission(4);
select public.complete_mission(
  4,
  (select mission_id from public.team_missions where team_id = 4 and status = 'active'),
  'ok', 'team-4/x.jpg'
);
select is(
  ((public.get_team_state(4))->>'allDone')::boolean, true,
  'tutte completate: allDone'
);

-- ---------------------------------------------------------------- permessi

set local role anon;
select lives_ok($$ select public.get_team_state(1) $$, 'anon può leggere lo stato');
select lives_ok($$ select public.skip_mission(1, 999) $$, 'anon può chiamare skip_mission');
reset role;

select * from finish();
rollback;
