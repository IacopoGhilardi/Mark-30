-- Codice di sblocco del telefono di Marco: si legge solo con il PIN (Marco o
-- Irene) e non passa mai da get_game_status, che è pubblico. Si imposta dal SQL
-- editor, mai nel codice:
--   update public.game_settings set phone_unlock_code = '123456' where id = 1;

alter table public.game_settings add column phone_unlock_code text;

-- stato per le funzioni admin: quello pubblico più il codice
create function public._admin_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.get_game_status()
         || jsonb_build_object('phoneUnlockCode', (select phone_unlock_code from game_settings where id = 1));
$$;

revoke execute on function public._admin_status() from public, anon, authenticated;

create or replace function public.admin_get_status(p_pin text)
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

  return jsonb_build_object('ok', true, 'data', public._admin_status());
end;
$$;

create or replace function public.admin_set_game(
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

  return jsonb_build_object('ok', true, 'data', public._admin_status());
end;
$$;
