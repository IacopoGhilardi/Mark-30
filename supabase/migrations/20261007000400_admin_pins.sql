-- Aree admin protette da PIN, verificato dal database (mai nel frontend).
--   marco     -> /mark30/admin     : pausa del gioco + esportazione delle foto
--   irenegade -> /irenegade/admin  : tutto quello di marco + gestione completa
-- Il PIN di irenegade vale anche per le funzioni di marco.
--
-- Imposta i PIN dal SQL editor (mai nel codice):
--   insert into public.admin_pins (role, pin_hash) values
--     ('marco',     extensions.crypt('PIN_DI_MARCO',     extensions.gen_salt('bf'))),
--     ('irenegade', extensions.crypt('PIN_DI_IRENEGADE', extensions.gen_salt('bf')))
--   on conflict (role) do update set pin_hash = excluded.pin_hash;

create extension if not exists pgcrypto with schema extensions;

-- sostituisce l'accesso admin con Supabase Auth della migration precedente
drop policy if exists "proofs admin read" on storage.objects;
drop function if exists public.admin_list_proofs();
drop function if exists public.is_admin();
drop table if exists public.admins;

-- ---------------------------------------------------------------- tabelle

create table public.admin_pins (
  role     text primary key check (role in ('marco', 'irenegade')),
  pin_hash text not null
);

create table public.admin_attempts (
  id           bigint generated always as identity primary key,
  client       text not null,
  attempted_at timestamptz not null default clock_timestamp()
);
create index admin_attempts_client_idx on public.admin_attempts (client, attempted_at);

create table public.game_settings (
  id               int primary key default 1 check (id = 1),
  missions_enabled boolean not null default true,
  play_enabled     boolean not null default true,
  updated_at       timestamptz not null default now()
);
insert into public.game_settings default values;

create table public.point_adjustments (
  id         uuid primary key default gen_random_uuid(),
  team_id    int not null references public.teams (id),
  delta      int not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

create table public.admin_log (
  id         bigint generated always as identity primary key,
  role       text not null,
  action     text not null,
  details    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.admin_pins        enable row level security;
alter table public.admin_attempts    enable row level security;
alter table public.game_settings     enable row level security;
alter table public.point_adjustments enable row level security;
alter table public.admin_log         enable row level security;
revoke all on public.admin_pins, public.admin_attempts, public.game_settings,
              public.point_adjustments, public.admin_log from anon, authenticated;

-- ---------------------------------------------------------------- auth del PIN

create function public._client_key()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(split_part(
      coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''),
      ',', 1), ''),
    'unknown'
  );
$$;

-- Verifica il PIN. Non solleva errori (così i tentativi falliti restano
-- registrati): restituisce {ok:true, role} oppure {ok:false, error}.
-- Dopo 8 PIN errati in 10 minuti dallo stesso client blocca i tentativi.
create function public._admin_auth(p_pin text, p_min_role text default 'marco')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_client text := public._client_key();
  v_fails  int;
  v_role   text;
begin
  select count(*) into v_fails
    from admin_attempts
   where client = v_client
     and attempted_at > clock_timestamp() - interval '10 minutes';

  if v_fails >= 8 then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  select role into v_role
    from admin_pins
   where pin_hash = crypt(coalesce(p_pin, ''), pin_hash)
   order by (role = 'irenegade') desc
   limit 1;

  if v_role is null then
    insert into admin_attempts (client) values (v_client);
    return jsonb_build_object('ok', false, 'error', 'invalid_pin');
  end if;

  if p_min_role = 'irenegade' and v_role <> 'irenegade' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  return jsonb_build_object('ok', true, 'role', v_role);
end;
$$;

create function public._admin_log(p_role text, p_action text, p_details jsonb default '{}')
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_log (role, action, details) values (p_role, p_action, p_details);
$$;

-- ---------------------------------------------------------------- pausa del gioco

create function public.get_game_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'missionsEnabled', missions_enabled,
    'playEnabled', play_enabled
  )
  from public.game_settings where id = 1;
$$;

-- Applica la pausa a qualsiasi giocata, senza riscrivere le funzioni di gioco.
-- Le funzioni admin la saltano con app.admin = '1'.
create function public.enforce_game_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.game_settings;
begin
  if coalesce(current_setting('app.admin', true), '') = '1' then
    return new;
  end if;

  select * into s from game_settings where id = 1;

  if tg_op = 'INSERT' then
    if not s.play_enabled then
      raise exception 'game_paused' using errcode = '55000';
    elsif not s.missions_enabled then
      raise exception 'missions_paused' using errcode = '55000';
    end if;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('completed', 'skipped', 'active') and not s.play_enabled then
      raise exception 'game_paused' using errcode = '55000';
    elsif new.status in ('skipped', 'active') and not s.missions_enabled then
      raise exception 'missions_paused' using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

