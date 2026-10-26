/* Pannello admin: login con password e modifica del tempo di risposta.
 * La protezione vera è sul server (ogni richiesta admin verifica la password):
 * questa pagina serve solo da interfaccia. */

(function () {
  const PASSWORD_KEY = "its-quest-admin-password";

  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("admin-password");
  const loginError = document.getElementById("login-error");
  const loginBtn = document.getElementById("login-btn");
  const panel = document.getElementById("settings-panel");
  const timeValueEl = document.getElementById("time-value");
  const limitsNote = document.getElementById("limits-note");
  const saveBtn = document.getElementById("save-btn");
  const saveMsg = document.getElementById("save-msg");
  const logoutBtn = document.getElementById("logout-btn");

  let password = sessionStorage.getItem(PASSWORD_KEY) || "";
  let limits = { min: 5, max: 120 };
  let savedTime = null;
  let currentTime = null;

  async function adminRequest(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify(body || {}),
    });
    return res.json();
  }

  function render() {
    timeValueEl.textContent = currentTime;
    limitsNote.textContent = `Minimo ${limits.min}s, massimo ${limits.max}s`;
    const unsaved = currentTime !== savedTime;
    saveBtn.disabled = !unsaved;
    saveBtn.textContent = unsaved ? "Salva" : "Salvato";
  }

  function showPanel(data) {
    limits = data.limits;
    savedTime = data.settings.questionTimeSec;
    currentTime = savedTime;
    loginForm.hidden = true;
    panel.hidden = false;
    render();
    loadScores();
  }

  // ---------- Classifica di oggi: elimina squadre, azzera ----------

  const scoresEl = document.getElementById("admin-scores");
  const scoresMsg = document.getElementById("scores-msg");
  const resetBtn = document.getElementById("reset-btn");
  const { escapeHtml, formatDuration } = window.Utils;

  // Azioni irreversibili: il primo clic "arma" il pulsante, il secondo (entro 3 s) conferma.
  function confirmClick(btn, armedText, action) {
    if (btn.classList.contains("armed")) {
      btn.classList.remove("armed");
      action();
      return;
    }
    const original = btn.textContent;
    btn.classList.add("armed");
    btn.textContent = armedText;
    setTimeout(() => {
      if (!btn.isConnected || !btn.classList.contains("armed")) return;
      btn.classList.remove("armed");
      btn.textContent = original;
    }, 3000);
  }

  async function loadScores() {
    try {
      const data = await adminRequest("/api/admin/scores");
      if (!data.ok) throw new Error(data.reason);
      renderScores(data.entries);
    } catch (err) {
      scoresEl.textContent = "Impossibile caricare la classifica.";
    }
  }

  function renderScores(entries) {
    resetBtn.disabled = entries.length === 0;
    if (entries.length === 0) {
      scoresEl.innerHTML = `<p class="center admin-note">Nessuna squadra ha ancora giocato oggi.</p>`;
      return;
    }
    scoresEl.innerHTML = entries
      .map(
        (e) => `
        <div class="admin-score-row">
          <span class="admin-score-rank">${e.rank}</span>
          <span class="admin-score-name">${escapeHtml(e.name)}</span>
          <span class="admin-score-points">${e.score} pt · ${formatDuration(e.durationMs)}</span>
          <button type="button" class="admin-delete-btn" data-id="${escapeHtml(e.id)}">Elimina</button>
        </div>`
      )
      .join("");
  }

  scoresEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".admin-delete-btn");
    if (!btn) return;
    confirmClick(btn, "Sicuro?", async () => {
      btn.disabled = true;
      scoresMsg.textContent = "";
      try {
        const data = await adminRequest("/api/admin/scores/delete", { id: btn.dataset.id });
        if (!data.ok) scoresMsg.textContent = data.reason || "Eliminazione non riuscita.";
      } catch (err) {
        scoresMsg.textContent = "Connessione al server non riuscita.";
      }
      loadScores();
    });
  });

  resetBtn.addEventListener("click", () => {
    confirmClick(resetBtn, "Confermi? Si cancella tutto", async () => {
      resetBtn.disabled = true;
      scoresMsg.textContent = "";
      try {
        const data = await adminRequest("/api/admin/reset");
        scoresMsg.textContent = data.ok
          ? `Classifica azzerata: ${data.removed} partite cancellate.`
          : data.reason || "Azzeramento non riuscito.";
      } catch (err) {
        scoresMsg.textContent = "Connessione al server non riuscita.";
      }
      resetBtn.textContent = "Azzera la classifica di oggi";
      loadScores();
    });
  });

  async function login() {
    loginBtn.disabled = true;
    loginError.textContent = "";
    try {
      const data = await adminRequest("/api/admin/login");
      if (!data.ok) {
        sessionStorage.removeItem(PASSWORD_KEY);
        loginError.textContent = data.reason || "Accesso negato.";
        return;
      }
      sessionStorage.setItem(PASSWORD_KEY, password);
      showPanel(data);
    } catch (err) {
      loginError.textContent = "Connessione al server non riuscita.";
    } finally {
      loginBtn.disabled = false;
    }
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    password = passwordInput.value;
    login();
  });

  document.querySelectorAll(".time-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.dataset.step, 10);
      currentTime = Math.min(limits.max, Math.max(limits.min, currentTime + step));
      saveMsg.textContent = "";
      render();
    });
  });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveMsg.textContent = "";
    try {
      const data = await adminRequest("/api/admin/settings", { questionTimeSec: currentTime });
      if (!data.ok) {
        saveMsg.textContent = data.reason || "Salvataggio non riuscito.";
        if (data.reason === "Parola segreta errata.") logout();
        else render();
        return;
      }
      savedTime = data.settings.questionTimeSec;
      render();
    } catch (err) {
      saveMsg.textContent = "Connessione al server non riuscita.";
      render();
    }
  });

  function logout() {
    sessionStorage.removeItem(PASSWORD_KEY);
    password = "";
    passwordInput.value = "";
    panel.hidden = true;
    loginForm.hidden = false;
  }

  logoutBtn.addEventListener("click", logout);

  if (password) login();
})();
