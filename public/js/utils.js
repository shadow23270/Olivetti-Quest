/* Piccole funzioni usate da più pagine e dal server (store.js). */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Utils = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  // Testo sicuro da inserire nell'HTML (nomi delle squadre, testi dei corsi...).
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
  }

  // 83500 -> "01:23"
  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // Giorno corrente in Italia come "AAAA-MM-GG": la classifica è "di oggi".
  function todayKey() {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
  }

  return { escapeHtml, formatDuration, todayKey };
});
