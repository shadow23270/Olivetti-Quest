/* Token di partita (anti-cheat): prima di giocare, il server firma con HMAC-SHA256
 * un token che contiene nome squadra e momento d'inizio (vedi /api/start-game).
 * All'invio del punteggio (/api/score) il server riverifica la firma e controlla
 * che la sessione sia durata un tempo plausibile: punteggi senza token, col nome
 * cambiato, con partite troppo brevi o con token scaduti vengono scartati.
 * Solo moduli nativi (crypto, fs): nessuna dipendenza in più. */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const DATA_DIR = require("./data-dir.js");

const SECRET_FILE = path.join(DATA_DIR, "token-secret");

// Sessione più corta di così non è una partita: un token usato subito dopo
// essere stato firmato è un punteggio inventato via API. (Chi salta tutti i
// livelli a velocità record e viene rifiutato può ripremere "Invia" dopo
// qualche secondo: il token resta valido.)
const MIN_SESSION_MS = 10 * 1000;

// Il gioco dura al massimo 3 ore (limite di durationMs in server.js) e dopo
// l'ultimo livello si possono leggere le schede dei corsi con calma: 4 ore.
const MAX_SESSION_MS = 4 * 60 * 60 * 1000;

// L'orologio del computer o del telefono può essere fuori fase rispetto al
// server: la durata dichiarata può superare di poco quella passata davvero
// senza essere un inganno. Oltre questo margine no.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

// Chiave della firma: SCORE_SECRET se impostata (indispensabile su Vercel, dove
// girano più copie del server), altrimenti una chiave a caso conservata su
// file, così il riavvio del server locale non invalida le partite in corso.
function loadSecret() {
  if (process.env.SCORE_SECRET) {
    return Buffer.from(process.env.SCORE_SECRET, "utf8");
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const saved = fs.readFileSync(SECRET_FILE, "utf8").trim();
      if (saved) return Buffer.from(saved, "hex");
    }
    const fresh = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SECRET_FILE, fresh, "utf8");
    return Buffer.from(fresh, "hex");
  } catch (err) {
    console.error(
      `Impossibile conservare il segreto dei token su ${path.basename(SECRET_FILE)} (${err.message}): al riavvio del server i token delle partite in corso non sono più validi.`
    );
    return crypto.randomBytes(32);
  }
}

const secret = loadSecret();

if (process.env.VERCEL && !process.env.SCORE_SECRET) {
  console.error(
    "SCORE_SECRET non impostata: le copie del server su Vercel hanno segreti diversi e qualche punteggio legittimo può essere rifiutato. Impostate SCORE_SECRET tra le variabili d'ambiente del progetto su Vercel."
  );
}

function sign(payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest();
}

// Firma e restituisce il token della partita appena avviata:
// payload JSON in base64url, punto, firma in base64url.
function issue(name) {
  const payload = Buffer.from(JSON.stringify({ name, startMs: Date.now() }), "utf8");
  return `${payload.toString("base64url")}.${sign(payload).toString("base64url")}`;
}

// Controlla il token inviato col punteggio: { ok: true, startMs } se la firma
// corrisponde, il nome è quello firmato all'inizio e la sessione ha una durata
// plausibile; { ok: false } in qualsiasi altro caso.
function verify(token, name) {
  if (typeof token !== "string" || !token.trim()) return { ok: false };

  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false };

  const payload = Buffer.from(token.slice(0, dot), "base64url");
  const signature = Buffer.from(token.slice(dot + 1), "base64url");
  // La firma è di 32 byte: lunghezza diversa = token inventato. Il controllo
  // arriva prima di timingSafeEqual, che richiede lunghezze uguali e allora
  // confronta sempre nello stesso tempo.
  if (signature.length !== 32) return { ok: false };
  if (!crypto.timingSafeEqual(signature, sign(payload))) return { ok: false };

  let data;
  try {
    data = JSON.parse(payload.toString("utf8"));
  } catch (err) {
    return { ok: false };
  }
  if (
    !data ||
    typeof data.name !== "string" ||
    typeof data.startMs !== "number" ||
    !Number.isFinite(data.startMs)
  ) {
    return { ok: false };
  }

  const elapsed = Date.now() - data.startMs;
  if (elapsed < MIN_SESSION_MS || elapsed > MAX_SESSION_MS) return { ok: false };

  // Deve inviare la stessa squadra che ha avviato la partita.
  if (String(name || "").trim() !== data.name) return { ok: false };

  return { ok: true, startMs: data.startMs };
}

module.exports = { issue, verify, MIN_SESSION_MS, MAX_SESSION_MS, CLOCK_SKEW_MS };
