-- Controlli di sicurezza richiesti dall'advisor di Supabase. Eseguire con: npm run test:db
begin;
select no_plan();

select hasnt_view('public', 'team_scores', 'la view team_scores (SECURITY DEFINER) non esiste più');

-- nessuna view in public deve girare con i permessi del proprietario
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any (c.reloptions), false)),
  0,
  'nessuna view in public è SECURITY DEFINER'
);

-- tutte le tabelle in public hanno la RLS attiva
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'tutte le tabelle in public hanno la RLS attiva'
);

-- le funzioni interne non sono chiamabili dal browser
set local role anon;
select throws_ok($$ select public._team_score(1) $$, '42501', null, 'anon non può chiamare _team_score');
select throws_ok($$ select public._admin_auth('1111') $$, '42501', null, 'anon non può chiamare _admin_auth');
select throws_ok($$ select public._admin_log('x', 'y') $$, '42501', null, 'anon non può chiamare _admin_log');
reset role;

-- la classifica pubblica resta disponibile
set local role anon;
select lives_ok($$ select * from public.get_leaderboard() $$, 'anon legge la classifica da get_leaderboard');
reset role;

select * from finish();
rollback;
