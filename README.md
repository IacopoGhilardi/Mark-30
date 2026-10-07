# Marco's 30th — The Birthday Games

Gioco a squadre per il 30° compleanno di Marco: 9 squadre, 60 missioni da completare
con foto, video o testo, classifica live. Ogni squadra gioca da un solo telefono
(il "Game Phone") scansionando il proprio QR.

- **Frontend**: Nuxt 4 (SPA statica, `ssr: false`) deployata su Netlify.
- **Backend**: Supabase (Postgres + Storage), chiamato direttamente dal browser.
  Nessun server nostro.

## Come funziona

| Pagina | Cosa fa |
| --- | --- |
| `/` | Presentazione |
| `/draw` | Finta estrazione delle squadre (solo scenografia, non usa il DB) |
| `/play/{teamId}` | Ingresso del Game Phone di una squadra (il QR punta qui). "Siamo pronti" estrae la prima missione e apre il gioco. Se la squadra ha già iniziato (missione attiva, completate o scartate) rimanda subito a `/game` |
| `/play/{teamId}/game` | Missioni e prove. Se la squadra non ha ancora iniziato (o è stata azzerata da un admin) rimanda a `/play/{teamId}` |
| `/classifica` | Classifica live |
| `/mark30/admin` | Admin di Marco (PIN): pausa del gioco ed esportazione delle foto |
| `/irenegade/admin` | Admin completo (PIN): squadre bloccate, punti, annulli, reset |

L'identità della squadra deriva dal link `/play/{teamId}`: niente login. Rientrando
dallo stesso QR (anche da un altro telefono) la squadra ritrova punteggio e missione
corrente, perché lo stato sta nel database e non nel telefono.

## Architettura

Lo stato autorevole è nel database. Il browser non legge né scrive le tabelle
direttamente (RLS attiva, nessuna policy per `anon`): parla solo con funzioni Postgres
(RPC) che applicano le regole.

- **Una sola missione attiva per squadra**, garantita da un indice unico.
- **Nessuna missione ripetuta**: `unique (team_id, mission_id)`. Completate e scartate
  non tornano finché ci sono missioni nuove; finite quelle, la squadra può farsi
  riassegnare una scartata (a caso o scegliendola).
- **Salto**: nessuna penalità, nessun limite oltre alle missioni disponibili.
- **Punti decisi dal server**, letti dalla missione, mai inviati dal client.
- **Completamento idempotente**: un secondo invio non assegna di nuovo i punti.
- **Prove** (foto/video) in un bucket Storage privato, collegate a squadra e missione.
  Le foto sono compresse nel browser (max 1600 px, JPEG); limite 20 MB per file, quindi
  i video devono essere corti (~15 s).
  L'upload è idempotente: il nome include l'hash del contenuto (`team-3/mission-7-<hash>.jpg`),
  quindi riprovare o inviare due volte lo stesso file non crea copie.

### Database

Tabelle: `teams`, `missions`, `team_missions` (assegnazione + completion).
Squadre e missioni sono caricate dalla migration (seed generato da `app/datas/`).
Se modifichi `app/datas/missions.ts` (testi, punti, tipi di prova, nuove missioni) esegui
`npm run db:missions`: genera una migration che allinea il DB (inserisce, aggiorna e disattiva
quelle tolte), poi `npm run db:push`.

Funzioni:

| Funzione | Scopo |
| --- | --- |
| `get_team_state(team_id)` | Stato della squadra: punteggio, missione attiva, completate |
| `draw_mission(team_id)` | Restituisce la missione attiva o ne assegna una a caso |
| `complete_mission(team_id, mission_id, proof_text, proof_path)` | Chiude la missione e assegna i punti |
| `skip_mission(team_id, mission_id)` | Salta la missione attiva e ne assegna subito una nuova |
| `redraw_skipped_mission(team_id, mission_id?)` | Finite le nuove, riassegna una missione scartata |
| `get_leaderboard()` | Classifica per punti, con posizione |
| `get_completed_missions(team_id?, limit?)` | Missioni completate con i punti (di una squadra o di tutte) |

