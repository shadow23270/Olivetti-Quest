/* Carica e mostra la classifica dei punteggi registrati oggi, e la ricarica da
 * sola ogni pochi secondi (utile sul proiettore durante l'open day).
 * Se il server non risponde, mostra la classifica salvata su questo dispositivo. */

(function () {
  const REFRESH_MS = 5000;

  const container = document.getElementById("leaderboard-content");
  const statusEl = document.getElementById("leaderboard-status");
  const { escapeHtml, formatDuration } = window.Utils;
  const Icons = window.Icons;

  // La squadra appena arrivata dal gioco resta evidenziata a ogni aggiornamento.
  const lastResult = readLastResult();
  let lastRendered = "";

  function readLastResult() {
    try {
      const raw = sessionStorage.getItem("its-quest-last-result");
      sessionStorage.removeItem("its-quest-last-result");
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function render(entries, notice) {
    const noticeHtml = notice ? `<p class="offline-notice">${notice}</p>` : "";

    if (entries.length === 0) {
      return `${noticeHtml}<p class="empty-state">Nessuna squadra ha ancora giocato oggi.<br/>Siate i primi! ${Icons.svg("gamepad", "icon-inline-muted")}</p>`;
    }

    let highlightedOnce = false;
    const rows = entries
      .map((e) => {
        const medal = e.rank <= 3 ? Icons.svg("award", `medal medal-${e.rank}`) : e.rank;
        const isYou =
          !highlightedOnce && lastResult && e.name === lastResult.name && e.score === lastResult.score;
        if (isYou) highlightedOnce = true;

        return `
          <tr class="${e.rank <= 3 ? `rank-${e.rank}` : ""} ${isYou ? "you" : ""}">
            <td class="col-rank">${medal}</td>
            <td class="col-name">${escapeHtml(e.name)}</td>
            <td class="col-score">${e.score}</td>
            <td class="col-time">${formatDuration(e.durationMs)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      ${noticeHtml}
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th class="col-rank" scope="col">#</th>
            <th class="col-name" scope="col">Squadra</th>
            <th class="col-score" scope="col">Punti</th>
            <th class="col-time" scope="col">Tempo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // Ridisegna solo se qualcosa è cambiato: niente sfarfallii sul proiettore.
  function show(html) {
    if (html !== lastRendered) {
      container.innerHTML = html;
      lastRendered = html;
    }
  }

  async function load() {
    try {
      const res = await fetch("/api/leaderboard?limit=100", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.entries)) throw new Error("risposta non valida");
      show(render(data.entries));
      const time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      statusEl.textContent = `Si aggiorna da sola · ultimo aggiornamento ${time}`;
    } catch (err) {
      show(
        render(
          window.LocalScores.today(),
          "Il server del gioco non risponde: questa è la classifica salvata solo su questo dispositivo. " +
            "Per la classifica condivisa avviate il gioco con AVVIA-GIOCO.bat e aprite http://localhost:3000."
        )
      );
      statusEl.textContent = "Server non raggiungibile: riprovo tra pochi secondi…";
    }
  }

  // Aggiornamento periodico; in pausa quando la scheda non è visibile.
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    if (!document.hidden) timer = setTimeout(() => load().then(schedule), REFRESH_MS);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer);
    else load().then(schedule);
  });

  load().then(schedule);
})();
