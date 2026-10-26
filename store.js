const fs = require("fs");
const path = require("path");
const { todayKey } = require("./public/js/utils.js");

// DATA_DIR permette di provare il gioco con dati separati (vedi CLAUDE.md).
const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || "data");
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

function addScore({ name, score, levelsCompleted, durationMs }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    score,
    levelsCompleted,
    durationMs,
    createdAt: new Date().toISOString(),
    dayKey: todayKey(),
  };
  scores.push(entry);
  persist();
  return entry;
}

// Elimina una partita (pannello admin). Restituisce false se non esiste.
function deleteScore(id) {
  const index = scores.findIndex((e) => e.id === id);
  if (index < 0) return false;
  scores.splice(index, 1);
  persist();
  return true;
}

// Azzera la classifica di oggi (nuovo open day o prova finita). Prima salva una
// copia completa in data/, così un azzeramento per sbaglio si può recuperare.
function resetToday() {
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
}

function getTodayLeaderboard(limit = 100) {
  const key = todayKey();
  return scores
    .filter((e) => e.dayKey === key)
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

load();

module.exports = { addScore, getTodayLeaderboard, deleteScore, resetToday };
