-- Solo sviluppo locale: si applica con `supabase db reset` e con `npm run dev:all`.
-- NON viene eseguito da `supabase db push`, quindi non arriva mai al progetto cloud.
-- PIN locali: marco = 1111, irenegade = 9999.
insert into public.admin_pins (role, pin_hash) values
  ('marco',     extensions.crypt('1111', extensions.gen_salt('bf'))),
  ('irenegade', extensions.crypt('9999', extensions.gen_salt('bf')))
on conflict (role) do nothing;
