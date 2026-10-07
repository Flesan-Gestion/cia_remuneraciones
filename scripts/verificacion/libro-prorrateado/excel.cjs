// Genera el Excel del prorrateado con el código de la plataforma y lo compara, celda a celda, con lo
// que armaría libro_rem_dist_excel.php con las filas de la consulta ORIGINAL (reimplementado aparte).
//   node excel.cjs <rol> <correo> <desde> <hasta> [empresa]
const path = require("path");
const fs = require("fs");
const DIR = __dirname;
const { RAIZ, SALIDA } = require("../comun.cjs");
const { sqlOriginal } = require(path.join(DIR, "orig.cjs"));
const [rol, correo, desde, hasta, empresa] = process.argv.slice(2);
process.chdir(RAIZ);
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z_]+)=(.*)$/.exec(l); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const { createJiti } = require(path.resolve("node_modules/jiti"));
const jiti = createJiti(path.join(RAIZ, "x.js"), { alias: { "@": RAIZ } });
const ExcelJS = require(path.resolve("node_modules/exceljs"));

// --- PHP, aparte: lista de conceptos tal cual libro_rem_dist_excel.php
const txt = fs.readFileSync(path.join(DIR, "plantillas", "excel_conceptos.txt"), "utf8");
const LISTA = [...txt.matchAll(/'([a-z0-9_]+)'\s*=>\s*'([^']*)'/g)].map((m) => [m[1], m[2]]);
const floatval = (v) => { const x = parseFloat(String(v ?? 0).replace(/[$. ]/g, "")); return Number.isNaN(x) ? 0 : x; };
const binder = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (/^[+-]?(\d+\.?\d*|\d*\.?\d+)([Ee][-+]?[0-2]?\d{1,3})?$/.test(v)) { const t = v.replace(/^[+-]/, ""); if (t.length > 1 && t[0] === "0" && t[1] !== ".") return v; return Number(v); }
  return v;
};
const fechaPhp = (v) => { const [a, m, d] = v.split("-"); return `${d}-${m}-${a}`; };

