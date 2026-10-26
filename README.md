# ITS Olivetti Quest

## Avvio rapido (Windows)

1. Installate [Node.js](https://nodejs.org) (versione LTS), una volta sola.
2. Fate **doppio clic su `AVVIA-GIOCO.bat`**: la prima volta installa le librerie,
   poi accende il gioco e lo apre nel browser su http://localhost:3000.
3. **Non chiudete la finestra nera** finché state giocando: è il server del gioco.

Se aprite `public/index.html` con un doppio clic (senza server), il gioco funziona
lo stesso, ma la classifica viene salvata solo su quel dispositivo e un avviso lo
segnala. Per la classifica condivisa usate sempre `AVVIA-GIOCO.bat`.

Gioco nel browser per scoprire i corsi di ITS Academy Adriano Olivetti.
Ogni squadra inserisce un nome e gioca 5 livelli. Ogni livello raggruppa corsi
affini e propone un minigioco con domande sulle competenze trasversali (lavoro in
team, comunicazione, problem solving...). Dopo ogni livello compaiono la
spiegazione e la sede di ciascun corso del gruppo.
Alla fine il punteggio entra nella classifica del giorno, visibile a tutti.

| Livello | Corsi | Minigioco |
|---|---|---|
| 1 | Sicurezza informatica e reti | Quiz a tempo (5 domande) |
| 2 | Sviluppo software e cloud | Quiz a tempo (5 domande) |
| 3 | Dati e intelligenza artificiale | Memory: 8 coppie competenza/descrizione |
| 4 | Audio, video e mondi immersivi | Acchiappa le qualità giuste, evita le intruse ingannevoli |
| 5 | Marketing, contenuti e moda | Indovina la parola: 4 parole lunghe |

Le competenze delle domande sono quelle citate più spesso nelle pagine dei corsi su
itsolivetti.it. Le domande **non richiedono conoscenze tecniche**: sono situazioni che capitano in
qualsiasi lavoro o progetto di gruppo (scadenze, errori, clienti, litigi nel team,
critiche, notizie da verificare). Così chi è interessato al marketing può rispondere
anche nei livelli di informatica, e viceversa. Il livello è medio: le risposte
sbagliate sono plausibili, quindi bisogna ragionare.
Nel quiz l'ordine delle risposte viene mescolato a ogni partita.

Ogni elemento indovinato (domanda, coppia, parola) vale fino a 150 punti:
100 più un bonus che cresce con la velocità.

**Vite**: si parte con 3 cuori (nella barra blu, tra il nome della squadra e i punti).
Ogni errore costa una vita: risposta sbagliata o tempo scaduto nel quiz, tempo
scaduto nel memory, parola intrusa colpita, parola non indovinata. Un livello
perfetto (3 stelle) regala una vita in più, fino a un massimo di 5. Finite le vite
compare "Vite esaurite" con il pulsante per continuare con 3 nuove vite, così nessuno
resta bloccato e tutti vedono le schede di tutti i corsi.

## Grafica e dispositivi

- **Tema scuro "vetro"**: sfondo blu notte con aloni di luce, card semitrasparenti,
  sfumatura blu → viola (`#0F4FF1` → `#A151D9`, colori del sito ITS Olivetti) su
  pulsanti, fasce e carte del memory, rosso `#FF1243` per vite e accenti, font **Sora**.
  Tutti i colori sono in cima a `public/style.css` (`:root`): per cambiarli basta
  modificare quelle righe.
- **Pensato per presentare**: barra in alto blu scuro con il nome dell'ITS e il
  pulsante **⛶ Schermo intero** (per il proiettore); fascia blu in cima a ogni card
  con punteggio e livello; schede dei corsi con intestazione blu. Sugli schermi
  molto grandi (da 1400px, es. proiettore) i testi diventano più grandi, per
  leggerli anche dal fondo della sala.
- **Elementi di gioco**:
  - Sotto il punteggio, la riga con *numero e titolo del livello*.
  - *Mappa dei livelli* prima di ogni livello, con sotto la *barra di avanzamento*:
    tappe completate con le stelle, livello attuale evidenziato, livelli bloccati.
  - *Stelle* a fine livello (0-3 in base ai punti fatti) e totale a fine partita.
  - *Effetti sonori* generati dal browser (nessun file audio); il pulsante
    🔊/🔇 a sinistra del titolo del livello li spegne.
  - Pulsante *Salta ⏭* a destra del titolo durante i minigiochi (doppio clic per
    confermare): porta alle schede dei corsi, la parte saltata vale 0 punti.
- **Telefono e tablet**: layout a una colonna, pulsanti grandi da toccare.
- **Computer** (schermi da 900px in su): layout largo, risposte del quiz su 2
  colonne, schede dei corsi affiancate, memory e tastiera dell'impiccato più grandi.
  Si gioca anche solo con la tastiera: **Invio** per i pulsanti principali, **1-4**
  per rispondere al quiz, **lettere** per l'impiccato.

## Come funziona

- **Frontend**: HTML/CSS/JS "vanilla", senza framework, nella cartella `public/`.
- **Backend**: un piccolo server Node.js + Express (`server.js`) che serve il sito
  statico ed espone le API per classifica e impostazioni.
- **Dati classifica**: salvati sul server in `data/scores.json`. La classifica
  mostra solo le partite giocate **nel giorno corrente** (fuso orario Europa/Roma).
  Se il server non risponde, i punteggi vengono salvati nel browser
  (`public/js/local-scores.js`) e la classifica mostra quelli del dispositivo.
- **Filtro nomi**: `public/js/profanity.js` blocca i nomi squadra volgari o offensivi
  (italiano + inglese, comprese le varianti con numeri al posto delle lettere, tipo
  "c4zz0"). Il controllo avviene sia nel browser (feedback immediato) sia sul
  server, che è l'unico a decidere: modificando il browser non si aggira.

## Pannello admin: tempo per rispondere

Solo l'organizzatore può cambiare il tempo base dei minigiochi (da 5 a 120
secondi, predefinito 20). Ogni minigioco lo usa così:

