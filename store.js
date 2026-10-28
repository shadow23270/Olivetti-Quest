/* Classifica: salvata su Upstash Redis se configurato (Vercel), altrimenti in
 * data/scores.json (PC dell'open day). Tutte le funzioni sono asincrone e
 * hanno lo stesso comportamento con i due sistemi; i punteggi più vecchi di 30
 * giorni (PRUNE_DAYS, solo file) vengono potati al riavvio e a ogni aggiunta. */

const fs = require("fs");
const path = require("path");
const { todayKey } = require("./public/js/utils.js");
const DATA_DIR = require("./data-dir.js");
const redis = require("./redis.js");

const BACKUP_DAYS = 30; // per quanto tempo Redis tiene le copie degli azzeramenti

// I punteggi di più di 30 giorni fa non sono più visibili da nessuna parte:
// potati a ogni aggiunta e al riavvio, il file resta piccolo anche se il
// server gira a lungo. (Su Redis ogni giorno è un hash a parte: si lasciano.)
const PRUNE_DAYS = 30;
const PRUNE_MS = PRUNE_DAYS * 24 * 60 * 60 * 1000;

// Restano i punteggi con una corretta data di creazione recente: le voci rovinate
// o antiche vengono scartate davanti.
function recentEnough(entry) {
  const at = Date.parse(entry.createdAt || "");
  return Number.isFinite(at) && at >= Date.now() - PRUNE_MS;
}

function newEntry({ name, score, levelsCompleted, durationMs }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    score,
    levelsCompleted,
    durationMs,
    createdAt: new Date().toISOString(),
    dayKey: todayKey(),
  };
}

// Ordina per punti (poi per tempo) e numera le posizioni.
function rank(entries, limit) {
  return entries
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs)
    .slice(0, limit)
    .map((e, i) => ({
      id: e.id,
      rank: i + 1,
      name: e.name,
      score: e.score,
      levelsCompleted: e.levelsCompleted,
      durationMs: e.durationMs,
      createdAt: e.createdAt,
    }));
}

// ---------- Redis: un hash per giorno, campo = id della partita ----------
// Ogni partita è un campo separato: due squadre che finiscono nello stesso
// istante non si sovrascrivono a vicenda.

function createRedisStore() {
  const dayKey = () => redis.key(`scores:${todayKey()}`);

  async function todayEntries() {
    const flat = (await redis.command("HGETALL", dayKey())) || [];
    const entries = [];
    for (let i = 1; i < flat.length; i += 2) {
      try {
        entries.push(JSON.parse(flat[i]));
      } catch (err) {
        // voce rovinata: la saltiamo
      }
    }
    return entries;
  }

  return {
    kind: "Upstash Redis",
    async addScore(data) {
      const entry = newEntry(data);
      await redis.command("HSET", dayKey(), entry.id, JSON.stringify(entry));
      return entry;
    },
    async getTodayLeaderboard(limit = 100) {
      return rank(await todayEntries(), limit);
    },
    async deleteScore(id) {
      return (await redis.command("HDEL", dayKey(), id)) > 0;
    },
    // La classifica di oggi viene rinominata in una copia che scade dopo 30 giorni.
    async resetToday() {
      const key = dayKey();
      const removed = await redis.command("HLEN", key);
      if (removed > 0) {
        const backup = redis.key(`backup:${todayKey()}:${Date.now()}`);
        await redis.command("RENAME", key, backup);
        await redis.command("EXPIRE", backup, BACKUP_DAYS * 24 * 60 * 60);
      }
      return removed;
    },
  };
}

// ---------- File: data/scores.json ----------

function createFileStore() {
  const DATA_FILE = path.join(DATA_DIR, "scores.json");
  let scores = [];

  function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf8");
    }
  }

  function load() {
    ensureDataFile();
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      scores = JSON.parse(raw);
      if (!Array.isArray(scores)) throw new Error("il file non contiene una lista");
      // All'avvio si potano i punteggi vecchi: se cambiano qualcosa si riscrive subito.
      const before = scores.length;
      pruneOld();
      if (scores.length !== before) persist();
    } catch (err) {
      // Il file rovinato viene messo da parte prima che il prossimo punteggio lo
      // sovrascriva, così la classifica si può ancora recuperare a mano.
      const backup = DATA_FILE.replace(/\.json$/, `.rovinato-${Date.now()}.json`);
      try {
        fs.copyFileSync(DATA_FILE, backup);
      } catch (copyErr) {
        // niente da salvare
      }
      console.error(
        `Impossibile leggere data/scores.json (${err.message}): copia in ${path.basename(backup)}, riparto da lista vuota.`
      );
      scores = [];
    }
  }

  // Scrittura atomica: prima un file temporaneo, poi la rinomina. Se il computer
  // si spegne a metà, scores.json resta quello di prima invece di rovinarsi.
  function persist() {
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(scores, null, 2), "utf8");
    fs.renameSync(tmp, DATA_FILE);
  }

  // Via i punteggi oltre la finestra di 30 giorni: si chiama a ogni aggiunta,
  // così il pruning non deve aspettare il riavvio.
  function pruneOld() {
    scores = scores.filter(recentEnough);
  }

  load();

  return {
    kind: "file data/scores.json",
    async addScore(data) {
      const entry = newEntry(data);
      pruneOld();
      scores.push(entry);
      persist();
      return entry;
    },
    async getTodayLeaderboard(limit = 100) {
      const key = todayKey();
      return rank(
        scores.filter((e) => e.dayKey === key),
        limit
      );
    },
    async deleteScore(id) {
      const index = scores.findIndex((e) => e.id === id);
      if (index < 0) return false;
      scores.splice(index, 1);
      persist();
      return true;
    },
    // Azzera la classifica di oggi (nuovo open day o prova finita). Prima salva una
    // copia completa in data/, così un azzeramento per sbaglio si può recuperare.
    async resetToday() {
      const key = todayKey();
      const removed = scores.filter((e) => e.dayKey === key).length;
      if (removed > 0) {
        fs.writeFileSync(
          path.join(DATA_DIR, `scores.backup-${Date.now()}.json`),
          JSON.stringify(scores, null, 2),
          "utf8"
        );
        scores = scores.filter((e) => e.dayKey !== key);
        persist();
      }
      return removed;
    },
  };
}

module.exports = redis.enabled ? createRedisStore() : createFileStore();
