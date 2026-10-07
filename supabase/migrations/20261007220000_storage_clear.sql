-- Svuotare le prove dalla pagina di Irene (reset prima della festa).
-- Supabase non permette di cancellare i file da SQL: si fa con la Storage API,
-- autorizzata dal PIN di Irene (header x-admin-pin), come per il download.

create function public._storage_irene_ok(p_pin text)
returns boolean
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select coalesce((public._admin_auth(p_pin, 'irenegade') ->> 'ok')::boolean, false);
$$;

create policy "proofs admin delete" on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'proofs'
    and public._storage_irene_ok(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-pin'
    )
  );

-- Registra un'azione fatta fuori dal DB (per esempio lo svuotamento dello Storage).
create function public.admin_log_event(p_pin text, p_action text, p_details jsonb default '{}')
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

  perform public._admin_log(v_auth ->> 'role', p_action, coalesce(p_details, '{}'));

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('logged', true));
end;
$$;

revoke execute on function public._storage_irene_ok(text), public.admin_log_event(text, text, jsonb) from public;
grant execute on function public._storage_irene_ok(text), public.admin_log_event(text, text, jsonb) to anon, authenticated;
