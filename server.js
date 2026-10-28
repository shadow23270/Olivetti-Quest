const path = require("path");
const crypto = require("crypto");
const os = require("os");
const express = require("express");
const ProfanityFilter = require("./public/js/profanity.js");
const ITS_LEVELS = require("./public/js/courses.js");
const Scoring = require("./public/js/scoring.js");
const store = require("./store.js");
const settings = require("./settings.js");
const gameToken = require("./game-token.js");

const app = express();
const PORT = process.env.PORT || 3000;

const TOTAL_LEVELS = ITS_LEVELS.length;
// Stesse regole dei punti usate dal browser (public/js/scoring.js).
const MAX_PLAUSIBLE_SCORE = Scoring.maxScore(ITS_LEVELS);
const MAX_DURATION_MS = 3 * 60 * 60 * 1000; // 3 ore, oltre è chiaramente anomalo

// Parola segreta dell'admin: scritta come nome della squadra nella pagina iniziale
// apre il pannello admin (si può anche usare come password in /admin.html).
// È fissa, decisa con l'organizzatore: serve a non dare a chi guarda l'open day i
// comandi dell'organizzatore, non a fermare chi conosce questo repository.
// Resta solo sul server: non compare nel codice delle pagine.
const ADMIN_PASSWORD = "daddala";

// Confronto senza distinzione tra maiuscole e minuscole (dal telefono capita
// di scrivere "Daddala"), a tempo costante.
function passwordMatches(candidate) {
  const a = crypto.createHash("sha256").update(String(candidate || "").trim().toLowerCase()).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD.trim().toLowerCase()).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (!passwordMatches(req.get("x-admin-password"))) {
    return res.status(401).json({ ok: false, reason: "Parola segreta errata." });
  }
  next();
}

// Su Render/Railway l'IP reale arriva dal proxy. In locale invece l'intestazione
// X-Forwarded-For la può scrivere chiunque: fidarsene permetterebbe di cambiare
// IP a ogni richiesta e aggirare i limiti di frequenza per dispositivo.
if (process.env.TRUST_PROXY || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL) {
  app.set("trust proxy", 1);
}

// Header di sicurezza di base su tutte le risposte: il browser non deve indovinare
// i tipi dei file (nosniff) e le pagine del gioco non si possono incorniciare in un
// altro sito (same-origin frame, anti-clickjacking).
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Limite di richieste: ogni endpoint ha il suo contatore per dispositivo (IP),
// che blocca le chiamate oltre una soglia al minuto.
function createRateLimiter(maxPerMinute) {
  const hits = new Map();

  function tooMany(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > maxPerMinute;
  }

  // Pulizia periodica: gli IP che non richiedono da un minuto non servono più.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of hits) {
      if (times.every((t) => now - t >= 60000)) hits.delete(ip);
    }
  }, 5 * 60 * 1000).unref();

  return { tooMany };
}

// Controllo del nome: 30 richieste al minuto per dispositivo, limite anti-spam
// (il nome viene comunque controllato di nuovo su /api/score).
const checkNameLimiter = createRateLimiter(30);

// Avvio della partita: una squadra ne fa uno solo, margine largo per i picchi.
const startGameLimiter = createRateLimiter(30);

// Invio dei punteggi: una squadra vera ne manda uno solo. 12 al minuto per
// dispositivo assorbono i picchi (più squadre sulla stessa rete del luogo)
// e bloccano lo spam di voci inventate in classifica.
const scoreLimiter = createRateLimiter(12);

app.post("/api/check-name", (req, res) => {
  if (checkNameLimiter.tooMany(req.ip)) {
    return res.status(429).json({ ok: false, reason: "Troppi tentativi, aspetta un minuto." });
  }
  const { name } = req.body || {};
  // Parola segreta come nome squadra: il browser apre il pannello admin.
  if (passwordMatches(String(name || "").trim())) {
    return res.json({ ok: true, admin: true });
  }
  const result = ProfanityFilter.isClean(name);
  res.json(result);
});

// Gli errori di salvataggio (es. Redis non raggiungibile) diventano un messaggio
// chiaro invece di bloccare la richiesta.
const handle = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(err);
    res.status(500).json({ ok: false, reason: "Errore del server, riprova tra poco." });
  });

// Firma il token che autorizza l'invio del punteggio: contiene nome squadra e
// momento d'inizio, verificati da /api/score (vedi game-token.js).
app.post("/api/start-game", handle(async (req, res) => {
  if (startGameLimiter.tooMany(req.ip)) {
    return res.status(429).json({ ok: false, reason: "Troppi avvii di partita, aspetta un minuto." });
  }
  const { name } = req.body || {};
  const check = ProfanityFilter.isClean(name);
  if (!check.ok) {
    return res.status(400).json({ ok: false, reason: check.reason });
  }
  res.json({ ok: true, token: gameToken.issue(String(name).trim()) });
}));

app.get("/api/settings", handle(async (req, res) => {
  res.json({ ok: true, questionTimeSec: (await settings.get()).questionTimeSec });
}));