create trigger team_missions_game_state
  before insert or update on public.team_missions
  for each row execute function public.enforce_game_state();

-- ---------------------------------------------------------------- punteggio con correzioni

create function public._team_score(p_team_id int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (
    coalesce((select sum(points_awarded) from team_missions
               where team_id = p_team_id and status = 'completed'), 0)
    + coalesce((select sum(delta) from point_adjustments where team_id = p_team_id), 0)
  )::int;
$$;

create or replace view public.team_scores as
select
  t.id as team_id,
  t.name,
  public._team_score(t.id) as score,
  (select count(*) from public.team_missions tm
    where tm.team_id = t.id and tm.status = 'completed')::int as completed_missions
from public.teams t
order by score desc, completed_missions desc, t.id asc;

create or replace function public.get_leaderboard()
returns table (
  "position"         int,
  team_id            int,
  name               text,
  score              int,
  completed_missions int,
  last_completed_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select
      t.id,
      t.name,
      public._team_score(t.id) as score,
      (select count(*) from team_missions tm
        where tm.team_id = t.id and tm.status = 'completed')::int as completed,
      (select max(tm.completed_at) from team_missions tm
        where tm.team_id = t.id and tm.status = 'completed') as last_at
    from teams t
  )
  select
    (rank() over (order by s.score desc))::int,
    s.id,
    s.name,
    s.score,
    s.completed,
    s.last_at
  from s
  order by s.score desc, s.completed desc, s.last_at asc nulls last, s.id asc;
$$;

create or replace function public.get_team_state(p_team_id int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team      public.teams;
  v_completed int[];
  v_active    jsonb;
  v_skipped   jsonb;
  v_fresh     int;
begin
  select * into v_team from teams where id = p_team_id;
  if not found then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(mission_id order by completed_at), '{}')
    into v_completed
    from team_missions
   where team_id = p_team_id and status = 'completed';

  select jsonb_build_object(
           'id', m.id, 'title', m.title, 'category', m.category, 'text', m.text,
           'proofType', m.proof_type, 'points', m.points, 'requiresMarco', m.requires_marco
         )
    into v_active
    from team_missions tm
    join missions m on m.id = tm.mission_id
   where tm.team_id = p_team_id and tm.status = 'active';

  select coalesce(
           jsonb_agg(
             jsonb_build_object('id', m.id, 'title', m.title, 'category', m.category, 'points', m.points)
             order by tm.skipped_at
           ),
           '[]'::jsonb
         )
    into v_skipped
    from team_missions tm
    join missions m on m.id = tm.mission_id
   where tm.team_id = p_team_id and tm.status = 'skipped';

  select count(*)::int into v_fresh
    from missions m
   where m.active
     and not exists (
       select 1 from team_missions tm
        where tm.team_id = p_team_id and tm.mission_id = m.id
     );

  return jsonb_build_object(
    'teamId', v_team.id,
    'name', v_team.name,
    'score', public._team_score(p_team_id),
    'missionNumber', coalesce(array_length(v_completed, 1), 0) + 1,
    'step', case when v_active is null then 'ready' else 'active' end,
    'completedMissionIds', to_jsonb(v_completed),
    'activeMission', v_active,
    'skippedMissions', v_skipped,
    'freshRemaining', v_fresh,
    'canRedrawSkipped',
      v_active is null and v_fresh = 0 and jsonb_array_length(v_skipped) > 0,
    'allDone',
      v_active is null and v_fresh = 0 and jsonb_array_length(v_skipped) = 0
  );
end;
$$;

-- ---------------------------------------------------------------- funzioni admin (marco + irenegade)

create function public.admin_get_status(p_pin text)
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

  return jsonb_build_object('ok', true, 'data', public.get_game_status());
end;
$$;

create function public.admin_set_game(
  p_pin text,
  p_missions_enabled boolean,
  p_play_enabled boolean
)
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

  update game_settings
     set missions_enabled = p_missions_enabled,
         play_enabled = p_play_enabled,
         updated_at = now()
   where id = 1;

  perform public._admin_log(
    v_auth ->> 'role', 'set_game',
    jsonb_build_object('missionsEnabled', p_missions_enabled, 'playEnabled', p_play_enabled)
  );

  return jsonb_build_object('ok', true, 'data', public.get_game_status());
end;
$$;

-- Elenco per l'esportazione: missioni completate con eventuale prova.
create function public.admin_list_proofs(p_pin text)
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
             'proofPath', tm.proof_path
           ) order by tm.team_id, tm.completed_at)
      from team_missions tm
      join teams t on t.id = tm.team_id
      join missions m on m.id = tm.mission_id
     where tm.status = 'completed'
  ), '[]'::jsonb));
end;
$$;

