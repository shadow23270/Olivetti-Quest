/* Minigiochi diversi dal quiz. Ognuno ha:
 *   nome            mostrato nell'intro del livello
 *   regole(level, baseTimeMs)  spiegazione (dipende dal tempo scelto dall'admin)
 *   play(ctx)       avvia il gioco; ctx arriva da game.js (punti, vite, timer...)
 * e alla fine chiama ctx.finish() per mostrare le schede dei corsi.
 * Ogni elemento indovinato vale ctx.itemPoints(...): 100 punti + bonus velocità
 * fino a 100 (vedi scoring.js). */

(function () {
  const { BASE_POINTS } = window.Scoring;

  // ---------- Tempi derivati dal tempo base dell'admin ----------

  function memoryTimeMs(level, baseTimeMs) {
    return Math.max(30000, baseTimeMs * level.coppie.length);
  }

  function fallTimeMs(baseTimeMs) {
    return Math.min(10000, Math.max(2500, baseTimeMs * 0.4));
  }

  function wordTimeMs(baseTimeMs) {
    return Math.max(20000, baseTimeMs * 2);
  }

  const seconds = (ms) => Math.round(ms / 1000);

  // ---------- MEMORY ----------

  const memory = {
    nome: "MEMORY",
    regole(level, baseTimeMs) {
      return `Gira le carte e abbina ogni competenza (blu) alla sua descrizione (rossa). Hai ${seconds(
        memoryTimeMs(level, baseTimeMs)
      )} secondi per trovare tutte le ${level.coppie.length} coppie.`;
    },
    play(ctx) {
      const { app, level, escapeHtml } = ctx;
      const totalPairs = level.coppie.length;
      const cards = ctx.shuffle(
        level.coppie.flatMap((c, pair) => [
          { pair, kind: "termine", text: c.termine },
          { pair, kind: "definizione", text: c.definizione },
        ])
      );

      app.innerHTML = `
        ${ctx.hudHtml()}
        <p class="level-tag">Memory</p>
        <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill"></div></div>
        <p class="center minigame-status" id="status" aria-live="polite">Coppie trovate: 0/${totalPairs}</p>
        <div class="memory-grid">
          ${cards
            .map(
              (c, i) => `
            <button class="memory-card ${c.kind}" data-i="${i}">
              <span class="memory-front">?</span>
              <span class="memory-back">${escapeHtml(c.text)}</span>
            </button>`
            )
            .join("")}
        </div>
      `;

      const statusEl = document.getElementById("status");
      const buttons = Array.from(app.querySelectorAll(".memory-card"));
      let first = null;
      let locked = false;
      let found = 0;
      let ended = false;

      const timer = ctx.startTimer(
        document.getElementById("timer-fill"),
        memoryTimeMs(level, ctx.baseTimeMs),
        () => end(false)
      );

      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          if (ended || locked || btn.classList.contains("flipped")) return;
          ctx.sfx.click();
          btn.classList.add("flipped");

          if (!first) {
            first = btn;
            return;
          }

          const a = cards[first.dataset.i];
          const b = cards[btn.dataset.i];
          if (a.pair === b.pair) {
            first.classList.add("matched");
            btn.classList.add("matched");
            first = null;
            found += 1;
            ctx.sfx.correct();
            ctx.addPoints(BASE_POINTS);
            statusEl.textContent = `Coppie trovate: ${found}/${totalPairs}`;
            if (found === totalPairs) end(true);
          } else {
            locked = true;
            const other = first;
            first = null;
            btn.classList.add("miss");
            ctx.sfx.wrong();
            other.classList.add("miss");
            ctx.later(() => {
              btn.classList.remove("flipped", "miss");
              other.classList.remove("flipped", "miss");
              locked = false;
            }, 800);
          }
        });
      });

      function end(success) {
        if (ended) return;
        ended = true;
        timer.stop();

        if (success) {
          // Bonus tempo per ogni coppia: con i punti base già dati si arriva al massimo a coppia.
          const bonus = (ctx.itemPoints(timer.remainingFraction()) - BASE_POINTS) * totalPairs;
          ctx.addPoints(bonus);
          statusEl.textContent = `Tutte le coppie trovate! Bonus velocità +${bonus}`;
          ctx.later(ctx.finish, 1500);
        } else {
          buttons.forEach((btn) => btn.classList.add("flipped"));
          ctx.sfx.wrong();
          statusEl.textContent = `Tempo scaduto! Coppie trovate: ${found}/${totalPairs}`;
          ctx.later(() => ctx.loseLife(ctx.finish), 2000);
        }
      }
    },
  };

  // ---------- ACCHIAPPA LE PAROLE ----------

  const acchiappa = {
    nome: "ACCHIAPPA LE PAROLE",
    regole(level) {
      return `${level.istruzioni} Ogni intrusa colpita costa una vita; più presto colpisci una parola giusta, più punti fai.`;
    },
    play(ctx) {
      const { app, level, escapeHtml } = ctx;
      const fallMs = fallTimeMs(ctx.baseTimeMs);
      const spawnGapMs = Math.max(700, fallMs / 4);
      const words = ctx.shuffle([
        ...level.parole.giuste.map((text) => ({ text, ok: true })),
        ...level.parole.intruse.map((text) => ({ text, ok: false })),
      ]);
      const totalGood = level.parole.giuste.length;

      app.innerHTML = `
        ${ctx.hudHtml()}
        <p class="level-tag">Acchiappa le parole</p>
        <p class="center minigame-status" id="status" aria-live="polite">Parole giuste colpite: 0/${totalGood}</p>
        <div class="catch-area" id="catch-area"></div>
      `;

      const area = document.getElementById("catch-area");
      const statusEl = document.getElementById("status");
      const active = new Set();
      let spawned = 0;
      let caught = 0;
      let ended = false;

      // Se il livello viene saltato, ferma le parole che stanno ancora cadendo.
      ctx.onClose(() => {
        ended = true;
        active.forEach(({ anim }) => anim.cancel());
        active.clear();
      });

      // html: solo testo fisso del gioco (punti, icona), mai testo dell'utente.
      function pop(btn, html, good) {
        const el = document.createElement("span");
        el.className = `catch-pop ${good ? "good" : "bad"}`;
        el.innerHTML = html;
        const btnBox = btn.getBoundingClientRect();
        const areaBox = area.getBoundingClientRect();
        el.style.left = btnBox.left - areaBox.left + "px";
        el.style.top = btnBox.top - areaBox.top + "px";
        el.addEventListener("animationend", () => el.remove());
        area.appendChild(el);
      }

      function spawn() {
        // Se si esce dal browser (es. notifica sul telefono) le animazioni si fermano:
        // non generiamo parole nuove finché la pagina non torna visibile.
        if (ended || spawned >= words.length || document.hidden) return;
        const word = words[spawned];
        spawned += 1;

        const btn = document.createElement("button");
        btn.className = "falling-word";
        btn.textContent = word.text;
        area.appendChild(btn);
        const maxLeft = Math.max(0, area.clientWidth - btn.offsetWidth);
        btn.style.left = Math.round(Math.random() * maxLeft) + "px";

        const anim = btn.animate(
          [{ transform: "translateY(-60px)" }, { transform: `translateY(${area.clientHeight}px)` }],
          { duration: fallMs, easing: "linear" }
        );
        const item = { btn, anim };
        active.add(item);

        anim.onfinish = () => {
          btn.remove();
          active.delete(item);
          checkEnd();
        };

        // pointerdown invece di click: con una parola in movimento il click
        // (premi + rilascia) su telefono a volte "manca" il bersaglio.
        btn.addEventListener("pointerdown", () => {
          if (ended) return;
          const remaining = 1 - (anim.currentTime || 0) / fallMs;
          if (word.ok) {
            const points = ctx.itemPoints(remaining);
            ctx.addPoints(points);
            caught += 1;
            statusEl.textContent = `Parole giuste colpite: ${caught}/${totalGood}`;
            ctx.sfx.correct();
            pop(btn, `+${points}`, true);
          } else {
            ctx.sfx.wrong();
            pop(btn, `Intrusa! −1 ${window.Icons.heart("icon-inline")}`, false);
          }
          anim.cancel();
          btn.remove();
          active.delete(item);

          // Vite finite: il round si chiude subito.
          if (!word.ok && ctx.damage() === 0) {
            end(true);
            return;
          }
          checkEnd();
        });
      }

      function checkEnd() {
        if (!ended && spawned >= words.length && active.size === 0) end(false);
      }

      const spawnId = ctx.every(spawn, spawnGapMs);
      spawn();

      function end(outOfLives) {
        ended = true;
        ctx.stopEvery(spawnId);
        active.forEach(({ btn, anim }) => {
          anim.cancel();
          btn.remove();
        });
        active.clear();
        statusEl.textContent = outOfLives
          ? "Troppe intruse colpite!"
          : `Fine! Parole giuste colpite: ${caught}/${totalGood}`;
        ctx.later(() => ctx.continueOrGameOver(ctx.finish), 1500);
      }
    },
  };

  // ---------- INDOVINA LA PAROLA (impiccato) ----------

  const MAX_ERRORS = 6;
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  function hangmanDrawing(errors) {
    const head = errors >= 1 ? "O" : " ";
    const body = errors >= 2 ? "|" : " ";
    const leftArm = errors >= 3 ? "/" : " ";
    const rightArm = errors >= 4 ? "\\" : " ";
    const leftLeg = errors >= 5 ? "/" : " ";
    const rightLeg = errors >= 6 ? "\\" : " ";
    return [
      "  +---+",
      "  |   |",
      `  ${head}   |`,
      ` ${leftArm}${body}${rightArm}  |`,
      ` ${leftLeg} ${rightLeg}  |`,
      "      |",
      "=========",
    ].join("\n");
  }

  const impiccato = {
    nome: "INDOVINA LA PAROLA",
    regole(level, baseTimeMs) {
      return `Indovina ${level.parole.length} parole lettera per lettera, aiutandoti con l'indizio. Per ogni parola hai ${seconds(
        wordTimeMs(baseTimeMs)
      )} secondi e ${MAX_ERRORS} errori a disposizione.`;
    },
    play(ctx) {
      const { app, level, escapeHtml } = ctx;
      const words = ctx.shuffle(level.parole); // ordine diverso a ogni partita
      let wordIndex = 0;
      let currentGuess = null;

      // Si può giocare anche con la tastiera fisica.
      function onKeyDown(e) {
        // Ctrl+R, Alt+Tab ecc. non devono contare come lettere tentate.
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const letter = e.key.toUpperCase();
        if (currentGuess && ALPHABET.includes(letter)) currentGuess(letter);
      }
      ctx.listen(document, "keydown", onKeyDown);

      function playWord() {
        const { parola, indizio } = words[wordIndex];
        const guessed = new Set();
        let errors = 0;
        let done = false;

        app.innerHTML = `
          ${ctx.hudHtml()}
          <p class="level-tag">Parola ${wordIndex + 1} di ${level.parole.length}</p>
          <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill"></div></div>
          <div class="hangman-layout">
            <pre class="hangman" id="hangman">${hangmanDrawing(0)}</pre>
            <div>
              <p class="center hangman-hint">Indizio: ${escapeHtml(indizio)}</p>
              <div class="word-slots" id="word-slots"></div>
              <p class="center minigame-status" id="status" aria-live="polite">Errori: 0/${MAX_ERRORS}</p>
              <p class="keyboard-tip">Puoi scrivere le lettere anche con la tastiera</p>
            </div>
          </div>
          <div class="keyboard">
            ${ALPHABET.map((l) => `<button class="key-btn" data-letter="${l}">${l}</button>`).join("")}
          </div>
        `;

        const slotsEl = document.getElementById("word-slots");
        const statusEl = document.getElementById("status");
        const hangmanEl = document.getElementById("hangman");

        function renderSlots(revealAll) {
          slotsEl.innerHTML = parola
            .split("")
            .map((l) => {
              const shown = guessed.has(l) || revealAll;
              const missed = revealAll && !guessed.has(l);
              return `<span class="slot ${missed ? "missed" : ""}">${shown ? l : "_"}</span>`;
            })
            .join("");
        }
        renderSlots(false);

        const timer = ctx.startTimer(document.getElementById("timer-fill"), wordTimeMs(ctx.baseTimeMs), () =>
          endWord(false)
        );

        function guess(letter) {
          if (done || guessed.has(letter)) return;
          guessed.add(letter);
          const key = app.querySelector(`.key-btn[data-letter="${letter}"]`);
          key.disabled = true;

          if (parola.includes(letter)) {
            ctx.sfx.click();
            key.classList.add("hit");
            renderSlots(false);
            if (parola.split("").every((l) => guessed.has(l))) endWord(true);
          } else {
            ctx.sfx.wrong();
            key.classList.add("miss");
            errors += 1;
            hangmanEl.textContent = hangmanDrawing(errors);
            statusEl.textContent = `Errori: ${errors}/${MAX_ERRORS}`;
            if (errors >= MAX_ERRORS) endWord(false);
          }
        }
        currentGuess = guess;

        app.querySelectorAll(".key-btn").forEach((btn) => {
          btn.addEventListener("click", () => guess(btn.dataset.letter));
        });

        function endWord(win) {
          if (done) return;
          done = true;
          timer.stop();
          app.querySelectorAll(".key-btn").forEach((btn) => (btn.disabled = true));

          if (win) {
            const fraction = timer.remainingFraction();
            ctx.addPoints(ctx.itemPoints(fraction));
            ctx.sfx.correct();
            ctx.showPoints(statusEl, fraction);
            statusEl.insertAdjacentText("afterbegin", "Esatto! ");
            ctx.later(nextWord, 1500);
          } else {
            renderSlots(true);
            ctx.sfx.wrong();
            statusEl.textContent = `Peccato! La parola era ${parola}`;
            ctx.later(() => ctx.loseLife(nextWord), 2000);
          }
        }
      }

      function nextWord() {
        wordIndex += 1;
        if (wordIndex < level.parole.length) {
          playWord();
        } else {
          currentGuess = null;
          ctx.unlisten(document, "keydown", onKeyDown);
          ctx.finish();
        }
      }

      playWord();
    },
  };

  window.Minigames = { memory, acchiappa, impiccato };
})();
