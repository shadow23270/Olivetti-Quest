/* Classifica di riserva salvata nel browser (localStorage).
 * Si usa solo quando il server non risponde: per esempio se index.html viene
 * aperto con un doppio clic invece che da http://localhost:3000, o se il
 * server si spegne durante l'evento. In quel caso i punteggi restano solo
 * su questo dispositivo. */

(function () {
  const KEY = "its-quest-local-scores";
  const { todayKey } = window.Utils;

  function readAll() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  window.LocalScores = {
    save({ name, score, durationMs }) {
      const list = readAll();
      list.push({ name, score, durationMs, dayKey: todayKey() });
      try {
        localStorage.setItem(KEY, JSON.stringify(list));
      } catch (err) {
        // memoria del browser non disponibile: il punteggio non viene salvato
      }
    },
    // Stesso formato delle voci restituite da /api/leaderboard
    today() {
      const key = todayKey();
      return readAll()
        .filter((e) => e.dayKey === key)
        .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs)
        .map((e, i) => ({ rank: i + 1, name: e.name, score: e.score, durationMs: e.durationMs }));
    },
  };
})();
