# Marco's 30th — The Birthday Games

Gioco a squadre per il 30° compleanno di Marco: 9 squadre, 50 missioni da completare
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
| `/play/{teamId}` | Ingresso del Game Phone di una squadra (il QR punta qui) |
| `/play/{teamId}/game` | Missioni e prove |
| `/classifica` | Classifica live |
| `/export` | Esportazione delle prove (solo admin, pensata per il telefono) |

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

### Database

Tabelle: `teams`, `missions`, `team_missions` (assegnazione + completion).
Squadre e missioni sono caricate dalla migration (seed generato da `app/datas/`).

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

> Stato attuale: backend e funzioni in `app/api/` sono pronti, ma `game.vue` e
> `classifica.vue` usano ancora `localStorage` e vanno collegati.

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
npm run dev        # http://localhost:3000
```

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

## Esportazione delle prove (`/export`)

Pagina pensata per il telefono, tutta lato browser (il sito resta statico). Dopo il login
mostra le squadre con il numero di file e permette di scaricare uno **ZIP per squadra**
(file con nomi leggibili + `prove.csv`) e l'**indice CSV** completo, con anche i testi.

Accesso protetto da Supabase Auth: un solo utente admin.

1. Dashboard Supabase > Authentication: **disabilita le registrazioni** e crea a mano
   l'utente admin (email + password).
2. Nel SQL editor: `insert into public.admins (email) values ('tua@email.it');`
3. Apri `/export` dal telefono e accedi.

Solo chi è in `admins` può elencare le prove e scaricare i file del bucket (policy RLS).
Consiglio: fai un'esportazione anche a metà festa, come copia di sicurezza.

## Test

```bash
npm test           # Vitest: funzioni in app/api e callRpc (senza DB)
npm run test:db    # pgTAP: regole del DB (avvia il DB locale e lo resetta)
npm run test:all   # entrambi
```

- `tests/` contiene i test del frontend, con Supabase simulato.
- `supabase/tests/database/` contiene i test pgTAP: punti, idempotenza, missione unica,
  validazione delle prove, classifica e permessi del ruolo `anon`.

## Build e deploy

```bash
npm run generate   # build statica in .output/public
npm run preview
```

Su Netlify: build `npm run generate`, publish `.output/public` (già in `netlify.toml`).
`public/_redirects` serve il fallback SPA per le rotte dinamiche come `/play/7`.

## Prima della festa

1. Creare il progetto Supabase e applicare le migrations.
2. Impostare le env su Netlify e fare il deploy.
3. Generare un QR per squadra che punta a `/play/{teamId}` sul dominio definitivo.
4. Provare con più telefoni, una missione con foto inclusa.
5. Azzerare le missioni di prova (`team_missions`) prima di iniziare.
6. Dopo la festa: scaricare le prove dal bucket `proofs` (dashboard o service key).
