/* Carica e mostra la classifica dei punteggi registrati oggi.
 * Se il server non risponde, mostra la classifica salvata su questo dispositivo. */

(function () {
  const container = document.getElementById("leaderboard-content");
  const { escapeHtml, formatDuration } = window.Utils;
  const Icons = window.Icons;

  function getLastResult() {
    try {
      const raw = sessionStorage.getItem("its-quest-last-result");
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function render(entries, notice) {
    const noticeHtml = notice ? `<p class="offline-notice">${notice}</p>` : "";

    if (entries.length === 0) {
      container.innerHTML = `${noticeHtml}<p class="empty-state">Nessuna squadra ha ancora giocato oggi.<br/>Siate i primi! ${Icons.svg("gamepad", "icon-inline-muted")}</p>`;
      return;
    }

    const lastResult = getLastResult();
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

    container.innerHTML = `
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
    sessionStorage.removeItem("its-quest-last-result");
  }

  async function load() {
    try {
      const res = await fetch("/api/leaderboard?limit=100");
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.entries)) throw new Error("risposta non valida");
      render(data.entries);
    } catch (err) {
      render(
        window.LocalScores.today(),
        "Il server del gioco non risponde: questa è la classifica salvata solo su questo dispositivo. " +
          "Per la classifica condivisa avviate il gioco con AVVIA-GIOCO.bat e aprite http://localhost:3000."
      );
    }
  }

  load();
})();
