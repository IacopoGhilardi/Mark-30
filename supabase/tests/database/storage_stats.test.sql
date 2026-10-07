-- Statistiche di spazio per la pagina admin. Eseguire con: npm run test:db
begin;
select no_plan();

insert into public.admin_pins (role, pin_hash) values
  ('marco',     extensions.crypt('1111', extensions.gen_salt('bf'))),
  ('irenegade', extensions.crypt('9999', extensions.gen_salt('bf')))
on conflict (role) do update set pin_hash = excluded.pin_hash;

-- file: 2 foto (team 1), 1 video (team 2), 1 foto orfana (team 2)
insert into storage.objects (bucket_id, name, metadata) values
  ('proofs', 'team-1/a.jpg', '{"size": 1000, "mimetype": "image/jpeg"}'),
  ('proofs', 'team-1/b.jpg', '{"size": 2000, "mimetype": "image/jpeg"}'),
  ('proofs', 'team-2/v.mp4', '{"size": 7000, "mimetype": "video/mp4"}'),
  ('proofs', 'team-2/orfana.jpg', '{"size": 500, "mimetype": "image/jpeg"}');

-- missioni completate collegate ai primi tre file
insert into public.team_missions (team_id, mission_id, status, completed_at, points_awarded, proof_path)
select 1, (select id from public.missions order by id offset 0 limit 1), 'completed', now(), 5, 'team-1/a.jpg'
union all select 1, (select id from public.missions order by id offset 1 limit 1), 'completed', now(), 5, 'team-1/b.jpg'
union all select 2, (select id from public.missions order by id offset 2 limit 1), 'completed', now(), 5, 'team-2/v.mp4';

update public.game_settings set storage_limit_bytes = 100000;

select is(public.admin_storage_stats('1111') ->> 'error', 'forbidden', 'Marco non vede le statistiche di spazio');
select is(public.admin_storage_stats('0000') ->> 'error', 'invalid_pin', 'PIN errato rifiutato');

create temp table stats as select public.admin_storage_stats('9999') -> 'data' as d;

select is((select (d ->> 'usedBytes')::bigint from stats), 10500::bigint, 'totale: somma delle dimensioni');
select is((select (d ->> 'fileCount')::int from stats), 4, 'numero di file');
select is((select (d ->> 'limitBytes')::bigint from stats), 100000::bigint, 'limite dalle impostazioni');
select is((select (d ->> 'percent')::numeric from stats), 10.5, 'percentuale usata');
select is((select d ->> 'level' from stats), 'ok', 'sotto il 70%: ok');
select is((select (d -> 'images' ->> 'count')::int from stats), 3, 'foto: numero');
select is((select (d -> 'images' ->> 'bytes')::bigint from stats), 3500::bigint, 'foto: byte');
select is((select (d -> 'videos' ->> 'count')::int from stats), 1, 'video: numero');
select is((select (d -> 'videos' ->> 'bytes')::bigint from stats), 7000::bigint, 'video: byte');
select is((select (d -> 'orphans' ->> 'count')::int from stats), 1, 'file orfani: numero');
select is((select (d -> 'orphans' ->> 'bytes')::bigint from stats), 500::bigint, 'file orfani: byte');
select is(
  (select (e ->> 'bytes')::bigint from stats, jsonb_array_elements(d -> 'perTeam') e where (e ->> 'teamId')::int = 1),
  3000::bigint, 'per squadra: team 1'
);
select is(
  (select (e ->> 'bytes')::bigint from stats, jsonb_array_elements(d -> 'perTeam') e where (e ->> 'teamId')::int = 2),
  7500::bigint, 'per squadra: team 2 (video + orfana)'
);
select ok((select (d -> 'database' ->> 'usedBytes')::bigint > 0 from stats), 'dimensione del database');

-- soglie di avviso
update public.game_settings set storage_limit_bytes = 14000;   -- 75%
select is((public.admin_storage_stats('9999') -> 'data' ->> 'level'), 'warning', 'dal 70%: warning');
update public.game_settings set storage_limit_bytes = 11000;   -- ~95%
select is((public.admin_storage_stats('9999') -> 'data' ->> 'level'), 'critical', 'dal 90%: critical');
update public.game_settings set storage_limit_bytes = 10000;   -- oltre il 100%
select is((public.admin_storage_stats('9999') -> 'data' ->> 'level'), 'critical', 'oltre il limite: critical');

-- dimensione dei file nell'elenco per l'esportazione
select is(
  (select (e ->> 'sizeBytes')::bigint
     from jsonb_array_elements(public.admin_list_proofs('1111') -> 'data') e
    where e ->> 'proofPath' = 'team-1/b.jpg'),
  2000::bigint,
  'admin_list_proofs include la dimensione del file'
);

-- anon non legge i metadati direttamente
set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'proofs'), 0, 'anon non vede i file');
reset role;

select * from finish();
rollback;
