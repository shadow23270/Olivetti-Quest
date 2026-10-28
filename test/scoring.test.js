/* Test della logica condivisa tra browser e server (test runner nativo di Node,
 * nessuna dipendenza: si avviano con `npm test`):
 *   - scoring.js   -> punti massimi, bonus velocità, stelle e soglie di passaggio;
 *   - profanity.js -> controllo dei nomi squadra (volgarità e tentativi di aggirarlo).
 * I valori attesi sono dedotti dai DATI dei livelli (courses.js) o da livelli
 * sintetici costruiti qui, così il confronto non è circolare con scoring.js. */

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const Scoring = require("../public/js/scoring.js");
const ProfanityFilter = require("../public/js/profanity.js");
const ITS_LEVELS = require("../public/js/courses.js");

const { BASE_POINTS, MAX_TIME_BONUS, MAX_POINTS_PER_ITEM, PASS_STARS } = Scoring;

// Quanti elementi danno punti in un livello, dedotti dai DATI del livello.
function itemDaDati(level) {
  switch (level.gioco) {
    case "quiz":
      // Si giocano al massimo domandePerPartita domande pescate a caso.
      return Math.min(level.quiz.length, level.domandePerPartita || level.quiz.length);
    case "memory":
      return level.coppie.length;
    case "acchiappa":
      return level.parole.giuste.length;
    case "impiccato":
      return level.parole.length;
    default:
      throw new Error(`gioco sconosciuto nei dati di test: ${level.gioco}`);
  }
}

// Livello quiz sintetico: n domande -> massimo n * MAX_POINTS_PER_ITEM.
function livelloQuiz(quante, perPartita = quante) {
  const quiz = Array.from({ length: quante }, (_, i) => ({
    domanda: `domanda ${i}`,
    opzioni: ["a", "b"],
    corretta: 0,
  }));
  return { id: "test-quiz", gioco: "quiz", quiz, domandePerPartita: perPartita };
}

describe("scoring: costanti e punti per elemento", () => {
  test("100 punti di base + 100 di bonus velocità = 200 a elemento", () => {
    assert.equal(BASE_POINTS, 100);
    assert.equal(MAX_TIME_BONUS, 100);
    assert.equal(MAX_POINTS_PER_ITEM, 200);
  });

  test("bonus velocità e punti dell'elemento, con i valori estremi ristretti a 0..1", () => {
    assert.equal(Scoring.speedBonus(0), 0);
    assert.equal(Scoring.speedBonus(1), 100);
    assert.equal(Scoring.speedBonus(-1), 0); // sotto zero: niente bonus
    assert.equal(Scoring.speedBonus(1.5), 100); // oltre uno: al massimo
    assert.equal(Scoring.itemPoints(0), 100);
    assert.equal(Scoring.itemPoints(1), 200);
  });
});

describe("scoring: maxScore per livello e per partita", () => {
  test("ogni livello reale vale elementi × 200, dedotti dai suoi dati", () => {
    for (const level of ITS_LEVELS) {
      const attesi = itemDaDati(level);
      assert.equal(Scoring.scoredItems(level), attesi, `elementi del livello "${level.id}"`);
      assert.equal(
        Scoring.maxScore([level]),
        attesi * MAX_POINTS_PER_ITEM,
        `punteggio massimo del livello "${level.id}"`
      );
    }
  });

  test("maxScore dell'intera partita = somma dei massimi dei livelli", () => {
    const somma = ITS_LEVELS.reduce((acc, level) => acc + Scoring.maxScore([level]), 0);
    assert.ok(somma > 0);
    assert.equal(Scoring.maxScore(ITS_LEVELS), somma);
  });

  test("quiz: domandePerPartita limita gli elementi che danno punti", () => {
    // 3 domande ma cap 5: contano solo le 3 presenti.
    assert.equal(Scoring.maxScore([livelloQuiz(3, 5)]), 3 * MAX_POINTS_PER_ITEM);
    // 7 domande con cap 5: contano solo 5.
    assert.equal(Scoring.maxScore([livelloQuiz(7, 5)]), 5 * MAX_POINTS_PER_ITEM);
    // Senza cap: contano tutte.
    const senza = livelloQuiz(4);
    delete senza.domandePerPartita;
    assert.equal(Scoring.maxScore([senza]), 4 * MAX_POINTS_PER_ITEM);
  });

  test("tipo di minigioco sconosciuto: errore, non un punteggio a caso", () => {
    assert.throws(() => Scoring.maxScore([{ id: "falso", gioco: "basket" }]), /sconosciuto/i);
  });
});

