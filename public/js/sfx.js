/* Effetti sonori 8-bit generati dal browser (Web Audio), senza file audio.
 * L'audio parte solo dopo un clic dell'utente (regola dei browser), e si può
 * spegnere con il pulsante dell'altoparlante: la scelta viene ricordata su quel dispositivo. */

(function () {
  const MUTE_KEY = "its-quest-muted";
  let audioCtx = null;
  let muted = false;

  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch (err) {
    // localStorage non disponibile (es. navigazione privata): audio acceso.
  }

  function context() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  // Una singola nota "da sala giochi": onda quadra che si spegne in fretta.
  function tone(freq, duration, { type = "square", delay = 0, volume = 0.07 } = {}) {
    if (muted) return;
    const ac = context();
    if (!ac) return;
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function melody(notes, step, options) {
    notes.forEach((freq, i) => tone(freq, step * 1.2, { ...options, delay: i * step }));
  }

  window.Sfx = {
    click() {
      tone(880, 0.04, { volume: 0.04 });
    },
    correct() {
      melody([660, 990], 0.08);
    },
    wrong() {
      tone(160, 0.3, { type: "sawtooth", volume: 0.06 });
    },
    levelClear() {
      melody([523, 659, 784, 1047, 784, 1047], 0.09);
    },
    gameOver() {
      melody([392, 330, 262, 196], 0.18, { type: "triangle", volume: 0.09 });
    },
    isMuted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      try {
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch (err) {
        // ignorato: la scelta vale solo fino al ricaricamento della pagina
      }
      return muted;
    },
  };
})();
