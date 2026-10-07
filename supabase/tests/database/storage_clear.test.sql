-- Eliminazione delle prove (reset prima della festa). Eseguire con: npm run test:db
begin;
select no_plan();

insert into public.admin_pins (role, pin_hash) values
  ('marco',     extensions.crypt('1111', extensions.gen_salt('bf'))),
  ('irenegade', extensions.crypt('9999', extensions.gen_salt('bf')))
on conflict (role) do update set pin_hash = excluded.pin_hash;

insert into storage.objects (bucket_id, name) values ('proofs', 'team-1/a.jpg'), ('proofs', 'team-2/b.jpg');

-- Supabase vieta di cancellare da SQL (bisogna usare la Storage API). Qui sblocchiamo
-- la protezione solo per verificare le policy: l'eliminazione vera passa dall'API.
select set_config('storage.allow_delete_query', 'true', true);

-- nessuno oltre Irene può eliminare
set local role anon;
select set_config('request.headers', '{}', true);
delete from storage.objects where bucket_id = 'proofs';
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 0, 'senza PIN non si vede nulla');
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 2, 'senza PIN non si elimina');

set local role anon;
select set_config('request.headers', '{"x-admin-pin": "1111"}', true);
delete from storage.objects where bucket_id = 'proofs';
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 2, 'con il PIN di Marco si può leggere ma non eliminare');

set local role anon;
select set_config('request.headers', '{"x-admin-pin": "0000"}', true);
delete from storage.objects where bucket_id = 'proofs';
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 2, 'con un PIN errato non si elimina');

set local role anon;
select set_config('request.headers', '{"x-admin-pin": "9999"}', true);
delete from storage.objects where bucket_id = 'proofs' and name = 'team-1/a.jpg';
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 1, 'con il PIN di Irene si elimina');
select is((select name from storage.objects where bucket_id = 'proofs'), 'team-2/b.jpg', 'solo il file richiesto');

-- registro
select is((public.admin_log_event('9999', 'clear_proofs', '{"removed": 2}') ->> 'ok')::boolean, true, 'Irene registra lo svuotamento');
select is(public.admin_log_event('1111', 'clear_proofs', '{}') ->> 'error', 'forbidden', 'Marco non può scrivere nel registro');
select ok(exists (select 1 from public.admin_log where action = 'clear_proofs'), 'il registro contiene l''azione');

select * from finish();
rollback;
