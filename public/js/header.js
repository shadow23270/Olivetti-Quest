/* Barra in alto comune a tutte le pagine: pulsante per lo schermo intero,
 * utile per presentare il gioco con un proiettore durante l'open day. */

(function () {
  // Ingranaggio per il pannello admin (solo home e classifica, nascosto sui telefoni).
  const adminLink = document.querySelector(".admin-link");
  if (adminLink) adminLink.innerHTML = window.Icons.svg("settings");

  const btn = document.getElementById("fullscreen-btn");
  if (!btn) return;

  if (!document.fullscreenEnabled) {
    btn.hidden = true;
    return;
  }

  function render() {
    const active = !!document.fullscreenElement;
    btn.innerHTML = active
      ? `${window.Icons.svg("minimize")} Esci da schermo intero`
      : `${window.Icons.svg("maximize")} Schermo intero`;
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }

  btn.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener("fullscreenchange", render);
  render();
})();