-- Download delle foto dal bucket privato: il PIN arriva nell'header x-admin-pin.
create function public._storage_pin_ok(p_pin text)
returns boolean
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select coalesce((public._admin_auth(p_pin) ->> 'ok')::boolean, false);
$$;

create policy "proofs admin read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'proofs'
    and public._storage_pin_ok(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-pin'
    )
  );

-- ---------------------------------------------------------------- funzioni solo irenegade

create function public.admin_overview(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth jsonb := public._admin_auth(p_pin, 'irenegade');
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'status', public.get_game_status(),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
               'teamId', t.id,
               'name', t.name,
               'score', public._team_score(t.id),
               'adjustments', coalesce((select sum(delta) from point_adjustments pa where pa.team_id = t.id), 0),
               'completed', (select count(*) from team_missions tm where tm.team_id = t.id and tm.status = 'completed'),
               'completedMissions', coalesce((
                 select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'points', tm.points_awarded)
                                  order by tm.completed_at)
                   from team_missions tm join missions m on m.id = tm.mission_id
                  where tm.team_id = t.id and tm.status = 'completed'
               ), '[]'::jsonb),
               'skipped', (select count(*) from team_missions tm where tm.team_id = t.id and tm.status = 'skipped'),
               'activeMission', (
                 select jsonb_build_object('id', m.id, 'title', m.title, 'assignedAt', tm.assigned_at)
                   from team_missions tm join missions m on m.id = tm.mission_id
                  where tm.team_id = t.id and tm.status = 'active'
               )
             ) order by t.id)
        from teams t
    ), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'active', m.active) order by m.id)
        from missions m
    ), '[]'::jsonb)
  ));
end;
$$;

-- Annulla una missione completata: tolgono i punti e la missione torna
-- disponibile per la squadra. La prova resta nello Storage (e nel log).
create function public.admin_cancel_completion(p_pin text, p_team_id int, p_mission_id int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth jsonb := public._admin_auth(p_pin, 'irenegade');
  v_tm   public.team_missions;
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  perform set_config('app.admin', '1', true);
  perform 1 from teams where id = p_team_id for update;

  delete from team_missions
   where team_id = p_team_id and mission_id = p_mission_id and status = 'completed'
  returning * into v_tm;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_completed');
  end if;

  perform public._admin_log(
    v_auth ->> 'role', 'cancel_completion',
    jsonb_build_object(
      'teamId', p_team_id, 'missionId', p_mission_id,
      'points', v_tm.points_awarded, 'proofPath', v_tm.proof_path, 'proofText', v_tm.proof_text
    )
  );

  return jsonb_build_object('ok', true, 'data', public.get_team_state(p_team_id));
end;
$$;

create function public.admin_adjust_points(p_pin text, p_team_id int, p_delta int, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth   jsonb := public._admin_auth(p_pin, 'irenegade');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  if p_delta is null or p_delta = 0 or v_reason is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_adjustment');
  end if;

  perform 1 from teams where id = p_team_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'team_not_found');
  end if;

  insert into point_adjustments (team_id, delta, reason) values (p_team_id, p_delta, v_reason);

  perform public._admin_log(
    v_auth ->> 'role', 'adjust_points',
    jsonb_build_object('teamId', p_team_id, 'delta', p_delta, 'reason', v_reason)
  );

  return jsonb_build_object('ok', true, 'data', public.get_team_state(p_team_id));
end;
$$;

-- Assegna una missione precisa a una squadra, anche con il gioco in pausa.
-- L'eventuale missione attiva torna disponibile.
create function public.admin_assign_mission(p_pin text, p_team_id int, p_mission_id int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth   jsonb := public._admin_auth(p_pin, 'irenegade');
  v_status text;
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  perform set_config('app.admin', '1', true);
  perform 1 from teams where id = p_team_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'team_not_found');
  end if;

  perform 1 from missions where id = p_mission_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'mission_not_found');
  end if;

  select status into v_status
    from team_missions where team_id = p_team_id and mission_id = p_mission_id;

  if v_status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'already_completed');
  end if;

  delete from team_missions
   where team_id = p_team_id and status = 'active' and mission_id <> p_mission_id;

  if v_status = 'skipped' then
    update team_missions
       set status = 'active', assigned_at = now(), skipped_at = null
     where team_id = p_team_id and mission_id = p_mission_id;
  elsif v_status is null then
    insert into team_missions (team_id, mission_id) values (p_team_id, p_mission_id);
  end if;

  perform public._admin_log(
    v_auth ->> 'role', 'assign_mission',
    jsonb_build_object('teamId', p_team_id, 'missionId', p_mission_id)
  );

  return jsonb_build_object('ok', true, 'data', public.get_team_state(p_team_id));
end;
$$;

