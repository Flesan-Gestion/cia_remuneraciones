// Acceso de solo lectura a las bases para las pruebas: la transaccional (DATABASE_URL) y la copia de
// encargados del esquema propio. Las consultas originales del PHP nombran flesan_rrhh.tabla_encargados_cc:
// se cruzan con la copia (como la plataforma) conservando el alias «tabla_encargados_cc».
const fs = require("fs");
const path = require("path");
const RAIZ = path.resolve(__dirname, "../..");
/** Fuentes de los aplicativos PHP (finiquito_rem/, libro_rem_dis/, libro_rem_g2/). Por defecto, junto al repo. */
const FUENTES_PHP = process.env.FUENTES_PHP ?? path.resolve(RAIZ, "..");
/** Lo que generan las pruebas (Excel, JSON, tiempos): fuera de git (.gitignore). */
const SALIDA = path.join(__dirname, "salida");
fs.mkdirSync(SALIDA, { recursive: true });
for (const l of fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const pg = require(path.join(RAIZ, "node_modules/pg"));
const texto = { getTypeParser: () => (v) => v };
const COLUMNAS = ["llave", "sociedad", "centro_coto", "administrativo", "correo", "ver_planta", "administrador", "correo_administrador", "visitador", "correo_visitador", "gerente", "correo_gerente", "correo_ggo", "division"];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 30000 });
pool.on("error", () => {});
let copia = null;

async function encargados() {
  if (copia) return copia;
  const plat = new pg.Client({ connectionString: process.env.DATABASE_URL_PLATAFORMA });
  await plat.connect();
  const { rows } = await plat.query(`SELECT id, ${COLUMNAS.join(", ")} FROM ${process.env.ESQUEMA_PLATAFORMA}.encargados_cc ORDER BY id`);
  await plat.end();
  copia = rows;
  return rows;
}

async function plataforma(sql, values) {
  const plat = new pg.Client({ connectionString: process.env.DATABASE_URL_PLATAFORMA });
  await plat.connect();
  try {
    await plat.query("BEGIN READ ONLY");
    const { rows } = await plat.query({ text: sql, values, types: texto });
    await plat.query("ROLLBACK");
    return rows;
  } finally {
    await plat.end();
  }
}

/** Igual que conEncargados de lib/encargados-cc.ts (mismo WITH con arreglos). */
function conCopia(sql, params, filas) {
  const desde = params.length + 1;
  for (const c of COLUMNAS) params.push(filas.map((f) => f[c]));
  const cte = `encargados_cc AS (\n  SELECT * FROM unnest(${COLUMNAS.map((_, i) => `$${desde + i}::varchar[]`).join(", ")})\n    AS x(${COLUMNAS.join(", ")})\n)`;
  const cuerpo = sql.replace(/flesan_rrhh\.tabla_encargados_cc(?!\s+(AS\s+)?[a-z_]+\s+(ON|WHERE)\b)/gi, "flesan_rrhh.tabla_encargados_cc AS tabla_encargados_cc").replaceAll("flesan_rrhh.tabla_encargados_cc", "encargados_cc");
  const t = cuerpo.trimStart();
  return /^WITH\s/i.test(t) ? `WITH ${cte},\n${t.slice(5)}` : `WITH ${cte}\n${t}`;
}

/** Corre SQL original (texto como pg_fetch_assoc). original=true: contra la tabla real de encargados. */
async function correr(sql, { real = false, pre = [], values = [], prefijo = "" } = {}) {
  const params = [...values];
  const s = prefijo + (!real && sql.includes("flesan_rrhh.tabla_encargados_cc") ? conCopia(sql, params, await encargados()) : sql);
  const c = await pool.connect();
  try {
    await c.query("BEGIN READ ONLY");
    for (const p of pre) await c.query(p);
    const t = Date.now();
    const r = await c.query({ text: s, values: params, types: texto });
    const ms = Date.now() - t;
    await c.query("ROLLBACK");
    return Object.assign(r.rows, { ms, campos: r.fields.map((f) => f.name) });
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    return { error: e.message };
  } finally {
    c.release();
  }
}

async function explicar(sql, { real = false, analizar = false } = {}) {
  const r = await correr(sql, { real, prefijo: analizar ? "EXPLAIN (ANALYZE, BUFFERS) " : "EXPLAIN " });
  return r.error ? r.error : r.map((x) => x["QUERY PLAN"]).join("\n");
}

/** Solo para pruebas sintéticas: reemplaza la copia de encargados (en memoria, nada se escribe). */
function fijarEncargados(filas) {
  copia = filas;
}

module.exports = { FUENTES_PHP, SALIDA, correr, explicar, plataforma, encargados, fijarEncargados, pool, RAIZ, conCopia };
