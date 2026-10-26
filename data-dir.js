const path = require("path");

// Cartella dei dati (classifica, impostazioni).
// - DATA_DIR: per provare il gioco con dati separati (vedi CLAUDE.md).
// - Su Vercel il disco è in sola lettura: si usa /tmp, che però è temporaneo
//   (i dati si perdono quando Vercel ricrea il server).
module.exports = path.resolve(
  __dirname,
  process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/its-olivetti-quest" : "data")
);