Le migrations sono in `supabase/migrations/`.

### Frontend

```
app/
  api/            una funzione per file (getTeamState, drawMission, completeMission,
                  uploadProof, getLeaderboard, getCompletedMissions)
  composables/    useSupabase (client unico), useAppLoader
  utils/          repository (repository generico + callRpc), withLoader
  repositories/   repository per tabelle leggibili (teams)
  types/          tipi condivisi
  datas/          squadre e missioni (fonte del seed)
```

Le funzioni in `app/api/` sono auto-importate dalle view:

```ts
const state = await withLoader(() => getTeamState(teamId), 'CARICO LA SQUADRA...')
await withLoader(() => drawMission(teamId), 'ESTRAGGO LA MISSIONE...')
await withLoader(() => completeMission(teamId, missionId, { file }), 'INVIO LA PROVA...')
const board = await getLeaderboard()
```

`withLoader` mostra l'overlay di caricamento (`AppLoader`, in `app.vue`) per la durata
della chiamata. Non usarlo per il polling della classifica.

### Pagine collegate al backend

- `game.vue`: all'apertura legge lo stato dal DB (`getTeamState`); se la squadra è nuova estrae la
  prima missione. Le azioni (`completeMission`, `drawMission`, `skipMission`,
  `redrawSkippedMission`) passano da `withLoader`. Ogni 10 secondi, con la scheda visibile,
  allinea stato, pausa del gioco e posizione, così più telefoni della stessa squadra restano
  coerenti. Nel telefono restano solo il punto della missione (iniziata/prova) e la bozza del testo.
- **Salto di Vince**: i primi 4 tocchi sono la presa in giro, al 5° Vince cede e la missione cambia
  davvero (`SKIP_AFTER_CLICKS` in `game.vue`). Finite le missioni nuove la squadra può riprenderne
  una scartata (a scelta o a caso).
- Video: si controllano durata (max 10 s) e peso (max 20 MB) prima dell'upload.
- `classifica.vue`: `getLeaderboard()` ogni 5 secondi, con loader solo al primo caricamento. Dal gioco il
  link porta `?team=N`: la classifica evidenzia la squadra ("VOI") e mostra in basso
  "TORNA ALLA MISSIONE". Aperta senza parametro (proiettore, tablet) è la classifica pubblica e basta.

## Setup

Requisiti: Node, e un runtime di container (Docker o Podman) per il DB locale.

```bash
npm install
cp .env.example .env   # poi compila i valori
```

Variabili (`.env`, e nelle env di Netlify per il deploy):

| Variabile | Uso |
| --- | --- |
| `NUXT_PUBLIC_SUPABASE_URL` | URL del progetto Supabase |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | Chiave anon (pubblica per design: la sicurezza è nelle RLS) |

La chiave `service_role` non va mai messa nel frontend.

### Sviluppo

```bash
npm run dev:all    # tutto in un comando, in locale
npm run dev        # solo Nuxt (usa il Supabase del tuo .env, per esempio il cloud)
```

`dev:all` avvia il Supabase locale (se non è già acceso), applica le migrations nuove senza
cancellare i dati, carica i PIN di prova (`marco` = 1111, `irenegade` = 9999 da
`supabase/seed.sql`, solo locale) e lancia Nuxt puntato al DB locale, ignorando il `.env`.
Quando hai finito: `npm run db:stop`. Per ripartire da zero: `npm run db:reset`.

### Database locale

```bash
npm run db:start   # avvia Supabase in locale (Postgres, API, Storage)
npm run db:reset   # riapplica le migrations da zero
npm run db:stop
```

Con Podman, `docker` deve già puntare al socket di Podman. `db:start` esclude i servizi
non necessari (auth, realtime, studio, ...) per risparmiare RAM.

### Database cloud (Supabase gratuito)

```bash
npx supabase login
npm run db:link    # chiede project ref e password del DB
npm run db:push    # applica le migrations
```

