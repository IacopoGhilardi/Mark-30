-- La view team_scores chiama _team_score: Postgres controlla il permesso di
-- esecuzione sull'utente che interroga la view (non sul proprietario), quindi
-- anon deve poterla eseguire. Restituisce solo il punteggio di una squadra,
-- già pubblico in classifica.
grant execute on function public._team_score(int) to anon, authenticated;
