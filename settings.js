const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(require("./data-dir.js"), "settings.json");

const MIN_QUESTION_TIME_SEC = 5;
const MAX_QUESTION_TIME_SEC = 120;
const DEFAULTS = { questionTimeSec: 20 };

let settings = { ...DEFAULTS };

function load() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      settings = { ...DEFAULTS, ...saved };
    }
  } catch (err) {
    console.error("Impossibile leggere data/settings.json, uso i valori predefiniti:", err.message);
    settings = { ...DEFAULTS };
  }
}

function persist() {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}

function get() {
  return { ...settings };
}

function setQuestionTimeSec(value) {
  settings.questionTimeSec = value;
  persist();
  return get();
}

load();

module.exports = {
  get,
  setQuestionTimeSec,
  MIN_QUESTION_TIME_SEC,
  MAX_QUESTION_TIME_SEC,
};
