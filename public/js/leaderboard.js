/* Carica e mostra la classifica dei punteggi registrati oggi, e la ricarica da
 * sola ogni 3,5 secondi (utile sul proiettore durante l'open day).
 * Se il server non risponde, mostra la classifica salvata su questo dispositivo. */

(function () {
  const REFRESH_MS = 3500;

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

  // Indice della squadra da evidenziare: la prima che combacia con l'ultimo
  // risultato giocato su questo dispositivo (-1 se non c'è).
  function youIndex(entries) {
    if (!lastResult) return -1;
    return entries.findIndex((e) => e.name === lastResult.name && e.score === lastResult.score);
  }

  // Podio: i primi 3 in tre colonne, con il 1° posto al centro, più in alto
  // e con la barra più lunga. Il CSS decide l'ordine visuale con "order";
  // nel DOM il 1° viene prima, così anche chi legge con lo screen reader
  // sente prima il vincitore.
  function podiumHtml(top3, youIdx) {
    if (top3.length === 0) return "";
    const slots = top3
      .map((e, i) => {
        const you = i === youIdx;
        return `
        <div class="podium-slot podium-slot--${e.rank}${you ? " you" : ""}">
          <div class="podium-card">
            <span class="podium-medal medal medal-${e.rank}">${Icons.svg("award")}</span>
            <span class="podium-name">${escapeHtml(e.name)}</span>
            <span class="podium-score">${e.score}</span>
          </div>
          <div class="podium-bar">${e.rank}°</div>
        </div>
      `;
      })
      .join("");
    return `<div class="podium">${slots}</div>`;
  }

  // Dal 4° posto in poi: la stessa tabella di prima (senza medaglie, che ora
  // stanno sul podio).
  function tableHtml(rest, youIdx, offset) {
    const rows = rest
      .map((e, i) => {
        const you = offset + i === youIdx;
        return `
          <tr class="${you ? "you" : ""}">
            <td class="col-rank">${e.rank}</td>
            <td class="col-name">${escapeHtml(e.name)}</td>
            <td class="col-score">${e.score}</td>
            <td class="col-time">${formatDuration(e.durationMs)}</td>
          </tr>
        `;
      })
      .join("");

    return `
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

  function render(entries, notice) {
    const noticeHtml = notice ? `<p class="offline-notice">${notice}</p>` : "";

    if (entries.length === 0) {
      return `${noticeHtml}<p class="empty-state">Nessuna squadra ha ancora giocato oggi.<br/>Siate i primi! ${Icons.svg("gamepad", "icon-inline-muted")}</p>`;
    }

    const youIdx = youIndex(entries);
    return `${noticeHtml}${podiumHtml(entries.slice(0, 3), youIdx)}${tableHtml(entries.slice(3), youIdx, 3)}`;
  }

  // Ridisegna solo se qualcosa è cambiato: niente sfarfallii sul proiettore.
  function show(html) {
    if (html !== lastRendered) {
      container.innerHTML = html;
      lastRendered = html;
    }
  }

  let inFlight = false;

  async function load() {
    inFlight = true;
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
    } finally {
      inFlight = false;
    }
  }

  // Aggiornamento automatico (polling): classifica e podio si ridisegnano da
  // soli ogni 3,5 secondi, senza ricaricare la pagina. Se una risposta è lenta
  // la successiva non si sovrappone (inFlight), e mentre la scheda non è
  // visibile non si fanno richieste a vuoto; tornando visibili si aggiorna subito.
  setInterval(() => {
    if (!document.hidden && !inFlight) load();
  }, REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !inFlight) load();
  });

  load();

  // Blocco "Gioca ora": l'indirizzo del gioco in grande, pensato per il
  // proiettore. Se la pagina è aperta in locale (PC dell'open day) "localhost"
  // non funziona dai telefoni: chiediamo al server il suo indirizzo di rete
  // (/api/address). Negli altri casi (dominio pubblico) vale quello che c'è
  // nella barra degli indirizzi.
  const addressEl = document.getElementById("play-url-address");
  const host = location.host || "localhost:3000";
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    fetch("/api/address")
      .then((r) => r.json())
      .then((d) => {
        addressEl.textContent = d.ok && d.address ? d.address.replace(/^https?:\/\//, "") : host;
      })
      .catch(() => {
        addressEl.textContent = host;
      });
  } else {
    addressEl.textContent = host;
  }
})();
