// Genera un token de servicio para la API de liquidaciones (db/011_tokens_servicio.sql).
// Uso: node scripts/token-servicio.mjs <nombre> [dias=90] [esquema=cia_liquidaciones]
// Imprime el token (entregarlo una sola vez, por canal seguro) y el INSERT a ejecutar en la base.
import { createHash, randomBytes } from "node:crypto";

const [nombre, dias = "90", esquema = "cia_liquidaciones"] = process.argv.slice(2);
if (!nombre || !/^[\w.@-]+$/.test(nombre) || !/^\d+$/.test(dias) || !/^[a-z_][a-z0-9_]*$/.test(esquema)) {
  console.error("Uso: node scripts/token-servicio.mjs <nombre> [dias=90] [esquema=cia_liquidaciones]");
  process.exit(1);
}
const token = `liq_${randomBytes(32).toString("base64url")}`;
const hash = createHash("sha256").update(token).digest("hex");

console.log(`Token (no se guarda; entrégalo una sola vez):\n${token}\n`);
console.log(
  `INSERT INTO ${esquema}.tokens_servicio (nombre, hash_token, expira_en)\n` +
    `VALUES ('${nombre}', '${hash}', now() + interval '${Number(dias)} days');`,
);
