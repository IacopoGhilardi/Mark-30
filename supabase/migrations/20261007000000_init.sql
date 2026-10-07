-- Marco's 30th — The Birthday Games
-- Stato autorevole lato server. Il browser non accede alle tabelle:
-- parla solo con le funzioni RPC e con la view team_scores.

-- ---------------------------------------------------------------- tables

create table public.teams (
  id      int primary key,
  name    text not null,
  members text[] not null default '{}'
);

create table public.missions (
  id             int primary key,
  title          text not null,
  category       text not null,
  text           text not null,
  proof_type     text not null check (proof_type in (
    'none', 'photo', 'video', 'text',
    'photo_optional', 'video_or_text', 'optional_text'
  )),
  points         int  not null check (points >= 0),
  requires_marco boolean not null default false,
  active         boolean not null default true
);

-- Una riga per ogni missione assegnata a una squadra (assegnazione + completion).
create table public.team_missions (
  id             uuid primary key default gen_random_uuid(),
  team_id        int  not null references public.teams (id),
  mission_id     int  not null references public.missions (id),
  status         text not null default 'active' check (status in ('active', 'completed')),
  assigned_at    timestamptz not null default now(),
  completed_at   timestamptz,
  proof_text     text,
  proof_path     text,
  points_awarded int,
  unique (team_id, mission_id)
);

-- Una sola missione attiva per squadra, garantita dal DB.
create unique index team_missions_one_active_per_team
  on public.team_missions (team_id) where status = 'active';

-- ---------------------------------------------------------------- leaderboard

create view public.team_scores as
select
  t.id as team_id,
  t.name,
  coalesce(sum(tm.points_awarded), 0)::int as score,
  count(tm.id) filter (where tm.status = 'completed')::int as completed_missions
from public.teams t
left join public.team_missions tm on tm.team_id = t.id
group by t.id, t.name
order by score desc, completed_missions desc, t.id asc;

-- ---------------------------------------------------------------- rpc

-- Stato completo di una squadra (equivale al vecchio localStorage).
create function public.get_team_state(p_team_id int)
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

  return jsonb_build_object(
    'teamId', v_team.id,
    'name', v_team.name,
    'score', v_score,
    'missionNumber', coalesce(array_length(v_completed, 1), 0) + 1,
    'step', case when v_active is null then 'ready' else 'active' end,
    'completedMissionIds', to_jsonb(v_completed),
    'activeMission', v_active
  );
end;
$$;

-- "Dammi la prossima missione per TEAM X". Idempotente: se esiste già una
-- missione attiva la restituisce, altrimenti ne assegna una e la persiste.
create function public.draw_mission(p_team_id int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission_id int;
begin
  -- serializza le richieste concorrenti della stessa squadra
  perform 1 from teams where id = p_team_id for update;
  if not found then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from team_missions where team_id = p_team_id and status = 'active'
  ) then
    select m.id into v_mission_id
      from missions m
     where m.active
       and not exists (
         select 1 from team_missions tm
          where tm.team_id = p_team_id and tm.mission_id = m.id
       )
     order by random()
     limit 1;

    -- se non resta nulla, lo stato torna con activeMission = null
    if v_mission_id is not null then
      insert into team_missions (team_id, mission_id) values (p_team_id, v_mission_id);
    end if;
  end if;

  return public.get_team_state(p_team_id);
end;
$$;