I progetti gratuiti vanno in pausa dopo 7 giorni di inattività: apri il progetto il
giorno prima della festa.

## Aree admin (PIN)

Due pagine pensate per il telefono, tutte lato browser (il sito resta statico). Il PIN **non
sta nel codice**: lo verifica il database a ogni azione (i PIN sono salvati come hash), quindi
non si legge dal JavaScript del sito. Non c'è una chiamata di login a parte: il PIN viene
validato dalla prima chiamata vera. Dopo 8 PIN errati in 10 minuti i tentativi vengono bloccati.

| Pagina | PIN | Cosa può fare |
| --- | --- | --- |
| `/mark30/admin` | Marco (o Irene) | Fermare il gioco o solo le nuove missioni; esportare foto e video |
| `/irenegade/admin` | Irene | Tutto quello di Marco + sbloccare squadre, assegnare missioni, annullare missioni completate, correggere i punti, azzerare una squadra o l'intero gioco, vedere il registro delle azioni |

Imposta i PIN dal SQL editor di Supabase (mai nel codice):

```sql
insert into public.admin_pins (role, pin_hash) values
  ('marco',     extensions.crypt('PIN_DI_MARCO',     extensions.gen_salt('bf'))),
  ('irenegade', extensions.crypt('PIN_DI_IRENEGADE', extensions.gen_salt('bf')))
on conflict (role) do update set pin_hash = excluded.pin_hash;
```

- **Pausa**: "Gioco" fermo blocca estrazioni, salti e completamenti; "Nuove missioni" ferme blocca
  solo estrazioni e salti. Le azioni di Irene funzionano anche in pausa. Le pagine di gioco
  leggono lo stato con `getGameStatus()`.
- **Squadra bloccata**: `Sblocca squadra` toglie la missione attiva (torna disponibile) e ne
  assegna un'altra. Le squadre ferme sulla stessa missione da più di 20 minuti sono evidenziate.
- **Annulla missione completata**: tolgono i punti e la missione torna disponibile. La prova resta
  nello Storage e nel registro.
- **Spazio** (solo Irene): la dimensione dei file viene letta da `storage.objects` (non si salva
  nulla di nuovo). Mostra usato/limite con barra, foto e video, file orfani (upload non conclusi o
  doppi), spazio per squadra e dimensione del database, con avviso dal 70% (giallo) e dal 90%
  (rosso). Il limite (1 GiB) sta in `game_settings.storage_limit_bytes`: cambialo dal SQL editor se
  passi a un piano a pagamento. L'export mostra anche il peso di ogni squadra prima dello ZIP.
- **QR delle squadre** (solo Irene): la pagina li genera con l'indirizzo con cui è aperta (quindi
  sul dominio di Netlify puntano già al sito giusto). Per ogni squadra: schermo intero (da far
  inquadrare a un altro telefono), scarica SVG, copia link; e "stampa tutti". Avvisa se l'indirizzo
  è locale. In alternativa da terminale: `npm run qr -- https://il-tuo-sito`.
- **Stop al gioco**: con il gioco fermo le squadre vedono una schermata "STOP AL GIOCO — FERMI TUTTI"
  con posizione, punti e link alla classifica; riparte da sola entro 10 secondi dal riavvio. Con
  solo le nuove missioni ferme resta un avviso e si può finire quella in corso.
- **Reset prima della festa** (solo Irene, "ZONA PERICOLOSA"): "AZZERA TUTTO IL GIOCO" cancella missioni,
  punti e correzioni di tutte le squadre (squadre e missioni restano); "SVUOTA FOTO E VIDEO" elimina
  i file di prova dallo Storage (via Storage API: Supabase vieta di cancellarli da SQL). Entrambi
  chiedono una **doppia conferma**: prima si scrive la parola (RESET / ELIMINA), poi un'ultima conferma
  con il riepilogo di cosa si perde. Dopo il reset il gioco propone di eliminare anche le prove.
  Il registro delle azioni non viene cancellato.