- **Quiz**: tempo per ogni domanda.
- **Memory**: tempo base × numero di coppie (minimo 30 secondi).
- **Acchiappa le parole**: più tempo = parole più lente (da 2,5 a 10 secondi di caduta).
- **Indovina la parola**: il doppio del tempo base per ogni parola (minimo 20 secondi).

- **Come entrare**: nella pagina iniziale scrivete **`daddala`** come nome della squadra
  e premete *Inizia*: si apre il pannello admin già autenticato (vanno bene anche
  maiuscole, es. "Daddala"). In alternativa aprite `/admin.html` e scrivete la parola.
- Dal pannello si cambia il tempo con −5 / −1 / +1 / +5, si preme *Salva* e poi
  *Torna al gioco*.
- La parola segreta resta **solo sul server** (non compare nel codice delle pagine).
  Per cambiarla impostate la variabile d'ambiente **`ADMIN_PASSWORD`** sul server.
- Dopo 5 parole sbagliate dallo stesso dispositivo l'accesso si blocca per 10 minuti,
  e il controllo dei nomi accetta al massimo 30 tentativi al minuto per dispositivo.
- La modifica vale dal livello successivo, anche per chi sta già giocando.
- Il bonus velocità è proporzionale al tempo: il punteggio massimo non cambia
  se allungate o accorciate il timer.

## Avvio in locale (per provare prima dell'evento)

Serve [Node.js](https://nodejs.org) installato (versione 18 o superiore).

```bash
npm install
```

```bash
npm start
```

Poi aprite http://localhost:3000 nel browser.

## Aggiornare i corsi

Tutti i contenuti (livelli, competenze in comune, minigiochi con le loro
domande/parole, nome/descrizione/sede di ogni corso) stanno in un unico file:

```
public/js/courses.js
```

Per cambiare il minigioco di un livello basta modificare il campo `gioco`
(`"quiz"`, `"memory"`, `"acchiappa"` o `"impiccato"`) e scrivere i dati di quel tipo:
il formato di ciascuno è spiegato nel commento in cima al file.

I dati vengono da https://itsolivetti.it/corso/ (biennio 2026-28): sono i 21 corsi
con pre-iscrizioni aperte. 3D Art Specialist è escluso perché ha le iscrizioni chiuse.
21 non si divide per 4, quindi l'ultimo livello ha 5 corsi.
Prima di un nuovo open day ricontrollate il sito e aggiornate il file se qualcosa è cambiato.

## Pubblicare il gioco online (accessibile da più dispositivi)

Il modo più semplice e gratuito è [Render.com](https://render.com):

1. Create un repository Git (es. su GitHub) con tutto il contenuto di questa
   cartella. Il file `.gitignore` esclude già `node_modules` e i dati di test.
2. Su Render: **New +** -> **Web Service** -> collegate il repository.
3. Impostazioni:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment** -> aggiungete `ADMIN_PASSWORD` con una password scelta da voi
     (lunga e non banale; non scrivetela nel codice né nel repository).
4. Deploy. Render vi darà un indirizzo tipo `https://its-olivetti-quest.onrender.com`
   da condividere (per esempio con un QR code) durante l'open day.
   Il pannello admin sarà su `https://.../admin.html`.

Alternative equivalenti: [Railway.app](https://railway.app), [Fly.io](https://fly.io).

**Nota sul piano gratuito**: sui piani gratuiti il server può "addormentarsi"
dopo un periodo di inattività, e i file in `data/` (classifica e tempo impostato)
possono azzerarsi a ogni nuovo deploy. Per un evento di un giorno non è un
problema: basta non rifare il deploy a metà giornata.

## Struttura del progetto

```
server.js              Server Express + API classifica e admin
store.js               Salvataggio/lettura punteggi su data/scores.json
settings.js            Tempo di risposta salvato su data/settings.json
public/
  index.html           Schermata iniziale (nome squadra)
  game.html            Schermata di gioco (5 livelli)
  leaderboard.html     Classifica del giorno
  admin.html           Pannello admin (tempo di risposta)
  style.css            Stile grafico retrò/arcade
  js/
    courses.js         Livelli, minigiochi e corsi (da aggiornare ogni anno)
    profanity.js       Filtro nomi volgari (client + server)
    app.js             Logica della schermata iniziale
    game.js            Motore di gioco (livelli, vite, punteggio, quiz)
    minigames.js       Memory, Acchiappa le parole, Indovina la parola
    leaderboard.js     Rendering della classifica
    admin.js           Logica del pannello admin
```