app.post("/api/admin/login", requireAdmin, handle(async (req, res) => {
  res.json({
    ok: true,
    settings: await settings.get(),
    limits: { min: settings.MIN_QUESTION_TIME_SEC, max: settings.MAX_QUESTION_TIME_SEC },
  });
}));

app.post("/api/admin/settings", requireAdmin, handle(async (req, res) => {
  const { questionTimeSec } = req.body || {};
  if (
    !Number.isInteger(questionTimeSec) ||
    questionTimeSec < settings.MIN_QUESTION_TIME_SEC ||
    questionTimeSec > settings.MAX_QUESTION_TIME_SEC
  ) {
    return res.status(400).json({
      ok: false,
      reason: `Il tempo deve essere un numero intero tra ${settings.MIN_QUESTION_TIME_SEC} e ${settings.MAX_QUESTION_TIME_SEC} secondi.`,
    });
  }
  res.json({ ok: true, settings: await settings.setQuestionTimeSec(questionTimeSec) });
}));

// Classifica di oggi con gli id, per eliminare le singole partite.
app.post("/api/admin/scores", requireAdmin, handle(async (req, res) => {
  res.json({ ok: true, entries: await store.getTodayLeaderboard(1000) });
}));

app.post("/api/admin/scores/delete", requireAdmin, handle(async (req, res) => {
  const { id } = req.body || {};
  if (typeof id !== "string" || !(await store.deleteScore(id))) {
    return res.status(404).json({ ok: false, reason: "Partita non trovata (forse già eliminata)." });
  }
  res.json({ ok: true });
}));

app.post("/api/admin/reset", requireAdmin, handle(async (req, res) => {
  res.json({ ok: true, removed: await store.resetToday() });
}));

app.post("/api/score", handle(async (req, res) => {
  if (scoreLimiter.tooMany(req.ip)) {
    return res.status(429).json({ ok: false, reason: "Troppi punteggi inviati: aspetta un minuto." });
  }

  const { name, score, levelsCompleted, durationMs, token } = req.body || {};

  const nameCheck = ProfanityFilter.isClean(name);
  if (!nameCheck.ok) {
    return res.status(400).json({ ok: false, reason: nameCheck.reason });
  }

  const playerName = String(name).trim();

  // Il punteggio vale solo con il token firmato da /api/start-game: senza firma
  // valida, col nome cambiato o con una sessione impossibile, si scarta.
  const checkToken = gameToken.verify(token, playerName);
  if (!checkToken.ok) {
    return res.status(401).json({ ok: false, reason: "Token di partita mancante o non valido." });
  }

  if (
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_PLAUSIBLE_SCORE
  ) {
    return res.status(400).json({ ok: false, reason: "Punteggio non valido." });
  }

  if (
    !Number.isInteger(levelsCompleted) ||
    levelsCompleted < 0 ||
    levelsCompleted > TOTAL_LEVELS
  ) {
    return res.status(400).json({ ok: false, reason: "Livelli completati non validi." });
  }

  if (
    typeof durationMs !== "number" ||
    !Number.isFinite(durationMs) ||
    durationMs < 0 ||
    durationMs > MAX_DURATION_MS ||
    // La durata dichiarata non può superare il tempo passato davvero da quando
    // la partita è stata firmata (con un margine per l'orologio del client
    // fuori fase: vedi CLOCK_SKEW_MS in game-token.js).
    durationMs > Date.now() - checkToken.startMs + gameToken.CLOCK_SKEW_MS
  ) {
    return res.status(400).json({ ok: false, reason: "Durata partita non valida." });
  }

  const entry = await store.addScore({
    name: playerName,
    score,
    levelsCompleted,
    durationMs,
  });

  res.json({ ok: true, entry });
}));

app.get("/api/leaderboard", handle(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
  // La classifica viene riletta spesso (si aggiorna da sola): mai dalla cache.
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, entries: await store.getTodayLeaderboard(limit) });
}));

// Primo indirizzo di rete del computer (quello che i telefoni nella stessa
// rete possono aprire), mostrato in grande sulla pagina classifica quando
// questa è aperta su "localhost". Su Vercel gli indirizzi interni della
// funzione non sarebbero quelli pubblici: si risponde null e la pagina mostra
// il dominio che ha nella sua barra degli indirizzi.
function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list) {
      if (net.family === "IPv4" && !net.internal) {
        return `http://${net.address}:${PORT}`;
      }
    }
  }
  return null;
}

app.get("/api/address", (req, res) => {
  res.json({ ok: true, address: process.env.VERCEL ? null : lanAddress() });
});

// Su Vercel l'app viene importata ed eseguita come funzione: niente listen.
module.exports = app;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`ITS Olivetti Quest in ascolto su http://localhost:${PORT}`);
    const lan = lanAddress();
    if (lan) console.log(`Indirizzo per i telefoni nella stessa rete: ${lan}`);
    console.log(`Classifica salvata su: ${store.kind}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\nLa porta ${PORT} è già occupata: probabilmente il gioco è già acceso.`);
      console.error(`Aprite http://localhost:${PORT} nel browser, oppure chiudete l'altra finestra del gioco e riprovate.\n`);
      process.exit(1);
    }
    throw err;
  });
}
