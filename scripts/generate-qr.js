/* Genera il QR code promozionale del gioco: da inserire nella presentazione
 * e usato dalla pagina classifica finché nessuno ha giocato (public/assets/
 * qr-gioca.svg: appena una squadra completa, la pagina lo toglie da sola).
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

  // Copia servita dal sito: la classifica vuota la mostra al posto della
  // tabella, poi la toglie da sola quando arriva la prima squadra. La pagina
  // è scura: qui i moduli del codice sono CHIARI su sfondo trasparente (le
  // fotocamere degli smartphone leggono i QR invertiti), così il codice si
  // integra col tema e non serve un pannello bianco. Il margine trasparente
  // (quiet zone) resta intorno ai moduli e sta dentro il pannello scuro
  // uniforme di .empty-qr in style.css.
  const sitePath = path.join(__dirname, "..", "public", "assets", "qr-gioca.svg");
  await QRCode.toFile(sitePath, GAME_URL, {
    ...options,
    color: { dark: "#FFFFFF", light: "#00000000" },
  });

  console.log("QR code generato, punta a: " + GAME_URL);
  console.log("  PNG (da trascinare nella presentazione): " + pngPath);
  console.log("  SVG (vettoriale): " + svgPath);
  console.log("  SVG nel sito (classifica vuota): " + sitePath);
})().catch((err) => {
  console.error("Generazione QR fallita:", err);
  process.exit(1);
});

