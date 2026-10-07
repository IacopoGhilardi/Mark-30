-- Classifica per punti e storico delle missioni completate.

-- Classifica: posizione per punteggio (a pari punti stessa posizione).
-- Ordine: punti, poi missioni completate, poi chi ha completato prima.
create function public.get_leaderboard()
returns table (
  "position"        int,
  team_id           int,
  name              text,
  score             int,
  completed_missions int,
  last_completed_at timestamptz
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
      coalesce(sum(tm.points_awarded), 0)::int as score,
      (count(tm.id) filter (where tm.status = 'completed'))::int as completed,
      max(tm.completed_at) as last_at
    from teams t
    left join team_missions tm on tm.team_id = t.id
    group by t.id, t.name
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

-- Missioni completate con i punti: di una squadra, oppure di tutte
-- (p_team_id null) per un feed globale. Dalla più recente.
create function public.get_completed_missions(
  p_team_id int default null,
  p_limit   int default 50
)
returns table (
  id           uuid,
  team_id      int,
  team_name    text,
  mission_id   int,
  title        text,
  category     text,
  points       int,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tm.id,
    tm.team_id,
    t.name,
    m.id,
    m.title,
    m.category,
    tm.points_awarded,
    tm.completed_at
  from team_missions tm
  join teams t on t.id = tm.team_id
  join missions m on m.id = tm.mission_id
  where tm.status = 'completed'
    and (p_team_id is null or tm.team_id = p_team_id)
  order by tm.completed_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

revoke execute on function
  public.get_leaderboard(),
  public.get_completed_missions(int, int)
from public;

grant execute on function
  public.get_leaderboard(),
  public.get_completed_missions(int, int)
to anon, authenticated;
