/* Motore di gioco: sequenza di livelli (ognuno raggruppa corsi con argomenti in
 * comune). Ogni livello ha un minigioco diverso (quiz, memory, acchiappa,
 * impiccato: vedi il campo "gioco" in courses.js). Dopo ogni livello vengono
 * mostrate spiegazione e sede di ogni corso del gruppo; alla fine il punteggio
 * va nella classifica del giorno.
 * Il tempo base è deciso dall'admin (admin.html) e letto dal server: ogni
 * minigioco lo usa a modo suo (vedi le "regole" di ciascuno). */

(function () {
  const DEFAULT_BASE_TIME_MS = 20000;
  const FEEDBACK_PAUSE_MS = 1300;
  const MAX_LIVES = 3; // vite iniziali; con 3 stelle in un livello se ne guadagna una (fino a 5)
  const LIVES_CAP = 5;

  const app = document.getElementById("app");
  const teamName = sessionStorage.getItem("its-quest-team");

  if (!teamName) {
    window.location.href = "index.html";
    return;
  }

  const state = {
    levelIndex: 0,
    lives: MAX_LIVES,
    score: 0,
    startedAt: Date.now(),
    baseTimeMs: DEFAULT_BASE_TIME_MS,
    levelStartScore: 0,
    stars: [], // stelle (0-3) ottenute in ogni livello
  };

  const totalLevels = ITS_LEVELS.length;
  const sfx = window.Sfx;
  const { escapeHtml, formatDuration } = window.Utils;
  const { itemPoints, speedBonus, starsFor, scoredItems, PASS_STARS, SKIP_PENALTY, passPoints } =
    window.Scoring;
  const Icons = window.Icons;
  const SKIP_LABEL = `Salta ${Icons.svg("skipForward")}`;

  // Pulsante audio (altoparlante acceso/spento) nella riga dei cuori (ridisegnato con l'HUD, quindi
  // il clic è gestito sull'intero #app).
  app.addEventListener("click", (e) => {
    const btn = e.target.closest("#sound-btn");
    if (!btn) return;
    const muted = sfx.toggle();
    btn.innerHTML = Icons.svg(muted ? "volumeOff" : "volumeOn");
    btn.setAttribute("aria-label", muted ? "Audio spento" : "Audio acceso");
    sfx.click();
  });

  function starsHtml(count, cls = "") {
    return `<span class="stars ${cls}" aria-label="${count} stelle su 3">${[0, 1, 2]
      .map((i) => `<span class="star ${i < count ? "on" : "off"}">${Icons.svg("star")}</span>`)
      .join("")}</span>`;
  }

  // Mappa dei livelli in stile videogioco: tappe completate, attuale e bloccate.
  function mapHtml(currentIndex) {
    const nodes = ITS_LEVELS.map((level, i) => {
      const status = i < currentIndex ? "done" : i === currentIndex ? "current" : "locked";
      const content = Icons.svg(status === "locked" ? "lock" : level.icona);
      const below =
        status === "done"
          ? starsHtml(state.stars[i] || 0, "stars--small")
          : `<span class="map-label">${escapeHtml(level.breve)}</span>`;
      return `
        <div class="map-node ${status}">
          ${status === "current" ? `<span class="map-player">${Icons.svg("chevronDown")}</span>` : ""}
          <span class="map-dot">${content}</span>
          ${below}
        </div>`;
    });
    return `<div class="level-map" role="img" aria-label="Mappa dei livelli: livello ${Math.min(
      currentIndex + 1,
      totalLevels
    )} di ${totalLevels}">${nodes.join(`<span class="map-path"></span>`)}</div>`;
  }

  function currentLevel() {
    return ITS_LEVELS[state.levelIndex];
  }

  // Riletto a ogni livello, così una modifica dell'admin vale subito anche
  // per le squadre che stanno già giocando.
  async function refreshBaseTime() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.ok && Number.isInteger(data.questionTimeSec)) {
        state.baseTimeMs = data.questionTimeSec * 1000;
      }
    } catch (err) {
      // Server non raggiungibile: si continua con l'ultimo valore noto.
    }
  }

  // ---------- Elementi comuni a tutti i minigiochi ----------

  function hudInnerHtml() {
    const level = currentLevel();
    // Il pulsante SALTA compare solo mentre un minigioco è in corso (non sulla
    // schermata "Vite esaurite": saltando da lì si ripartirebbe con 0 vite).
    // Lo stato "armato" è in skipArmed, così sopravvive ai ridisegni dell'HUD.
    const skip =
      scope && scope.alive && !gameOverShown
        ? `<button type="button" class="skip-btn ${skipArmed ? "armed" : ""}" id="skip-btn" title="Salta il minigioco e vai ai corsi">${
            skipArmed ? "Confermi?" : SKIP_LABEL
          }</button>`
        : "";
    return `
      <div class="hud">
        <span class="hud-team">${escapeHtml(teamName)}</span>
        ${livesHtml()}
        <span class="hud-score" aria-live="polite">PUNTI: ${state.score}</span>
      </div>
      <div class="level-bar">
        ${soundButtonHtml()}
        <p class="level-bar-title">
          <span class="level-bar-number">Livello ${state.levelIndex + 1}</span>
          ${escapeHtml(level.titolo)}
        </p>
        ${skip}
      </div>
    `;
  }

  // Cuori delle vite: pieni quelli rimasti, vuoti quelli persi (minimo 3 posti).
  function livesHtml() {
    const slots = Math.max(MAX_LIVES, state.lives);
    const hearts = Array.from(
      { length: slots },
      (_, i) => `<span class="life ${i < state.lives ? "" : "lost"}">${Icons.heart()}</span>`
    ).join("");
    return `<span class="lives" id="lives" aria-label="Vite: ${state.lives}">${hearts}</span>`;
  }

  // Barra di avanzamento tra i livelli: va sotto le tappe della mappa.
  function progressHtml(completedLevels) {
    return `
      <div class="progress-track" role="progressbar" aria-label="Livelli completati"
        aria-valuemin="0" aria-valuemax="${totalLevels}" aria-valuenow="${completedLevels}">
        <div class="progress-fill" style="transform:scaleX(${completedLevels / totalLevels})"></div>
      </div>`;
  }

  function hudHtml() {
    // Ogni nuova schermata di gioco riparte dall'inizio della card (durante
    // il minigioco, quando serve, a scorrere è la card stessa, non la pagina).
    const cabinet = app.closest(".cabinet");
    if (cabinet) cabinet.scrollTop = 0;
    window.scrollTo(0, 0);
    return `<div id="hud">${hudInnerHtml()}</div>`;
  }

  function soundButtonHtml() {
    const muted = sfx.isMuted();
    return `<button type="button" class="sound-btn" id="sound-btn" title="Accendi/spegni i suoni" aria-label="${
      muted ? "Audio spento" : "Audio acceso"
    }">${Icons.svg(muted ? "volumeOff" : "volumeOn")}</button>`;
  }

  // Aggiorna i punti senza ridisegnare il minigioco (serve ai giochi in tempo reale).
  function updateHud() {
    const hud = document.getElementById("hud");
    if (hud) hud.innerHTML = hudInnerHtml();
  }

  // Scrive in el "+178 punti · velocità +78": si vede quanto conta rispondere in fretta.
  function showPoints(el, fraction) {
    if (!el) return;
    el.innerHTML = `+${itemPoints(fraction)} punti <span class="speed-bonus">velocità +${speedBonus(
      fraction
    )}</span>`;
  }

  function addPoints(points) {
    state.score += points;
    updateHud();
  }

  // Toglie una vita (con il cuore che trema) e restituisce quante ne restano.
  function damage() {
    state.lives = Math.max(0, state.lives - 1);
    updateHud();
    const lives = document.getElementById("lives");
    if (lives) lives.classList.add("hit");
    return state.lives;
  }

  // Se le vite sono finite mostra "Vite esaurite" con il pulsante per continuare
  // (così tutti arrivano a vedere i corsi), altrimenti prosegue subito con then().
  function continueOrGameOver(then) {
    if (state.lives > 0) {
      then();
      return;
    }
    sfx.gameOver();
    gameOverShown = true;
    app.innerHTML = `
      ${hudHtml()}
      <div class="game-over">
        <p class="game-over-icon">${Icons.heartCrack()}</p>
        <h2 class="title title--small">Vite esaurite!</h2>
        <p class="center">La squadra ${escapeHtml(teamName)} ha finito le vite... ma la sfida continua.</p>
        <button class="btn-arcade mt-16" id="continue-btn">Continua con ${MAX_LIVES} nuove vite</button>
      </div>
    `;
    const continueBtn = document.getElementById("continue-btn");
    continueBtn.addEventListener("click", () => {
      gameOverShown = false;
      state.lives = MAX_LIVES;
      sfx.click();
      then();
    });
    focusButton(continueBtn);
  }

  function loseLife(then) {
    damage();
    continueOrGameOver(then);
  }

  // Sul computer il pulsante principale riceve il focus: basta premere Invio.
  function focusButton(btn) {
    btn.focus({ preventScroll: true });
  }

  // ---------- Ciclo di vita di un livello ----------
  // I minigiochi lasciano in giro timer, attese e ascoltatori della tastiera.
  // Li registrano tutti nello "scope" del livello in corso: quando il livello
  // finisce o viene saltato lo scope si chiude, e niente di vecchio può più
  // ridisegnare lo schermo (per esempio una domanda sopra le schede dei corsi).
  let scope = null;
  let gameOverShown = false;
  let skipArmed = false;
  let skipDisarmTimeout = null;

  function openScope() {
    closeScope();
    // Minigioco attivo: la pagina non scorre (niente scroll accidentali mentre
    // si tocca in fretta). Lo scroll torna al termine del livello (closeScope).
    document.body.classList.add("is-playing");
    const timeouts = new Set();
    const intervals = new Set();
    const listeners = [];
    const onCloseFns = [];
    let alive = true;

    scope = {
      get alive() {
        return alive;
      },
      later(fn, ms) {
        const id = setTimeout(() => {
          timeouts.delete(id);
          if (alive) fn();
        }, ms);
        timeouts.add(id);
        return id;
      },
      every(fn, ms) {
        const id = setInterval(() => {
          if (alive) fn();
        }, ms);
        intervals.add(id);
        return id;
      },
      stopEvery(id) {
        clearInterval(id);
        intervals.delete(id);
      },
      listen(target, type, fn) {
        target.addEventListener(type, fn);
        listeners.push([target, type, fn]);
      },
      unlisten(target, type, fn) {
        target.removeEventListener(type, fn);
        const i = listeners.findIndex(([t, ty, f]) => t === target && ty === type && f === fn);
        if (i >= 0) listeners.splice(i, 1);
      },
      onClose(fn) {
        onCloseFns.push(fn);
      },
      close() {
        alive = false;
        timeouts.forEach(clearTimeout);
        intervals.forEach(clearInterval);
        listeners.forEach(([target, type, fn]) => target.removeEventListener(type, fn));
        onCloseFns.forEach((fn) => fn());
      },
    };
    return scope;
  }

  function closeScope() {
    if (scope) {
      scope.close();
      scope = null;
    }
    document.body.classList.remove("is-playing");
    gameOverShown = false;
    setSkipArmed(false);
  }

  function setSkipArmed(armed) {
    skipArmed = armed;
    clearTimeout(skipDisarmTimeout);
    if (armed) skipDisarmTimeout = setTimeout(() => setSkipArmed(false), 3000);
    const btn = document.getElementById("skip-btn");
    if (btn) {
      btn.classList.toggle("armed", armed);
      btn.innerHTML = armed ? "Confermi?" : SKIP_LABEL;
    }
  }

  // Pulsante SALTA: un clic lo "arma", il secondo clic conferma (evita salti per sbaglio).
  // Il listener è sull'intero #app perché il pulsante viene ridisegnato spesso.
  app.addEventListener("click", (e) => {
    const btn = e.target.closest("#skip-btn");
    if (!btn || !scope) return;
    if (skipArmed) {
      closeScope();
      showCourseCards(true);
      return;
    }
    setSkipArmed(true);
  });

  // Barra del tempo: si svuota in durationMs e chiama onEnd quando arriva a zero.
  // Si accorcia con transform (non con width) così il browser non ricalcola il layout.
  function startTimer(fillEl, durationMs, onEnd) {
    const tickMs = 100;
    const s = scope;
    let left = durationMs;
    const id = s.every(() => {
      left -= tickMs;
      const fraction = Math.max(0, left / durationMs);
      fillEl.style.transform = `scaleX(${fraction})`;
      fillEl.classList.toggle("warn", fraction <= 0.5 && fraction > 0.2);
      fillEl.classList.toggle("danger", fraction <= 0.2);
      if (left <= 0) {
        s.stopEvery(id);
        onEnd();
      }
    }, tickMs);
    return {
      stop() {
        s.stopEvery(id);
      },
      remainingFraction() {
        return Math.max(0, left / durationMs);
      },
    };
  }

  function shuffle(items) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Minigioco: quiz a tempo ----------

  const quizGame = {
    nome: "QUIZ A TEMPO",
    regole(level, baseTimeMs) {
      return `Rispondi a ${scoredItems(level)} domande pescate a caso: hai ${baseTimeMs / 1000} secondi per ognuna.`;
    },
    play(ctx) {
      const { level } = ctx;
      // Ogni partita pesca a caso alcune domande (domandePerPartita) e le mescola.
      const questions = ctx.shuffle(level.quiz).slice(0, scoredItems(level));
      let questionIndex = 0;

      function showQuestion() {
        const q = questions[questionIndex];
        // Le risposte vengono mescolate a ogni partita, così la giusta non è sempre nella stessa posizione.
        const order = ctx.shuffle(q.opzioni.map((_, i) => i));
        const correctPos = order.indexOf(q.corretta);
        let answered = false;

        app.innerHTML = `
          ${ctx.hudHtml()}
          <p class="level-tag">Domanda ${questionIndex + 1} di ${questions.length}</p>
          <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill"></div></div>
          <p class="question">${escapeHtml(q.domanda)}</p>
          <div class="options">
            ${order
              .map(
                (optIndex, pos) =>
                  `<button class="option-btn" data-pos="${pos}"><span class="key-hint">${pos + 1}</span><span>${escapeHtml(q.opzioni[optIndex])}</span></button>`
              )
              .join("")}
          </div>
          <p class="answer-feedback" id="answer-feedback" aria-live="polite"></p>
          <p class="keyboard-tip">Dal computer puoi rispondere anche con i tasti 1-${q.opzioni.length}</p>
        `;

        const buttons = Array.from(app.querySelectorAll(".option-btn"));
        const timer = ctx.startTimer(document.getElementById("timer-fill"), ctx.baseTimeMs, () =>
          handleAnswer(-1)
        );

        function onKeyDown(e) {
          if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
          const pos = parseInt(e.key, 10) - 1;
          if (pos >= 0 && pos < buttons.length) handleAnswer(pos);
        }
        ctx.listen(document, "keydown", onKeyDown);

        // chosenPos = posizione a schermo del pulsante scelto (-1 se il tempo è scaduto).
        function handleAnswer(chosenPos) {
          if (answered) return;
          answered = true;
          timer.stop();
          ctx.unlisten(document, "keydown", onKeyDown);

          const correct = chosenPos === correctPos;
          buttons.forEach((btn) => (btn.disabled = true));
          buttons[correctPos].classList.add("correct");
          if (!correct && chosenPos >= 0) buttons[chosenPos].classList.add("wrong");

          // Risposta sbagliata o tempo scaduto: 0 punti e una vita in meno.
          if (correct) {
            ctx.sfx.correct();
            const fraction = timer.remainingFraction();
            ctx.addPoints(ctx.itemPoints(fraction));
            ctx.showPoints(document.getElementById("answer-feedback"), fraction);
          } else {
            ctx.sfx.wrong();
            ctx.damage();
          }

          ctx.later(() => ctx.continueOrGameOver(next), FEEDBACK_PAUSE_MS);
        }

        buttons.forEach((btn) => {
          btn.addEventListener("click", () => handleAnswer(parseInt(btn.dataset.pos, 10)));
        });
      }

      function next() {
        questionIndex += 1;
        if (questionIndex < questions.length) showQuestion();
        else ctx.finish();
      }

      showQuestion();
    },
  };

  const GAMES = { quiz: quizGame, ...window.Minigames };

  // ---------- Flusso dei livelli ----------

  async function showLevelIntro() {
    const level = currentLevel();
    const game = GAMES[level.gioco];

    app.innerHTML = `
      ${hudHtml()}
      ${mapHtml(state.levelIndex)}
      ${progressHtml(state.levelIndex)}
      <div class="intro-block">
        <p class="center">${escapeHtml(level.tema)}</p>
        <div class="minigame-banner">
          <p class="minigame-name">MINIGIOCO: ${escapeHtml(game.nome)}</p>
          <p class="minigame-rules" id="game-rules">Caricamento...</p>
        </div>
        <p class="center level-hint">${level.corsi.length} corsi da scoprire alla fine del livello – ogni errore costa una vita ${Icons.heart(
          "icon-inline"
        )} – servono almeno ${PASS_STARS} stelle per superarlo – 3 stelle = +1 vita</p>
      </div>
      <button class="btn-arcade mt-16" id="begin-level" disabled>Caricamento...</button>
    `;

    await refreshBaseTime();

    document.getElementById("game-rules").textContent = game.regole(level, state.baseTimeMs);
    const beginBtn = document.getElementById("begin-level");
    beginBtn.disabled = false;
    beginBtn.textContent = "Inizia il livello";
    focusButton(beginBtn);
    beginBtn.addEventListener(
      "click",
      () => {
        sfx.click();
        startLevel();
      },
      { once: true }
    );
  }

  // Avvia (o fa ripartire, dopo "Riprova") il minigioco del livello corrente.
  function startLevel() {
    const level = currentLevel();
    const game = GAMES[level.gioco];
    state.levelStartScore = state.score;
    const s = openScope();
    // Se il livello è stato saltato, le azioni rimaste in sospeso non fanno più nulla.
    const guard = (fn) => (...args) => (s.alive ? fn(...args) : undefined);
    game.play({
      app,
      level,
      baseTimeMs: state.baseTimeMs,
      escapeHtml,
      shuffle,
      hudHtml,
      itemPoints,
      showPoints,
      addPoints: guard(addPoints),
      damage: guard(damage),
      loseLife: guard(loseLife),
      continueOrGameOver: guard(continueOrGameOver),
      startTimer,
      sfx,
      later: s.later,
      every: s.every,
      stopEvery: s.stopEvery,
      listen: s.listen,
      unlisten: s.unlisten,
      onClose: s.onClose,
      finish: guard(finishLevel),
    });
  }

  // Fine del minigioco: si passa con almeno PASS_STARS stelle, altrimenti si riprova.
  function finishLevel() {
    const levelPoints = state.score - state.levelStartScore;
    const stars = starsFor(levelPoints, currentLevel());
    if (stars >= PASS_STARS) showCourseCards(false);
    else showLevelFailed(levelPoints, stars);
  }

  function showLevelFailed(levelPoints, stars) {
    closeScope();
    sfx.gameOver();
    // I punti del tentativo non valgono: riprovando si riparte da quelli di inizio
    // livello, così rigiocare non fa salire il punteggio oltre il massimo.
    state.score = state.levelStartScore;

    app.innerHTML = `
      ${hudHtml()}
      <div class="level-clear failed">
        <p class="level-clear-title">Livello non superato</p>
        ${starsHtml(stars, "stars--big")}
        <p class="level-clear-points">${levelPoints} punti su ${passPoints(currentLevel())} necessari</p>
        <p class="level-clear-hint">Servono almeno ${PASS_STARS} stelle per vedere i corsi e andare avanti. Ci riprovi?</p>
      </div>
      <button class="btn-arcade" id="retry-btn">${Icons.svg("rotateCcw")} Riprova il livello</button>
      <button class="btn-arcade secondary mt-16" id="skip-level-btn">Salta il livello (−${SKIP_PENALTY} punti)</button>
    `;
    window.scrollTo(0, 0);

    const retryBtn = document.getElementById("retry-btn");
    focusButton(retryBtn);
    retryBtn.addEventListener("click", () => {
      sfx.click();
      startLevel();
    });
    document.getElementById("skip-level-btn").addEventListener("click", () => {
      sfx.click();
      // Penalità per chi rinuncia dopo un livello non superato (il punteggio non va sotto 0).
      state.score = Math.max(0, state.score - SKIP_PENALTY);
      showCourseCards(true, true);
    });
  }

  // penalized: saltato dalla schermata "Livello non superato" (con penalità).
  function showCourseCards(skipped, penalized = false) {
    closeScope();
    const level = currentLevel();
    const isLast = state.levelIndex === totalLevels - 1;
    const levelPoints = state.score - state.levelStartScore;
    const stars = skipped ? 0 : starsFor(levelPoints, level);
    state.stars[state.levelIndex] = stars;
    if (!skipped) sfx.levelClear();

    // Vita bonus per un livello perfetto (3 stelle), fino a un massimo di 5.
    const bonusLife = stars === 3 && state.lives < LIVES_CAP;
    if (bonusLife) state.lives += 1;

    const cards = level.corsi
      .map(
        (corso) => `
        <div class="course-card">
          <h2>${escapeHtml(corso.nome)}</h2>
          <p>${escapeHtml(corso.descrizione)}</p>
          <p class="sedi-label">${corso.sedi.length > 1 ? "SEDI" : "SEDE"}</p>
          <div class="sedi-list">
            ${corso.sedi.map((s) => `<span class="sede-badge">${Icons.svg("mapPin")}${escapeHtml(s)}</span>`).join("")}
          </div>
        </div>
      `
      )
      .join("");

    app.innerHTML = `
      ${hudHtml()}
      <div class="level-clear ${skipped ? "skipped" : ""}">
        <p class="level-clear-title">${skipped ? "Livello saltato" : "Livello superato!"}</p>
        ${skipped ? "" : starsHtml(stars, "stars--big")}
        <p class="level-clear-points ${levelPoints < 0 ? "negative" : ""}">${levelPoints >= 0 ? "+" : "−"}${Math.abs(levelPoints)} punti</p>
        ${bonusLife ? `<p class="level-clear-bonus">Livello perfetto: +1 vita ${Icons.heart("icon-inline")}</p>` : ""}
      </div>
      <h2 class="course-name">I corsi di questo livello</h2>
      ${
        penalized
          ? `<p class="center level-hint">Hai saltato il livello dopo non averlo superato: −${SKIP_PENALTY} punti. Ecco comunque i corsi del livello.</p>`
          : skipped
            ? `<p class="center level-hint">Hai saltato il minigioco: la parte saltata vale 0 punti, ma ecco i corsi del livello.</p>`
            : ""
      }
      <div class="course-grid">${cards}</div>
      <button class="btn-arcade" id="next-level-btn">
        ${isLast ? "Vai al punteggio finale" : `Livello successivo ${Icons.svg("arrowRight")}`}
      </button>
    `;
    window.scrollTo(0, 0);

    const nextBtn = document.getElementById("next-level-btn");
    focusButton(nextBtn);
    nextBtn.addEventListener("click", () => {
      window.scrollTo(0, 0);
      if (isLast) {
        showFinalScore();
      } else {
        state.levelIndex += 1;
        showLevelIntro();
      }
    });
  }

  function showFinalScore() {
    const durationMs = Date.now() - state.startedAt;
    const totalStars = state.stars.reduce((sum, s) => sum + (s || 0), 0);
    sfx.levelClear();

    app.innerHTML = `
      <div class="card-hero">
        <span class="eyebrow">Squadra ${escapeHtml(teamName)}</span>
        <h1 class="title title--small">Partita completata!</h1>
      </div>
      ${mapHtml(totalLevels)}
      ${progressHtml(totalLevels)}
      <div class="final-stats">
        <div class="stat">
          <span class="stat-label">Punteggio</span>
          <span class="stat-value">${state.score}</span>
        </div>
        <div class="stat stat--gold">
          <span class="stat-label">Stelle</span>
          <span class="stat-value">${Icons.svg("star")} ${totalStars}<small>/${totalLevels * 3}</small></span>
        </div>
        <div class="stat">
          <span class="stat-label">Tempo</span>
          <span class="stat-value">${formatDuration(durationMs)}</span>
        </div>
      </div>
      <button class="btn-arcade mt-16" id="submit-score-btn">Invia il punteggio e vai in classifica</button>
      <p class="error-msg" id="submit-error" role="alert"></p>
    `;

    const btn = document.getElementById("submit-score-btn");
    const errorEl = document.getElementById("submit-error");

    function goToLeaderboard() {
      sessionStorage.setItem(
        "its-quest-last-result",
        JSON.stringify({ name: teamName, score: state.score })
      );
      sessionStorage.removeItem("its-quest-team");
      sessionStorage.removeItem("its-quest-token");
      window.location.href = "leaderboard.html?justPlayed=1";
    }

    focusButton(btn);
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Invio in corso...";

      try {
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: teamName,
            score: state.score,
            levelsCompleted: totalLevels,
            durationMs,
            token: sessionStorage.getItem("its-quest-token"),
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          errorEl.textContent = data.reason || "Invio non riuscito. Riprova.";
          btn.disabled = false;
          btn.textContent = "Invia il punteggio e vai in classifica";
          return;
        }
        goToLeaderboard();
      } catch (err) {
        // Server non raggiungibile: il punteggio resta in una classifica salvata su
        // questo dispositivo, così la partita non va persa.
        window.LocalScores.save({ name: teamName, score: state.score, durationMs });
        goToLeaderboard();
      }
    });
  }

  showLevelIntro();
})();
