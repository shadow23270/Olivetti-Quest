# ITS Olivetti Quest

Gioco web per l'open day di ITS Academy Adriano Olivetti: le squadre giocano 5 livelli
(ognuno raggruppa corsi affini), con minigiochi sulle competenze trasversali; dopo ogni
livello vengono mostrati descrizione e sede dei corsi. Classifica del giorno condivisa.
Tutti i testi del gioco sono in italiano.

## Avvio
- Windows: doppio clic su `AVVIA-GIOCO.bat` (installa, avvia, apre http://localhost:3000).
- Oppure: `npm install`, poi `npm start`.
- Modalità admin: scrivere la parola segreta come nome squadra (predefinita `daddala`,
  sovrascrivibile con la variabile d'ambiente `ADMIN_PASSWORD`). Resta solo sul server:
  non metterla nel codice di `public/`.

## Online (Vercel)
- Pubblicato su https://olivetti-quest.vercel.app (progetto Vercel `olivetti-quest`,
  collegato al repository GitHub `shadow23270/Olivetti-Quest`: ogni push su `master`
  ripubblica il sito).
- Su Vercel `server.js` viene importato come funzione (esporta `app`; `listen` solo se
  avviato con `node server.js`).
- Salvataggio (`store.js`, `settings.js`): se ci sono le variabili di Upstash Redis
  (`KV_REST_API_URL`/`KV_REST_API_TOKEN` o `UPSTASH_REDIS_REST_URL`/`_TOKEN`, aggiunte da
  Vercel collegando il database) usa Redis tramite `redis.js` (API REST, nessuna
  dipendenza; un hash per giorno, una voce per partita; `REDIS_PREFIX` per prove).
  Altrimenti usa i file in `data/` (su Vercel `/tmp`, temporaneo e non condiviso tra le
  copie del server: classifica non affidabile finché Redis non è collegato).
- Sul PC (`AVVIA-GIOCO.bat`) la classifica è sempre condivisa: un solo server, un file.
- La pagina classifica si aggiorna da sola ogni 5 secondi (`leaderboard.js`).

## Struttura
- `server.js` – Express: file statici + API (`/api/check-name`, `/api/score`,
  `/api/leaderboard`, `/api/settings`, `/api/admin/login`, `/api/admin/settings`,
  `/api/admin/scores`, `/api/admin/scores/delete`, `/api/admin/reset`).
  L'admin può eliminare singole squadre e azzerare la classifica di oggi (prima
  dell'azzeramento viene salvata una copia `data/scores.backup-<ora>.json`).
  Valida i punteggi con le regole di `public/js/scoring.js`. In locale non si fida di
  `X-Forwarded-For` (solo su Render/Railway o con `TRUST_PROXY` impostata).
- `store.js` / `settings.js` – classifica e tempo base salvati in `data/*.json`
  (scrittura atomica: file `.tmp` poi rinomina).
- `public/js/scoring.js` – regole dei punti (100 + bonus velocità fino a 100, stelle,
  punteggio massimo, soglia per superare il livello `PASS_STARS` = 2 stelle),
  condivise tra browser e server. Sotto soglia: schermata "Livello non superato" con
  Riprova (i punti del tentativo vengono annullati) o Salta (−`SKIP_PENALTY` = 150 punti,
  mostra i corsi; il punteggio non va sotto 0).
- Logo in `public/assets/`: `logo-its-olivetti.png` (originale), `logo-its-olivetti.svg`
  (vettoriale, nero per sfondi chiari) e `logo-its-olivetti-bianco.svg` (usato
  nell'intestazione scura di tutte le pagine). Contiene già la scritta del nome.
- Pannello admin: ingranaggio in alto a destra in home e classifica (nascosto sotto
  520px, così i telefoni dei visitatori non lo vedono), oppure parola segreta come nome
  squadra, oppure `/admin.html`. Non c'è nella pagina di gioco per non uscire a metà.
- `public/js/utils.js` – `escapeHtml`, `formatDuration`, `todayKey`, condivise tra
  pagine e server.
- `public/js/courses.js` – livelli, minigiochi (quiz, memory, acchiappa, impiccato) e corsi
  con sedi. Fonte: itsolivetti.it/corso. Usato anche dal server per i limiti di punteggio.
- `public/js/game.js` – motore: HUD (vite, punti, livello), mappa, stelle, vite, salto
  livello, schermata finale. I timer dei minigiochi passano dallo "scope" del livello
  (`ctx.later`, `ctx.every`, `ctx.listen`) così il pulsante Salta li ferma tutti.
- `public/js/minigames.js` – memory, acchiappa le parole, impiccato.
- `public/js/icons.js` – icone SVG incorporate da Lucide (licenza ISC): `Icons.svg(nome)`.
  Niente emoji nel gioco: per un'icona nuova aggiungere il disegno Lucide in `PATHS`.
  Il campo `icona` dei livelli in `courses.js` è il nome di un'icona.
- Quiz: ogni partita pesca a caso `domandePerPartita` domande dall'elenco del livello
  (il punteggio massimo dipende da `domandePerPartita`, non dalla lunghezza dell'elenco).
- `public/js/profanity.js` – filtro nomi volgari, usato sia dal browser sia dal server.
- `public/js/local-scores.js` – classifica di riserva nel browser se il server non risponde.
- `public/style.css` – tema scuro; tutti i token in `:root` (colori semantici oklch,
  scala tipografica fluida con `clamp()`, spazi, raggi, tempi delle animazioni).
  Layout per telefono, computer (≥900px) e proiettore (≥1400px); i testi crescono da
  soli, i breakpoint cambiano solo l'impaginazione. Animazioni solo con
  transform/opacity e spente con `prefers-reduced-motion`.

## Note per le modifiche
- Le domande devono restare comprensibili a chiunque (niente conoscenze tecniche).
- Dopo modifiche al server riavviarlo; le pagine si aggiornano ricaricando.
- Per provare punteggi e funzioni admin senza sporcare la classifica vera: server di
  prova con dati separati, `PORT=3077 DATA_DIR=data-test node server.js` (configurazione
  `its-olivetti-quest-prova` in `.claude/launch.json`); poi cancellare `data-test/`.