create function public.admin_unblock_team(p_pin text, p_team_id int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth    jsonb := public._admin_auth(p_pin, 'irenegade');
  v_dropped int;
  v_next    int;
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  perform set_config('app.admin', '1', true);
  perform 1 from teams where id = p_team_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'team_not_found');
  end if;

  -- la missione bloccata torna disponibile (non conta come scartata)
  delete from team_missions
   where team_id = p_team_id and status = 'active'
  returning mission_id into v_dropped;

  -- prima una missione nuova diversa da quella tolta, poi (se non ce ne sono) qualsiasi nuova
  select m.id into v_next
    from missions m
   where m.active and m.id is distinct from v_dropped
     and not exists (select 1 from team_missions tm where tm.team_id = p_team_id and tm.mission_id = m.id)
   order by random() limit 1;

  if v_next is null then
    select m.id into v_next
      from missions m
     where m.active
       and not exists (select 1 from team_missions tm where tm.team_id = p_team_id and tm.mission_id = m.id)
     order by random() limit 1;
  end if;

  if v_next is not null then
    insert into team_missions (team_id, mission_id) values (p_team_id, v_next);
  else
    -- nessuna nuova: riattiva una scartata
    select mission_id into v_next
      from team_missions where team_id = p_team_id and status = 'skipped'
     order by random() limit 1;

    if v_next is not null then
      update team_missions
         set status = 'active', assigned_at = now(), skipped_at = null
       where team_id = p_team_id and mission_id = v_next;
    end if;
  end if;

  perform public._admin_log(
    v_auth ->> 'role', 'unblock_team',
    jsonb_build_object('teamId', p_team_id, 'dropped', v_dropped, 'next', v_next)
  );

  return jsonb_build_object('ok', true, 'data', public.get_team_state(p_team_id));
end;
$$;

create function public.admin_reset_team(p_pin text, p_team_id int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth jsonb := public._admin_auth(p_pin, 'irenegade');
  v_rows int;
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  perform set_config('app.admin', '1', true);
  perform 1 from teams where id = p_team_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'team_not_found');
  end if;

  delete from team_missions where team_id = p_team_id;
  get diagnostics v_rows = row_count;
  delete from point_adjustments where team_id = p_team_id;

  perform public._admin_log(
    v_auth ->> 'role', 'reset_team',
    jsonb_build_object('teamId', p_team_id, 'rows', v_rows)
  );

  return jsonb_build_object('ok', true, 'data', public.get_team_state(p_team_id));
end;
$$;

-- Azzera tutte le squadre (squadre e missioni restano). Serve la conferma 'RESET'.
create function public.admin_reset_game(p_pin text, p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth jsonb := public._admin_auth(p_pin, 'irenegade');
  v_rows int;
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  if p_confirm is distinct from 'RESET' then
    return jsonb_build_object('ok', false, 'error', 'confirmation_required');
  end if;

  perform set_config('app.admin', '1', true);

  delete from team_missions where true;
  get diagnostics v_rows = row_count;
  delete from point_adjustments where true;

  perform public._admin_log(v_auth ->> 'role', 'reset_game', jsonb_build_object('rows', v_rows));

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('rows', v_rows));
end;
$$;

create function public.admin_get_log(p_pin text, p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth jsonb := public._admin_auth(p_pin, 'irenegade');
begin
  if not (v_auth ->> 'ok')::boolean then
    return v_auth;
  end if;

  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', l.id, 'role', l.role, 'action', l.action,
             'details', l.details, 'createdAt', l.created_at
           ) order by l.id desc)
      from (select * from admin_log order by id desc limit least(greatest(p_limit, 1), 200)) l
  ), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------- permessi

revoke execute on function
  public._client_key(),
  public._admin_auth(text, text),
  public._admin_log(text, text, jsonb),
  public._team_score(int),
  public.enforce_game_state()
from public, anon, authenticated;

revoke execute on function
  public._storage_pin_ok(text),
  public.get_game_status(),
  public.admin_get_status(text),
  public.admin_set_game(text, boolean, boolean),
  public.admin_list_proofs(text),
  public.admin_overview(text),
  public.admin_cancel_completion(text, int, int),
  public.admin_adjust_points(text, int, int, text),
  public.admin_assign_mission(text, int, int),
  public.admin_unblock_team(text, int),
  public.admin_reset_team(text, int),
  public.admin_reset_game(text, text),
  public.admin_get_log(text, int)
from public;

grant execute on function
  public._storage_pin_ok(text),
  public.get_game_status(),
  public.admin_get_status(text),
  public.admin_set_game(text, boolean, boolean),
  public.admin_list_proofs(text),
  public.admin_overview(text),
  public.admin_cancel_completion(text, int, int),
  public.admin_adjust_points(text, int, int, text),
  public.admin_assign_mission(text, int, int),
  public.admin_unblock_team(text, int),
  public.admin_reset_team(text, int),
  public.admin_reset_game(text, text),
  public.admin_get_log(text, int)
to anon, authenticated;
