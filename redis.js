/* Client minimo per Upstash Redis tramite la sua API REST (nessuna dipendenza).
 * Si attiva da solo quando ci sono le variabili d'ambiente che Vercel aggiunge
 * collegando un database Upstash al progetto (KV_REST_API_URL / _TOKEN oppure
 * UPSTASH_REDIS_REST_URL / _TOKEN). Senza, il gioco usa i file in data/. */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
// Prefisso delle chiavi: REDIS_PREFIX permette prove senza toccare i dati veri.
const PREFIX = process.env.REDIS_PREFIX || "olivetti-quest:";

// Esegue un comando Redis, es. command("HSET", key, field, value).
async function command(...args) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args.map(String)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`Redis ${args[0]}: ${data.error || res.status}`);
  }
  return data.result;
}

module.exports = {
  enabled: Boolean(URL_ && TOKEN),
  command,
  key: (name) => PREFIX + name,
};
