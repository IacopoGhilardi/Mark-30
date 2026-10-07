-- Salto delle missioni.
--  * una missione completata o scartata non viene mai riassegnata finché ce ne
--    sono di nuove;
--  * "salta" assegna subito una missione nuova;
--  * finite le nuove, la squadra può farsi riassegnare una delle scartate.

alter table public.team_missions drop constraint team_missions_status_check;
alter table public.team_missions
  add constraint team_missions_status_check
  check (status in ('active', 'completed', 'skipped'));

alter table public.team_missions add column skipped_at timestamptz;

-- Stato squadra: aggiunge le missioni scartate e se si può riestrarre.
create or replace function public.get_team_state(p_team_id int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team      public.teams;
  v_score     int;
  v_completed int[];
  v_active    jsonb;
  v_skipped   jsonb;
  v_fresh     int;
begin
  select * into v_team from teams where id = p_team_id;
  if not found then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  select coalesce(sum(points_awarded), 0)::int,
         coalesce(array_agg(mission_id order by completed_at), '{}')
    into v_score, v_completed
    from team_missions
   where team_id = p_team_id and status = 'completed';

  select jsonb_build_object(
           'id', m.id,
           'title', m.title,
           'category', m.category,
           'text', m.text,
           'proofType', m.proof_type,
           'points', m.points,
           'requiresMarco', m.requires_marco
         )
    into v_active
    from team_missions tm
    join missions m on m.id = tm.mission_id
   where tm.team_id = p_team_id and tm.status = 'active';

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', m.id,
               'title', m.title,
               'category', m.category,
               'points', m.points
             ) order by tm.skipped_at
           ),
           '[]'::jsonb
         )
    into v_skipped
    from team_missions tm
    join missions m on m.id = tm.mission_id
   where tm.team_id = p_team_id and tm.status = 'skipped';

  -- missioni mai assegnate a questa squadra
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
    'score', v_score,
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

-- Salta la missione attiva e ne assegna subito una nuova.
-- p_mission_id è la missione che il telefono sta mostrando: se nel frattempo è
-- cambiata (es. l'ha già saltata un altro telefono) non fa nulla, così un
-- doppio tocco non salta due missioni.
create function public.skip_mission(p_team_id int, p_mission_id int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active int;
  v_next   int;
begin
  perform 1 from teams where id = p_team_id for update;
  if not found then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  select mission_id into v_active
    from team_missions
   where team_id = p_team_id and status = 'active';

  if v_active is null or v_active <> p_mission_id then
    return public.get_team_state(p_team_id);
  end if;

  update team_missions
     set status = 'skipped', skipped_at = clock_timestamp()
   where team_id = p_team_id and status = 'active';

  select m.id into v_next
    from missions m
   where m.active
     and not exists (
       select 1 from team_missions tm
        where tm.team_id = p_team_id and tm.mission_id = m.id
     )
   order by random()
   limit 1;

  if v_next is not null then
    insert into team_missions (team_id, mission_id) values (p_team_id, v_next);
  end if;

  return public.get_team_state(p_team_id);
end;
$$;

-- Finite le missioni nuove: riassegna una missione scartata.
-- Senza p_mission_id ne sceglie una a caso (evitando, se possibile, quella
-- appena scartata); con p_mission_id la squadra sceglie quale.
create function public.redraw_skipped_mission(p_team_id int, p_mission_id int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pick  int;
  v_fresh int;
begin
  perform 1 from teams where id = p_team_id for update;
  if not found then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from team_missions where team_id = p_team_id and status = 'active'
  ) then
    return public.get_team_state(p_team_id);
  end if;

  select count(*) into v_fresh
    from missions m
   where m.active
     and not exists (
       select 1 from team_missions tm
        where tm.team_id = p_team_id and tm.mission_id = m.id
     );
  if v_fresh > 0 then
    raise exception 'fresh_available' using errcode = '22023';
  end if;

  if p_mission_id is not null then
    select mission_id into v_pick
      from team_missions
     where team_id = p_team_id and mission_id = p_mission_id and status = 'skipped';

    if v_pick is null then
      raise exception 'mission_not_skipped' using errcode = 'P0002';
    end if;
  else
    select mission_id into v_pick
      from team_missions
     where team_id = p_team_id and status = 'skipped'
     order by
       (skipped_at = (
         select max(skipped_at) from team_missions
          where team_id = p_team_id and status = 'skipped'
       )) asc,
       random()
     limit 1;
  end if;

  if v_pick is not null then
    update team_missions
       set status = 'active', assigned_at = now(), skipped_at = null
     where team_id = p_team_id and mission_id = v_pick;
  end if;

  return public.get_team_state(p_team_id);
end;
$$;

-- complete_mission: una missione scartata non si può più completare
-- (telefono rimasto indietro).
create or replace function public.complete_mission(
  p_team_id    int,
  p_mission_id int,
  p_proof_text text default null,
  p_proof_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tm    public.team_missions;
  v_m     public.missions;
  v_text  text := nullif(btrim(coalesce(p_proof_text, '')), '');
  v_path  text := nullif(btrim(coalesce(p_proof_path, '')), '');
  v_ok    boolean;
begin
  perform 1 from teams where id = p_team_id for update;
  if not found then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  select * into v_tm from team_missions
   where team_id = p_team_id and mission_id = p_mission_id;
  if not found then
    raise exception 'mission_not_assigned' using errcode = 'P0002';
  end if;

  if v_tm.status = 'completed' then
    return public.get_team_state(p_team_id);
  end if;

  if v_tm.status = 'skipped' then
    raise exception 'mission_skipped' using errcode = '22023';
  end if;

  select * into v_m from missions where id = p_mission_id;

  if v_path is not null and v_path not like 'team-' || p_team_id || '/%' then
    raise exception 'invalid_proof_path' using errcode = '22023';
  end if;

  v_ok := case v_m.proof_type
    when 'photo'         then v_path is not null
    when 'video'         then v_path is not null
    when 'text'          then v_text is not null
    when 'video_or_text' then v_path is not null or v_text is not null
    else true
  end;
  if not v_ok then
    raise exception 'proof_required' using errcode = '22023';
  end if;

  update team_missions
     set status = 'completed',
         completed_at = now(),
         proof_text = v_text,
         proof_path = v_path,
         points_awarded = v_m.points
   where id = v_tm.id;

  return public.get_team_state(p_team_id);
end;
$$;

revoke execute on function
  public.skip_mission(int, int),
  public.redraw_skipped_mission(int, int)
from public;

grant execute on function
  public.skip_mission(int, int),
  public.redraw_skipped_mission(int, int)
to anon, authenticated;
