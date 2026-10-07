-- Statistiche di spazio per la pagina admin di Irene.
-- La dimensione dei file è già in storage.objects (metadata->>'size'): non serve salvarla.

-- limite di Storage da confrontare (1 GiB sul piano gratuito); modificabile dal SQL editor
alter table public.game_settings
  add column storage_limit_bytes bigint not null default 1073741824;

-- Stato dello spazio: totale, per tipo, per squadra, file orfani (caricati ma non
-- collegati a nessuna missione completata) e dimensione del database.
-- level: ok < 70% <= warning < 90% <= critical
create function public.admin_storage_stats(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth    jsonb := public._admin_auth(p_pin, 'irenegade');
  v_limit   bigint;
  v_used    bigint;
  v_files   int;
  v_percent numeric;
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  select storage_limit_bytes into v_limit from game_settings where id = 1;

  select coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0)::bigint, count(*)::int
    into v_used, v_files
    from storage.objects
   where bucket_id = 'proofs';

  v_percent := round(100.0 * v_used / nullif(v_limit, 0), 1);

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'limitBytes', v_limit,
    'usedBytes', v_used,
    'fileCount', v_files,
    'percent', coalesce(v_percent, 0),
    'level', case
      when coalesce(v_percent, 0) >= 90 then 'critical'
      when coalesce(v_percent, 0) >= 70 then 'warning'
      else 'ok'
    end,
    'images', (
      select jsonb_build_object('count', count(*), 'bytes', coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0))
        from storage.objects where bucket_id = 'proofs' and metadata ->> 'mimetype' like 'image/%'
    ),
    'videos', (
      select jsonb_build_object('count', count(*), 'bytes', coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0))
        from storage.objects where bucket_id = 'proofs' and metadata ->> 'mimetype' like 'video/%'
    ),
    'orphans', (
      select jsonb_build_object('count', count(*), 'bytes', coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0))
        from storage.objects o
       where o.bucket_id = 'proofs'
         and not exists (select 1 from team_missions tm where tm.proof_path = o.name)
    ),
    'perTeam', coalesce((
      select jsonb_agg(jsonb_build_object('teamId', team_id, 'count', n, 'bytes', bytes) order by team_id)
        from (
          select substring(name from '^team-([0-9]+)/')::int as team_id,
                 count(*) as n,
                 sum(coalesce((metadata ->> 'size')::bigint, 0)) as bytes
            from storage.objects
           where bucket_id = 'proofs' and name ~ '^team-[0-9]+/'
           group by 1
        ) x
    ), '[]'::jsonb),
    'database', jsonb_build_object(
      'usedBytes', pg_database_size(current_database()),
      'limitBytes', 524288000
    )
  ));
end;
$$;

-- Elenco per l'esportazione: ora con la dimensione di ogni file.
create or replace function public.admin_list_proofs(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth jsonb := public._admin_auth(p_pin);
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', tm.id,
             'teamId', tm.team_id,
             'teamName', t.name,
             'missionId', m.id,
             'title', m.title,
             'category', m.category,
             'points', tm.points_awarded,
             'completedAt', tm.completed_at,
             'proofText', tm.proof_text,
             'proofPath', tm.proof_path,
             'sizeBytes', (o.metadata ->> 'size')::bigint
           ) order by tm.team_id, tm.completed_at)
      from team_missions tm
      join teams t on t.id = tm.team_id
      join missions m on m.id = tm.mission_id
      left join storage.objects o on o.bucket_id = 'proofs' and o.name = tm.proof_path
     where tm.status = 'completed'
  ), '[]'::jsonb));
end;
$$;

revoke execute on function public.admin_storage_stats(text) from public;
grant execute on function public.admin_storage_stats(text) to anon, authenticated;
