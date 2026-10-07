-- La view team_scores girava con i permessi del proprietario (SECURITY DEFINER, il
-- comportamento predefinito delle view): l'advisor di Supabase la segnala come critica.
-- L'app non la usa: la classifica passa da get_leaderboard(), una funzione con
-- search_path fisso e permessi espliciti. Si elimina la view e, con lei, il permesso
-- su _team_score che serviva solo a lei.

drop view if exists public.team_scores;

revoke execute on function public._team_score(int) from anon, authenticated;
