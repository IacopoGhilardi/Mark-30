-- Area admin / esportazione. Eseguire con: npm run test:db
begin;
select no_plan();

insert into public.admins (email) values ('admin@test.dev');

insert into public.team_missions (team_id, mission_id, status, completed_at, points_awarded, proof_path)
values (1, (select id from public.missions order by id limit 1), 'completed', now(), 10, 'team-1/a.jpg');

insert into storage.objects (bucket_id, name) values ('proofs', 'team-1/a.jpg');

select is(
  (select file_size_limit from storage.buckets where id = 'proofs'), 20971520::bigint,
  'limite del bucket: 20 MB'
);

-- anon: nessun accesso
set local role anon;
select throws_ok($$ select * from public.admin_list_proofs() $$, '42501', null, 'anon non può chiamare admin_list_proofs');
select throws_ok($$ select * from public.admins $$, '42501', null, 'anon non può leggere admins');
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 0, 'anon non vede i file delle prove');
reset role;

-- utente autenticato ma non admin
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"altro@test.dev"}', true);
select is(public.is_admin(), false, 'un utente qualsiasi non è admin');
select throws_ok($$ select * from public.admin_list_proofs() $$, '42501', 'forbidden', 'un non-admin riceve forbidden');
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 0, 'un non-admin non vede i file');
reset role;

-- admin
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"ADMIN@test.dev"}', true);
select is(public.is_admin(), true, 'l''admin è riconosciuto (email case-insensitive)');
select is((select count(*)::int from public.admin_list_proofs()), 1, 'l''admin vede le completion');
select is((select proof_path from public.admin_list_proofs()), 'team-1/a.jpg', 'con il percorso della prova');
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 1, 'l''admin vede i file del bucket');
reset role;

select * from finish();
rollback;
