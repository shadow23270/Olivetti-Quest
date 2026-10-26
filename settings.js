/* Impostazioni dell'admin (tempo base dei minigiochi): su Upstash Redis se
 * configurato (Vercel), altrimenti in data/settings.json. */

const fs = require("fs");
const path = require("path");
const redis = require("./redis.js");

const SETTINGS_FILE = path.join(require("./data-dir.js"), "settings.json");
const REDIS_KEY = redis.key("settings");

const MIN_QUESTION_TIME_SEC = 5;
const MAX_QUESTION_TIME_SEC = 120;
const DEFAULTS = { questionTimeSec: 20 };

let fileSettings = { ...DEFAULTS };

function loadFile() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      fileSettings = { ...DEFAULTS, ...saved };
    }
  } catch (err) {
    console.error("Impossibile leggere data/settings.json, uso i valori predefiniti:", err.message);
    fileSettings = { ...DEFAULTS };
  }
}

async function get() {
  if (!redis.enabled) return { ...fileSettings };
  const raw = await redis.command("GET", REDIS_KEY);
  try {
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

async function setQuestionTimeSec(value) {
  const next = { ...(await get()), questionTimeSec: value };
  if (redis.enabled) {
    await redis.command("SET", REDIS_KEY, JSON.stringify(next));
  } else {
    fileSettings = next;
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(fileSettings, null, 2), "utf8");
  }
  return next;
}

if (!redis.enabled) loadFile();

module.exports = {
  get,
  setQuestionTimeSec,
  MIN_QUESTION_TIME_SEC,
  MAX_QUESTION_TIME_SEC,
};
