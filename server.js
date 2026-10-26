const path = require("path");
const crypto = require("crypto");
const express = require("express");
const ProfanityFilter = require("./public/js/profanity.js");
const ITS_LEVELS = require("./public/js/courses.js");
const Scoring = require("./public/js/scoring.js");
const store = require("./store.js");
const settings = require("./settings.js");

const app = express();
const PORT = process.env.PORT || 3000;

const TOTAL_LEVELS = ITS_LEVELS.length;
// Stesse regole dei punti usate dal browser (public/js/scoring.js).
const MAX_PLAUSIBLE_SCORE = Scoring.maxScore(ITS_LEVELS);
const MAX_DURATION_MS = 3 * 60 * 60 * 1000; // 3 ore, oltre è chiaramente anomalo

// Parola segreta dell'admin: scritta come nome della squadra nella pagina iniziale
// apre il pannello admin (si può anche usare come password in /admin.html).
// Predefinita: "daddala". Per cambiarla impostate la variabile d'ambiente
// ADMIN_PASSWORD. Resta solo sul server: non compare nel codice delle pagine.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "daddala";
if (!process.env.ADMIN_PASSWORD) {
  console.log('Parola segreta admin: quella predefinita (per cambiarla impostate ADMIN_PASSWORD).');
}

// Blocco dei tentativi: dopo 5 password sbagliate lo stesso IP aspetta 10 minuti.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000;
const failedAttempts = new Map();

// Confronto senza distinzione tra maiuscole e minuscole (dal telefono capita
// di scrivere "Daddala"), a tempo costante.
function passwordMatches(candidate) {
  const a = crypto.createHash("sha256").update(String(candidate || "").trim().toLowerCase()).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD.trim().toLowerCase()).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  const ip = req.ip;
  const record = failedAttempts.get(ip);
  if (record && record.lockedUntil > Date.now()) {
    const minutes = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    return res
      .status(429)
      .json({ ok: false, reason: `Troppi tentativi errati. Riprova tra ${minutes} minuti.` });
  }

  if (!passwordMatches(req.get("x-admin-password"))) {
    const lockExpired = record && record.lockedUntil && record.lockedUntil <= Date.now();
    const fails = (record && !lockExpired ? record.fails : 0) + 1;
    failedAttempts.set(ip, {
      fails,
      lockedUntil: fails >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
    });
    return res.status(401).json({ ok: false, reason: "Parola segreta errata." });
  }

  failedAttempts.delete(ip);
  next();
}

// Su Render/Railway l'IP reale arriva dal proxy. In locale invece l'intestazione
// X-Forwarded-For la può scrivere chiunque: fidarsene permetterebbe di cambiare
// IP a ogni tentativo e aggirare il blocco della parola segreta.
if (process.env.TRUST_PROXY || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL) {
  app.set("trust proxy", 1);
}
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Limite di richieste per il controllo del nome: evita che qualcuno provi a
// indovinare la parola segreta inviando migliaia di nomi.
const CHECK_NAME_LIMIT = 30; // richieste al minuto per dispositivo
const checkNameHits = new Map();

function tooManyChecks(ip) {
  const now = Date.now();
  const recent = (checkNameHits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  checkNameHits.set(ip, recent);
  return recent.length > CHECK_NAME_LIMIT;
}

// Pulizia periodica: gli IP che non scrivono da un minuto non servono più.
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of checkNameHits) {
    if (hits.every((t) => now - t >= 60000)) checkNameHits.delete(ip);
  }
  for (const [ip, record] of failedAttempts) {
    if (record.lockedUntil && record.lockedUntil <= now) failedAttempts.delete(ip);
  }
}, 5 * 60 * 1000).unref();

app.post("/api/check-name", (req, res) => {
  if (tooManyChecks(req.ip)) {
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
  const { name, score, levelsCompleted, durationMs } = req.body || {};

  const nameCheck = ProfanityFilter.isClean(name);
  if (!nameCheck.ok) {
    return res.status(400).json({ ok: false, reason: nameCheck.reason });
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
    durationMs > MAX_DURATION_MS
  ) {
    return res.status(400).json({ ok: false, reason: "Durata partita non valida." });
  }

  const entry = await store.addScore({
    name: String(name).trim(),
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

// Su Vercel l'app viene importata ed eseguita come funzione: niente listen.
module.exports = app;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`ITS Olivetti Quest in ascolto su http://localhost:${PORT}`);
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
