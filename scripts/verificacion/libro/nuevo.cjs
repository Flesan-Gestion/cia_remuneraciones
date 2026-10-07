// Uso: node nuevo.cjs '<filtros json>' '<acceso json>' salida.json — corre consultarLibro (TS) con jiti.
const fs = require("fs");
const path = require("path");
const PROY = path.resolve(__dirname, "../../..");
for (const l of fs.readFileSync(path.join(PROY, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { createJiti } = require(path.join(PROY, "node_modules/jiti"));
const jiti = createJiti(__filename, { alias: { "@": PROY } });
(async () => {
  const { consultarLibro, listarEmpresasLibro } = await jiti.import(path.join(PROY, "lib/libro/consultas.ts"));
  const { pool } = await jiti.import(path.join(PROY, "lib/db.ts"));
  const filtros = JSON.parse(process.argv[2]);
  const acceso = JSON.parse(process.argv[3]);
  const t = Date.now();
  const filas = process.env.EMPRESAS ? await listarEmpresasLibro(acceso) : await consultarLibro(filtros, acceso);
  console.log(`${filas.length} filas en ${Date.now() - t} ms`);
  fs.writeFileSync(process.argv[4], JSON.stringify(filas));
  await pool.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
