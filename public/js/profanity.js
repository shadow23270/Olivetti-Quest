/*
 * Filtro nomi squadra: blocca parole volgari/offensive (italiano + inglese di base)
 * e tentativi comuni di aggirare il filtro (leetspeak, spazi/punti tra le lettere,
 * lettere ripetute). Usato SIA lato client (per un feedback immediato all'utente)
 * SIA lato server (unica fonte di verità, perché il client si può sempre bypassare).
 *
 * Non è un filtro perfetto: è pensato per bloccare i tentativi più ovvi durante
 * un evento scolastico, non per essere una soluzione di moderazione enterprise.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ProfanityFilter = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  // Radici volgari/offensive da bloccare (italiano + inglese). Match come sottostringa
  // sul nome normalizzato: è intenzionale, per intercettare varianti e flessioni.
  const BLOCKLIST = [
    // italiano - volgarità / insulti pesanti
    "cazz", "minchi", "stronz", "merd", "puttan", "troia", "troie",
    "vaffanculo", "fanculo", "cogliion", "coglion", "culatt", "leccaculo",
    "zoccol", "mignott", "bastard", "deficient", "ritardat", "handicappat",
    "mongolo", "negro", "negri", "frocio", "froci", "checca", "lesbicaccia",
    "pompin", "bocchin", "scopat", "chiavat", "vaffang", "porcodio",
    "porcamadonna", "porcaputtana", "dioca", "madonnina puttana",
    "succhiacazzi", "testadicazzo", "figadi", "ficadi", "rottinculo",
    // italiano - parole più corte, tenute come parole intere per evitare falsi positivi
    "culo", "culi", "sega", "seghe", "figa", "fica", "tette", "cesso",
    // inglese
    "fuck", "shit", "bitch", "asshole", "cunt", "bastard", "dick", "pussy",
    "nigger", "nigga", "faggot", "whore", "slut", "retard",
  ];

  // Parole corte per cui usiamo un confronto su token intero (dopo normalizzazione)
  // invece che substring, per non bloccare nomi innocenti che le contengono per caso.
  const WHOLE_WORD_ONLY = new Set([
    "culo", "culi", "sega", "seghe", "figa", "fica", "tette", "cesso", "dick",
  ]);

  const LEET_MAP = {
    0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", "@": "a", "$": "s",
  };

  function stripAccents(str) {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function applyLeet(str) {
    return str.replace(/[0134578@$]/g, (ch) => LEET_MAP[ch] || ch);
  }

  function collapseRepeats(str) {
    // "caaazzoooo" -> "cazo" (max 1 lettera ripetuta consecutiva)
    return str.replace(/(.)\1+/g, "$1");
  }

  // La blocklist va collassata allo stesso modo del testo in ingresso, altrimenti
  // le doppie lettere legittime delle parole stesse (es. "caZZo") non farebbero
  // più match dopo che il nome viene collassato (es. "caZZoteam" -> "cazoteam").
  const BLOCKLIST_COLLAPSED = BLOCKLIST.map(collapseRepeats);

  function normalize(str) {
    let s = String(str || "").toLowerCase();
    s = stripAccents(s);
    s = applyLeet(s);
    // rimuove tutto ciò che non è lettera (spazi, punti, underscore, emoji...)
    const collapsedNoSpace = s.replace(/[^a-z]/g, "");
    const tokens = s.split(/[^a-z]+/).filter(Boolean);
    return {
      collapsed: collapseRepeats(collapsedNoSpace),
      tokens: tokens.map(collapseRepeats),
    };
  }

  function isClean(name) {
    const trimmed = String(name || "").trim();
    if (trimmed.length < 2) {
      return { ok: false, reason: "Il nome squadra deve avere almeno 2 caratteri." };
    }
    if (trimmed.length > 24) {
      return { ok: false, reason: "Il nome squadra può avere al massimo 24 caratteri." };
    }
    if (!/[a-zA-Z0-9]/.test(trimmed)) {
      return { ok: false, reason: "Il nome squadra deve contenere almeno una lettera o un numero." };
    }

    const { collapsed, tokens } = normalize(trimmed);

    for (let i = 0; i < BLOCKLIST.length; i++) {
      const bad = BLOCKLIST[i];
      const badCollapsed = BLOCKLIST_COLLAPSED[i];
      if (WHOLE_WORD_ONLY.has(bad)) {
        if (tokens.includes(badCollapsed)) {
          return { ok: false, reason: "Questo nome squadra non è consentito. Scegline un altro." };
        }
      } else if (collapsed.includes(badCollapsed)) {
        return { ok: false, reason: "Questo nome squadra non è consentito. Scegline un altro." };
      }
    }

    return { ok: true };
  }

  return { isClean };
});