-- Completa la missione attiva. I punti arrivano dalla missione, mai dal client.
-- Idempotente: un secondo invio non assegna di nuovo i punti.
create function public.complete_mission(
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

  -- già completata: restituisce lo stato attuale senza riassegnare punti
  if v_tm.status = 'completed' then
    return public.get_team_state(p_team_id);
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
    else true  -- none, photo_optional, optional_text
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

-- ---------------------------------------------------------------- security

alter table public.teams         enable row level security;
alter table public.missions      enable row level security;
alter table public.team_missions enable row level security;

revoke all on public.teams, public.missions, public.team_missions from anon, authenticated;

-- teams è pubblica in lettura (nomi/membri per la UI); missions no (spoiler).
create policy "teams readable" on public.teams for select to anon, authenticated using (true);
grant select on public.teams to anon, authenticated;

grant select on public.team_scores to anon, authenticated;

revoke execute on all functions in schema public from public;
grant execute on function
  public.get_team_state(int),
  public.draw_mission(int),
  public.complete_mission(int, int, text, text)
to anon, authenticated;

-- ---------------------------------------------------------------- storage

-- Bucket privato: anon può solo caricare. Le prove si recuperano dalla
-- dashboard o con la service key dopo la festa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proofs', 'proofs', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
        'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;

create policy "proofs upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'proofs' and name ~ '^team-[0-9]+/');

-- ---------------------------------------------------------------- seed

insert into public.teams (id, name, members) values
  (1, 'TEAM 1', array['Seppia', 'Bata', 'Claudia', 'Nedo', 'Scavo']),
  (2, 'TEAM 2', array['Bartolomei', 'Carmen', 'Nico', 'Aras', 'Andre Grossi']),
  (3, 'TEAM 3', array['Fede Stella', 'Vittoria', 'Bianu', 'marzu', 'Federico Filipp']),
  (4, 'TEAM 4', array['Pasqui', 'Asia Rinzi', 'Ghila', 'Giulia Carni', 'Crappi']),
  (5, 'TEAM 5', array['Confo', 'Kevin', 'Pozza', 'Azzu', 'Cloe']),
  (6, 'TEAM 6', array['Biancone', 'Gianlu', 'Asia', 'Greta', 'Filippo']),
  (7, 'TEAM 7', array['Santamaria', 'Elisa', 'Ire', 'Lupetta', 'Giacomino']),
  (8, 'TEAM 8', array['Filippo Morelli', 'Giordana', 'Caramans', 'Ila Pap', 'Trevi']),
  (9, 'TEAM 9', array['Gori', 'Giada', 'Daiana', 'Marchino Pref', 'Ciocia'])
on conflict (id) do nothing;

insert into public.missions (id, title, category, text, proof_type, points, requires_marco, active) values
  (1, 'THE ALBUM COVER', 'TAKE THE SHOT', 'Scattate una foto seria da copertina di un album insieme a Marco.', 'photo', 15, true, true),
  (2, 'THE PHOTO BOMB', 'TAKE THE SHOT', 'Fate una foto con Marco mentre sullo sfondo uno sconosciuto fa qualcosa di assurdo.', 'photo', 15, true, true),
  (3, '30', 'TAKE THE SHOT', 'Rappresentate il numero 30 senza mostrare né scrivere il numero 30.', 'photo', 15, false, true),
  (4, 'THE WRONG GROUP', 'TAKE THE SHOT', 'Create un trio improbabile con Marco e una persona che conoscete appena.', 'photo', 15, true, true),
  (5, 'FAMILY PORTRAIT', 'TAKE THE SHOT', 'Radunate almeno 4 persone di gruppi diversi intorno a Marco e scattate una serissima foto di famiglia natalizia.', 'photo', 15, true, true),
  (6, 'THE DEEPFAKE', 'TAKE THE SHOT', 'Scattate una foto che tra 10 anni farà chiedere a Marco: “Ma perché stavamo facendo questa cosa?”', 'photo', 15, true, true),
  (7, 'THE REENACTMENT', 'TAKE THE SHOT', 'Chiedete a qualcuno che conosce bene Marco un momento iconico della sua vita e ricreatelo in una foto insieme a lui.', 'photo', 20, true, true),
  (8, 'THE DOUBLE', 'TAKE THE SHOT', 'Trovate qualcuno che non conosce Marco e fategli imitare esattamente la sua posa.', 'photo', 15, true, true),
  (9, 'THREE GENERATIONS', 'TAKE THE SHOT', 'Scattate una foto con Marco e tre persone di età chiaramente diverse.', 'photo', 15, true, true),
  (10, 'THE SAGA', 'TAKE THE SHOT', 'Scattate una foto con Marco che potrebbe avere senso soltanto a una sagra.', 'photo', 15, true, true),
  (11, 'THE POSTER', 'TAKE THE SHOT', 'Create la locandina fotografica di un film inesistente e inventategli un titolo.', 'photo', 15, false, true),
  (12, 'THE CROWD', 'TAKE THE SHOT', 'Scattate una foto con Marco in cui ogni persona presente abbia un ruolo preciso nella scena.', 'photo', 15, true, true),
  (13, 'SURF’S UP 🌊', 'TAKE THE SHOT', 'Scattate una foto come se foste surfisti appena usciti da una sessione epica, usando quello che trovate alla festa come attrezzatura.', 'photo', 15, false, true),
  (14, 'THE EVIDENCE', 'TAKE THE SHOT', 'Scattate una foto che riassuma perfettamente la serata di Marco. Marco può anche non essere nella foto.', 'photo', 15, false, true),
  (15, 'THE STRANGER', 'MIX IT UP', 'Presentate uno sconosciuto a Marco come se fosse un suo amico da 15 anni.', 'none', 10, true, true),
  (16, 'THE UNDERCOVER FRIEND', 'MIX IT UP', 'Uno sconosciuto e Marco devono comportarsi per 3 minuti come vecchi amici e inventare un aneddoto condiviso.', 'none', 10, true, true),
  (17, 'THE SECRET AGENT', 'MIX IT UP', 'Fate fare a qualcuno che conosce appena Marco una domanda insolita. Salvate domanda e risposta.', 'text', 15, true, true),
  (18, 'THE LONGEST FRIENDSHIP', 'MIX IT UP', 'Trovate qualcuno che conosce Marco da più tempo possibile e chiedetegli una cosa che Marco faceva da giovane e che non è mai cambiata.', 'optional_text', 10, false, true),
  (19, 'THE COUSIN', 'MIX IT UP', 'Trovate un “cugino” sconosciuto e fategli raccontare a Marco un fatto che dovrebbe conoscere soltanto la famiglia.', 'text', 15, true, true),
  (20, 'THE WITNESS', 'MIX IT UP', 'Fatevi raccontare una storia vera e incredibile su Marco. Poi chiedetegli “È vero che…?” senza rivelare la fonte.', 'text', 15, true, true),
  (21, 'THE MATCHMAKER', 'MIX IT UP', 'Presentate due persone che non si conoscono raccontando per ciascuna un fatto vero e uno inventato.', 'none', 10, false, true),
  (22, 'THE INTERVIEW', 'MIX IT UP', 'Chiedete a una persona che conosce appena Marco: “Qual è la prima cosa che ti viene in mente quando senti Marco?”', 'text', 15, false, true),
  (23, 'THE INTRODUCTION', 'MIX IT UP', 'Portate da Marco qualcuno che non conosce bene, presentateli e poi sparite.', 'none', 10, true, true),
  (24, 'THE WRONG ANSWER', 'MIX IT UP', 'Fate a Marco una domanda semplice di cui conoscete la risposta. Qualunque cosa dica, insistete per 30 secondi che sia sbagliata.', 'text', 15, true, true),
  (25, 'THE SIDE QUEST', 'MIX IT UP', 'Trovate uno sconosciuto e avete 60 secondi per inventare insieme una missione segreta per Marco: fattibile, leggermente assurda e qualcosa che non farebbe spontaneamente.', 'text', 15, false, true),
  (26, 'THE STRANGER’S WISH', 'MIX IT UP', 'Chiedete a uno sconosciuto di lasciare un augurio a una persona che non conosce e che sta compiendo 30 anni.', 'text', 15, false, true),
  (27, 'THE SPEECH', 'CAUSE SOME CHAOS', 'Convincete almeno 3 persone a fare un brindisi spontaneo per Marco.', 'none', 10, true, true),
  (28, 'THE QUESTION', 'CAUSE SOME CHAOS', 'Fate a Marco una domanda completamente assurda e ottenete una risposta seria.', 'text', 15, true, true),
  (29, 'THE POSE', 'CAUSE SOME CHAOS', 'Convincete almeno 5 persone a mettersi nella stessa posa senza spiegare perché.', 'photo', 15, false, true),
  (30, 'THE CONFUSION', 'CAUSE SOME CHAOS', 'Fate qualcosa che porti Marco a dire spontaneamente: “Ma perché?”', 'text', 15, true, true),
  (31, 'THE FAKE TRADITION', 'CAUSE SOME CHAOS', 'Inventate una nuova tradizione per il compleanno di Marco e convincete almeno 3 persone a seguirla.', 'none', 10, true, true),
  (32, 'THE WRONG TOAST', 'CAUSE SOME CHAOS', 'Fate un brindisi solenne per qualcosa che non ha nulla a che vedere con il compleanno. Alla fine brindate comunque a Marco.', 'photo_optional', 10, true, true),
  (33, 'THE PAPARAZZI TEAM', 'CAUSE SOME CHAOS', 'Reclutate altre due persone e scattate 3 foto di Marco come se fosse una celebrità inseguita dai paparazzi. Caricate la migliore.', 'photo', 15, true, true),
  (34, 'THE NPC', 'CAUSE SOME CHAOS', 'Per 30 secondi rispondete a qualsiasi domanda di Marco con la stessa frase completamente scollegata. Poi tornate normali.', 'none', 10, true, true),
  (35, 'THE DEAL', 'CAUSE SOME CHAOS', 'Date a Marco due opzioni assurde e obbligatelo a sceglierne una senza spiegargli il motivo.', 'text', 15, true, true),
  (36, 'THE HYPE MAN', 'CAUSE SOME CHAOS', 'Per un minuto, ogni volta che qualcuno nomina Marco reagite come se avesse appena vinto qualcosa di enorme.', 'none', 10, true, true),
  (37, 'THE 30-YEAR-OLD', 'CAUSE SOME CHAOS', 'Chiedete a 3 persone di descrivere Marco con una sola parola. Le tre parole devono essere diverse.', 'text', 15, false, true),
  (38, 'THE PROPHECY', 'CAUSE SOME CHAOS', 'Fate predire a qualcuno che conosce appena Marco un evento stranamente specifico che gli accadrà entro 12 mesi.', 'text', 15, false, true),
  (39, 'THE QUEST', 'CAUSE SOME CHAOS', 'Fate inventare a uno sconosciuto una missione che Marco dovrebbe completare prima di compiere 31 anni.', 'text', 15, false, true),
  (40, 'THE FALSE MEMORY', 'CAUSE SOME CHAOS', 'Con uno sconosciuto inventate un falso ricordo condiviso e raccontatelo a Marco nel modo più convincente possibile.', 'text', 15, true, true),
  (41, '30 SECONDS', 'FOR MARCO', 'Registrate un video di massimo 30 secondi con un messaggio o un pensiero per Marco.', 'video', 20, false, true),
  (42, 'THE PREDICTION', 'FOR MARCO', 'Registrate un video completando la frase: “A 40 anni, Marco…”', 'video', 20, false, true),
  (43, 'ONE MEMORY', 'FOR MARCO', 'Raccontate in un video di massimo 30 secondi il vostro ricordo preferito con Marco.', 'video', 20, false, true),
  (44, 'THE ADVICE', 'FOR MARCO', 'Scrivete un consiglio per i 30 anni di Marco. Non potete usare la frase “goditi la vita”.', 'text', 15, false, true),
  (45, 'THE COMPLIMENT', 'FOR MARCO', 'Scrivete qualcosa che apprezzate sinceramente di Marco senza usare le parole “simpatico”, “bravo” o “unico”.', 'text', 15, false, true),
  (46, 'THE SECRET STORY', 'FOR MARCO', 'Trovate qualcuno che conosce Marco da almeno 10 anni e fatevi raccontare una storia che Marco probabilmente non ha mai sentito raccontare così.', 'video_or_text', 20, false, true),
  (47, 'IF MARCO WERE...', 'FOR MARCO', 'Completate: “Se Marco fosse ___, sarebbe ___ perché ___.”', 'text', 15, false, true),
  (48, 'THE TRAVELER ✈️', 'FOR MARCO', 'Se domani poteste mandare Marco in viaggio senza preavviso, dove lo mandereste e perché? Massimo 2 righe.', 'text', 15, false, true),
  (49, 'READ THIS AT 40', 'FOR MARCO', 'Scrivete un messaggio che Marco dovrebbe rileggere a 40 anni. Non può essere un augurio per il suo quarantesimo compleanno.', 'text', 15, false, true),
  (50, 'FOR THE BIRTHDAY BOY ❤️', 'FOR MARCO', 'Completate la frase: “Marco, una cosa che vorrei che sapessi a 30 anni è…”', 'text', 15, false, true)
on conflict (id) do nothing;
