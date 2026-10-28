/* Logica della schermata iniziale: validazione nome squadra e avvio partita. */

(function () {
  const form = document.getElementById("start-form");
  const input = document.getElementById("team-name");
  const errorMsg = document.getElementById("error-msg");
  const startBtn = document.getElementById("start-btn");

  // Feedback immediato mentre l'utente scrive (controllo lato client).
  input.addEventListener("input", () => {
    const check = ProfanityFilter.isClean(input.value);
    errorMsg.textContent = input.value.trim().length > 0 && !check.ok ? check.reason : "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = input.value.trim();

    const localCheck = ProfanityFilter.isClean(name);
    if (!localCheck.ok) {
      errorMsg.textContent = localCheck.reason;
      return;
    }

    startBtn.disabled = true;
    startBtn.textContent = "Caricamento...";

    try {
      // Il server è l'unica fonte di verità per il filtro: il client si può aggirare.
      const res = await fetch("/api/check-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!data.ok) {
        errorMsg.textContent = data.reason || "Nome squadra non valido.";
        startBtn.disabled = false;
        startBtn.textContent = "Inizia";
        return;
      }

      // Parola segreta riconosciuta dal server: si apre il pannello admin già autenticato.
      if (data.admin) {
        sessionStorage.setItem("its-quest-admin-password", name);
        window.location.href = "admin.html";
        return;
      }

      // Il server firma il token di partita (nome squadra + ora d'inizio): servirà
      // alla fine per pubblicare il punteggio. Se ora il server non risponde si
      // gioca lo stesso: il punteggio finirà nella classifica di questo dispositivo.
      sessionStorage.removeItem("its-quest-token");
      try {
        const startRes = await fetch("/api/start-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const startData = await startRes.json();
        if (startData.ok && typeof startData.token === "string") {
          sessionStorage.setItem("its-quest-token", startData.token);
        }
      } catch (err) {
        // niente server dalla schermata iniziale: si avvia comunque la partita
      }

      sessionStorage.setItem("its-quest-team", name);
      window.location.href = "game.html";
    } catch (err) {
      // Server non raggiungibile (es. index.html aperto con un doppio clic):
      // si gioca lo stesso, il nome è già stato controllato dal filtro qui sopra.
      sessionStorage.setItem("its-quest-team", name);
      window.location.href = "game.html";
    }
  });
})();