describe("scoring: stelle per livello", () => {
  // Livello da 3 domande = 600 punti massimi: le soglie cadono su numeri netti
  // (3 stelle da 480, 2 stelle da 300).
  const livello = livelloQuiz(3);

  test("soglie: 0.8 dei punti massimi = 3 stelle, 0.5 = 2, sopra zero = 1", () => {
    assert.equal(Scoring.starsFor(600, livello), 3);
    assert.equal(Scoring.starsFor(480, livello), 3); // soglia inclusa
    assert.equal(Scoring.starsFor(479, livello), 2);
    assert.equal(Scoring.starsFor(300, livello), 2); // soglia inclusa
    assert.equal(Scoring.starsFor(299, livello), 1);
    assert.equal(Scoring.starsFor(1, livello), 1);
    assert.equal(Scoring.starsFor(0, livello), 0);
    assert.equal(Scoring.starsFor(-150, livello), 0); // livello saltato con penalità
  });

  test("livelli reali: la soglia di passaggio dà 2 stelle, un punto in meno dà 1", () => {
    for (const level of ITS_LEVELS) {
      const pass = Scoring.passPoints(level);
      assert.equal(Scoring.starsFor(pass, level), 2, `passaggio di "${level.id}"`);
      assert.equal(Scoring.starsFor(pass - 1, level), 1, `sotto soglia di "${level.id}"`);
    }
  });

  test("livelli reali: la soglia delle 3 stelle è inclusa, un punto in meno dà 2", () => {
    for (const level of ITS_LEVELS) {
      const max = Scoring.maxScore([level]);
      const tre = Math.ceil(max * 0.8);
      assert.equal(Scoring.starsFor(tre, level), 3, `3 stelle di "${level.id}"`);
      assert.equal(Scoring.starsFor(tre - 1, level), 2, `appena sotto le 3 stelle di "${level.id}"`);
    }
  });

  test("chi supera il livello ha almeno PASS_STARS stelle, per costruzione", () => {
    for (const level of ITS_LEVELS) {
      assert.ok(Scoring.starsFor(Scoring.passPoints(level), level) >= PASS_STARS, level.id);
    }
  });
});

describe("profanity: isClean sui nomi squadra", () => {
  test("nomi normali e con accenti passano", () => {
    assert.deepEqual(ProfanityFilter.isClean("I Pixel Furiosi"), { ok: true });
    assert.deepEqual(ProfanityFilter.isClean("Squadra 42"), { ok: true });
    assert.deepEqual(ProfanityFilter.isClean("Perché Noi"), { ok: true });
  });

  test("lunghezza: almeno 2 caratteri, al massimo 24", () => {
    assert.equal(ProfanityFilter.isClean("A").ok, false);
    assert.equal(ProfanityFilter.isClean("x").ok, false);
    assert.equal(ProfanityFilter.isClean("x".repeat(25)).ok, false);
    assert.equal(ProfanityFilter.isClean("x".repeat(24)).ok, true);
  });

  test("deve contenere almeno una lettera o un numero", () => {
    const r = ProfanityFilter.isClean("!!!@@@");
    assert.equal(r.ok, false);
    assert.ok(r.reason.length > 0);
  });

  test("volgarità diretta, in maiuscolo e con accenti", () => {
    for (const nome of ["squadra cazzo", "STRONZI", "porcodio", "vaffanculo team"]) {
      assert.equal(ProfanityFilter.isClean(nome).ok, false, `bloccato: ${nome}`);
    }
  });

  test("tentativi comuni di aggirare il filtro", () => {
    for (const nome of ["c4zz0 team", "c.a.z.z.o", "caaaazzooo", "càzzo", "$ega"]) {
      assert.equal(ProfanityFilter.isClean(nome).ok, false, `bloccato: ${nome}`);
    }
  });

  test("parole innocenti che contengono una parola bloccata solo come parola intera", () => {
    // "sega" e "culo" sono bloccate solo come parole intere: qui non lo sono.
    assert.equal(ProfanityFilter.isClean("Segale").ok, true);
    assert.equal(ProfanityFilter.isClean("culosi").ok, true);
    // da sole invece sì
    assert.equal(ProfanityFilter.isClean("La Sega").ok, false);
  });
});
