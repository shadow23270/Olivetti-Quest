/*
 * Regole dei punti, uguali per il browser (game.js, minigames.js) e per il
 * server (server.js, che le usa per scartare i punteggi impossibili).
 * Ogni elemento indovinato vale 100 punti + un bonus velocità fino a 100 in base
 * al tempo rimasto (chi risponde subito prende il doppio di chi risponde allo
 * scadere): il massimo resta 200 qualunque sia il tempo scelto dall'admin.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Scoring = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const BASE_POINTS = 100;
  const MAX_TIME_BONUS = 100;
  const MAX_POINTS_PER_ITEM = BASE_POINTS + MAX_TIME_BONUS;
  // Stelle in base alla percentuale dei punti massimi del livello.
  const THREE_STARS_RATIO = 0.8;
  const TWO_STARS_RATIO = 0.5;
  // Stelle minime per superare un livello (sotto si riprova).
  const PASS_STARS = 2;
  // Punti tolti a chi salta un livello dopo non averlo superato.
  const SKIP_PENALTY = 150;

  // Quanti elementi danno punti in un livello, in base al tipo di minigioco.
  function scoredItems(level) {
    switch (level.gioco) {
      case "quiz":
        // Si gioca solo una parte delle domande, pescate a caso a ogni partita.
        return Math.min(level.quiz.length, level.domandePerPartita || level.quiz.length);
      case "memory":
        return level.coppie.length;
      case "acchiappa":
        return level.parole.giuste.length;
      case "impiccato":
        return level.parole.length;
      default:
        throw new Error(`Tipo di gioco sconosciuto nel livello "${level.id}": ${level.gioco}`);
    }
  }

  // Bonus velocità; fraction = tempo rimasto, tra 0 e 1.
  function speedBonus(fraction) {
    const f = Math.max(0, Math.min(1, fraction));
    return Math.round(f * MAX_TIME_BONUS);
  }

  // Punti per un elemento indovinato: base + bonus velocità.
  function itemPoints(fraction) {
    return BASE_POINTS + speedBonus(fraction);
  }

  function maxLevelScore(level) {
    return scoredItems(level) * MAX_POINTS_PER_ITEM;
  }

  function maxScore(levels) {
    return levels.reduce((sum, level) => sum + maxLevelScore(level), 0);
  }

  // Stelle del livello (0-3) in base alla percentuale dei punti massimi.
  function starsFor(levelPoints, level) {
    const ratio = levelPoints / maxLevelScore(level);
    if (ratio >= THREE_STARS_RATIO) return 3;
    if (ratio >= TWO_STARS_RATIO) return 2;
    if (levelPoints > 0) return 1;
    return 0;
  }

  // Punti minimi per superare il livello (= quelli per PASS_STARS stelle).
  function passPoints(level) {
    return Math.ceil(maxLevelScore(level) * TWO_STARS_RATIO);
  }

  return {
    PASS_STARS,
    SKIP_PENALTY,
    passPoints,
    speedBonus,
    BASE_POINTS,
    MAX_TIME_BONUS,
    MAX_POINTS_PER_ITEM,
    scoredItems,
    itemPoints,
    maxScore,
    starsFor,
  };
});