(async () => {
  const pool = (await jiti.import("./lib/db.ts")).pool;
  const enc = await jiti.import("./lib/encargados-cc.ts");
  const { Pool } = require(path.resolve("node_modules/pg"));
  const plat = new Pool({ connectionString: process.env.DATABASE_URL_PLATAFORMA, max: 1 });
  const { rows: copia } = await plat.query(`SELECT id, ${enc.COLUMNAS_ENCARGADOS.join(", ")} FROM ${process.env.ESQUEMA_PLATAFORMA}.encargados_cc ORDER BY id`);
  await plat.end();
  globalThis._encargadosCc = { filas: copia, en: Date.now() + 1e10 };
  const pr = await jiti.import("./lib/libro-prorrateado/consultas.ts");
  const ex = await jiti.import("./lib/libro-prorrateado/excel.ts");

  const filtros = { empresa: empresa ?? null, cc: null, desde, hasta };
  const nuevas = await pr.consultarProrrateado(filtros, { correo, rol });
  const buf = await ex.generarExcelProrrateado(nuevas, filtros);
  const archivo = path.join(SALIDA, `prueba_${rol}_${desde}_${hasta}.xlsx`);
  fs.writeFileSync(archivo, buf);

  // Filas de la consulta original (texto, como pg_fetch_assoc).
  const val = rol === "administrador" ? "bxcv5bxd855" : rol === "ggo" ? "g46sdf5g4s6df5g" : "0";
  const id = `${empresa ?? "0"},0,${desde},${hasta},${rol === "rrhh" ? "0" : correo},${val},0`;
  let { sql } = sqlOriginal(id);
  const params = [];
  if (sql.includes("flesan_rrhh.tabla_encargados_cc")) sql = enc.conEncargados(sql.replace(/flesan_rrhh\.tabla_encargados_cc(?!\s+AS)/g, "flesan_rrhh.tabla_encargados_cc AS tabla_encargados_cc"), params, copia);
  const c = await pool.connect();
  const { rows: orig } = await c.query({ text: sql, values: params, types: { getTypeParser: () => (v) => v } });
  c.release();

  // Lo que escribiría el PHP.
  const inicio = ["sociedad", "cc", "nombre_completo", "rut", "np", "cargo", "tipo_contrato", "fecha_ingreso", "fecha_estimada_termino", "fecha_retiro", "dias", "porcentaje"];
  const fin = ["nombre_clasificacion_gasto", "ames", "planta"];
  const activas = LISTA.filter(([k]) => orig.some((r) => floatval(r[k] ?? 0) != 0));
  const esperado = orig.map((r) => [
    ...inicio.map((k) => { let v = r[k] ?? ""; if (k.includes("fecha") && v && v !== "0000-00-00") v = fechaPhp(v); return k.includes("fecha") ? (v === "" ? null : v) : binder(v); }),
    ...activas.map(([k]) => floatval(r[k] ?? 0) + (k === "costo_empresa" ? floatval(r.vacaciones_proporcionales ?? 0) : 0)),
    ...fin.map((k) => binder(r[k] ?? "")),
  ]);
  const encabezados = [...["SOCIEDAD", "CENTRO COSTO", "NOMBRE COMPLETO", "RUT", "NP", "CARGO", "TIPO CONTRATO", "FECHA INGRESO", "FECHA ESTIMADA TERMINO", "FECHA RETIRO", "DIAS TRABAJADOS", "PORCENTAJE PRORRATEO"], ...activas.map(([, t]) => t), "CLASIFICACION DE GASTO", "AMES", "PLANTA"];

  // Lo que quedó en el Excel.
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buf);
  const hoja = libro.worksheets[0];
  const problemas = [];
  const ver = (cond, msg) => { if (!cond) problemas.push(msg); };
  ver(hoja.name === "libro_rem", `hoja ${hoja.name}`);
  ver(JSON.stringify(hoja.model.merges) === JSON.stringify(["A1:C3"]), `combinadas ${JSON.stringify(hoja.model.merges)}`);
  for (const n of [1, 2, 3]) ver(hoja.getRow(n).height === 25, `alto fila ${n}: ${hoja.getRow(n).height}`);
  ver(hoja.getCell("A1").alignment?.horizontal === "center" && hoja.getCell("A1").alignment?.vertical === "middle", `alineación A1 ${JSON.stringify(hoja.getCell("A1").alignment)}`);
  ver(hoja.getCell("A4").font?.bold && hoja.getCell("A5").font?.bold && hoja.getCell("A6").font?.bold, "A4:A6 en negrita");
  const img = hoja.getImages()[0];
  ver(img && img.range.tl.nativeCol === 0 && img.range.tl.nativeRow === 0 && img.range.tl.nativeColOff === 762000 && img.range.tl.nativeRowOff === 95250, `logo ${img && JSON.stringify({c:img.range.tl.nativeCol,r:img.range.tl.nativeRow,co:img.range.tl.nativeColOff,ro:img.range.tl.nativeRowOff})}`);
  ver(img && Math.round(img.range.ext.width) === 267 && Math.round(img.range.ext.height) === 100, `tamaño logo ${JSON.stringify(img?.range.ext)}`);
  const fila8 = hoja.getRow(8).values.slice(2);
  ver(JSON.stringify(fila8) === JSON.stringify(encabezados), `encabezados distintos:\n ${fila8.join("|")}\n ${encabezados.join("|")}`);
  ver(hoja.getCell("B8").fill?.fgColor?.argb === "FFA0A0A0" && hoja.getCell("B8").font?.bold, "encabezado gris y negrita");
  let celdasMalas = 0;
  esperado.forEach((fila, i) => {
    const r = hoja.getRow(9 + i);
    fila.forEach((v, j) => {
      const cel = r.getCell(2 + j);
      const real = cel.value === undefined ? null : cel.value;
      const igual = v === real || (typeof v === "number" && typeof real === "number" && Math.abs(v - real) < 1e-9);
      if (!igual && celdasMalas++ < 5) problemas.push(`celda ${cel.address}: esperado ${JSON.stringify(v)}, quedó ${JSON.stringify(real)}`);
      const concepto = j >= 12 && j < 12 + activas.length;
      if (concepto && cel.numFmt !== "#,##0" && celdasMalas++ < 5) problemas.push(`formato ${cel.address}: ${cel.numFmt}`);
      if (!cel.border?.top && celdasMalas++ < 5) problemas.push(`sin borde ${cel.address}`);
    });
  });
  ver(hoja.rowCount === 8 + esperado.length, `filas ${hoja.rowCount} vs ${8 + esperado.length}`);
  console.log(`${archivo}\n  A4: ${hoja.getCell("A4").value} | A5: ${hoja.getCell("A5").value ?? ""} | A6: ${hoja.getCell("A6").value ?? ""}`);
  console.log(`  ${esperado.length} filas × ${encabezados.length} columnas (${activas.length} conceptos) · ${(buf.length / 1024).toFixed(0)} KB · celdas distintas: ${celdasMalas}`);
  console.log(problemas.length ? "  PROBLEMAS:\n  " + problemas.join("\n  ") : "  OK: estructura y todas las celdas como en el PHP");
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
