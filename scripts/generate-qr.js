/* Genera il QR code promozionale del gioco, da inserire nella presentazione.
 * Punta all'indirizzo pubblico del gioco e usa il blu del brand ITS (preso
 * dal logo in public/assets/logo-its-olivetti.svg): blu #0153FF su bianco,
 * con un margine bianco tutto intorno perché le fotocamera lo leggano bene.
 *
 * Uso:
 *   npm run qr                                (usa l'indirizzo pubblico standard)
 *   npm run qr -- http://192.168.x.x:3000     (variante LAN, se serve)
 *
 * Dipende solo dal pacchetto di sviluppo "qrcode" (devDependencies): il gioco
 * vero e proprio gira senza dipendenze esterne oltre a Express.
 */

const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const GAME_URL = process.argv[2] || "https://olivetti-quest.vercel.app";
const BRAND_BLUE = "#0153FF"; // blu ITS del logo
const WHITE = "#FFFFFF";

const outDir = path.join(__dirname, "..", "promo");

(async () => {
  fs.mkdirSync(outDir, { recursive: true });

  const options = {
    // Correction alta: anche se una parte del QR resta coperta o stampata male,
    // la fotocamera ricostruisce comunque il contenuto.
    errorCorrectionLevel: "H",
    margin: 4,
    color: { dark: BRAND_BLUE, light: WHITE },
  };

  // PNG ad alta risoluzione: pronto da trascinare nella presentazione.
  const pngPath = path.join(outDir, "qr-gioca-olivetti-quest.png");
  await QRCode.toFile(pngPath, GAME_URL, { ...options, width: 2048 });

  // SVG vettoriale: nitido a qualsiasi dimensione, comodo per i tool grafici.
  const svgPath = path.join(outDir, "qr-gioca-olivetti-quest.svg");
  await QRCode.toFile(svgPath, GAME_URL, options);

  console.log("QR code generato, punta a: " + GAME_URL);
  console.log("  PNG (da trascinare nella presentazione): " + pngPath);
  console.log("  SVG (vettoriale): " + svgPath);
})().catch((err) => {
  console.error("Generazione QR fallita:", err);
  process.exit(1);
});
