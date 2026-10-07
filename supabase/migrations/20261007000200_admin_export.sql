-- Area admin per esportare le prove dal telefono (/export).
-- Accesso: utente Supabase Auth creato a mano (signup disabilitato) + email in `admins`.

-- Limite per file: 20 MB (foto compresse nel browser, video corti).
update storage.buckets set file_size_limit = 20971520 where id = 'proofs';

create table public.admins (
  email text primary key
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
     where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Solo gli admin possono leggere/scaricare i file del bucket privato.
create policy "proofs admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'proofs' and public.is_admin());

-- Elenco di tutte le missioni completate con prova, per l'esportazione.
create function public.admin_list_proofs()
returns table (
  id           uuid,
  team_id      int,
  team_name    text,
  mission_id   int,
  title        text,
  category     text,
  points       int,
  completed_at timestamptz,
  proof_text   text,
  proof_path   text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select tm.id, tm.team_id, t.name, m.id, m.title, m.category,
           tm.points_awarded, tm.completed_at, tm.proof_text, tm.proof_path
      from team_missions tm
      join teams t on t.id = tm.team_id
      join missions m on m.id = tm.mission_id
     where tm.status = 'completed'
     order by tm.team_id, tm.completed_at;
end;
$$;

revoke execute on function public.is_admin(), public.admin_list_proofs() from public, anon;
grant execute on function public.is_admin(), public.admin_list_proofs() to authenticated;