- **Esportazione** (`ProofExport`): uno ZIP per squadra con file dai nomi leggibili + `prove.csv`
  (anche i testi), creato nel browser. Il download dei file usa un header `x-admin-pin` che la
  policy dello Storage verifica nel DB: **da provare con `db:start` e un upload vero prima della
  festa**. Se lo Storage non esponesse l'header, il piano B è una Edge Function di Supabase.
- Consiglio: fai un'esportazione anche a metà festa, come copia di sicurezza.

## Test

```bash
npm test           # Vitest: funzioni in app/api e callRpc (senza DB)
npm run test:db    # pgTAP: regole del DB (avvia il DB locale e lo resetta)
npm run test:all   # entrambi
```

- `tests/` contiene i test del frontend, con Supabase simulato.
- `supabase/tests/database/` contiene i test pgTAP: punti, idempotenza, missione unica,
  validazione delle prove, classifica e permessi del ruolo `anon`.

## Messa online (prima demo)

Servono un progetto Supabase e un sito Netlify, entrambi gratuiti. Le variabili Nuxt sono
**incorporate nella build**: se le cambi, rifai il deploy.

### 1. Supabase

1. [supabase.com](https://supabase.com) > New project. **Regione europea** (Frankfurt): meno latenza
   e non si cambia dopo. Salva la password del database.
2. Project Settings > API: copia **Project URL** e la chiave **anon public**.
3. Dal terminale, nella cartella del progetto:
   ```bash
   npx supabase login        # apre il browser
   npm run db:link           # chiede il project ref (nell'URL del progetto) e la password del DB
   npm run db:push           # applica tutte le migrations
   ```
4. SQL editor: imposta i due PIN veri (vedi "Aree admin"). Le migrations non li creano.
5. Controlla: Table editor > `teams` (9 righe) e `missions` (60); Storage > bucket `proofs` (privato).

### 2. Netlify

1. Add new site > Import from GitHub > scegli il repository, branch `main`. Build e cartella
   di pubblicazione arrivano da `netlify.toml`.
2. Site configuration > Environment variables:
   - `NUXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NUXT_PUBLIC_SUPABASE_ANON_KEY` = chiave anon
3. Deploy. Per un nome più bello: Site configuration > Change site name.

### 3. Verifica rapida

1. `https://<sito>.netlify.app/classifica` mostra le 9 squadre a 0 punti.
2. `/irenegade/admin` con il PIN di Irene: sezione QR delle squadre (generati con l'indirizzo del sito).
3. Da un telefono, inquadra il QR di una squadra e fai una missione con foto.
4. Torna in `/irenegade/admin`: spazio usato, missione completata, classifica aggiornata.
5. `/mark30/admin`: prova a fermare il gioco e guarda il telefono della squadra.

### 4. Prima del gioco vero

Dopo i test: `/irenegade/admin` > ZONA PERICOLOSA > **AZZERA TUTTO IL GIOCO** e **SVUOTA FOTO E VIDEO**
(doppia conferma). Squadre e missioni restano.

## Build e deploy (dettagli)

```bash
npm run generate   # build statica in .output/public
npm run preview
```

`netlify.toml` imposta Node 22 e l'header `noindex` (il sito è privato). `public/_redirects` serve il
fallback SPA per le rotte dinamiche come `/play/7`.

## Prima della festa

1. Creare il progetto Supabase e applicare le migrations.
2. Impostare le env su Netlify e fare il deploy.
3. Generare i QR: `npm run qr -- https://il-tuo-sito.netlify.app` crea `qr/team-N.svg` e una pagina
   `qr/stampa.html` da stampare (2 squadre per riga, livello di correzione alto). La cartella `qr/` non
   è nel repository: dipende dal dominio.
4. Provare con più telefoni, una missione con foto inclusa.
5. Azzerare le missioni di prova (`team_missions`) prima di iniziare.
6. Dopo la festa: scaricare le prove dal bucket `proofs` (dashboard o service key).
