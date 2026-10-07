// Genera el Excel de finiquitos con el código de la plataforma y lo compara, celda a celda, con lo que
// escribiría export_excel_finiquito.php con las filas de las consultas ORIGINALES (reimplementado aparte).
//   node excel.cjs <rol> <correo> <desde> <hasta> [empresa] [cc]
const path = require("path");
const fs = require("fs");
const { correr, encargados, pool: poolBase, RAIZ } = require("../comun.cjs");
const { consultasExcel, sqlAdministrativo } = require("./orig.cjs");
const [rol, correo, desde, hasta, empresa = null, cc = null] = process.argv.slice(2);
process.chdir(RAIZ);
const { createJiti } = require(path.resolve("node_modules/jiti"));
const jiti = createJiti(path.join(RAIZ, "x.js"), { alias: { "@": RAIZ } });
const ExcelJS = require(path.resolve("node_modules/exceljs"));

// --- PHP, aparte: listas tal cual export_excel_finiquito.php
const exp = fs.readFileSync("c:/Users/martin.norambuena/Desktop/Aplicativos/liquidaciones_cia/finiquito_rem/export_excel_finiquito.php", "utf8");
const bloque = (inicio) => { const i = exp.indexOf(inicio); return exp.slice(i, exp.indexOf("];", i)); };
const pares = (txt) => [...txt.matchAll(/'([^']+)'\s*=>\s*'([^']*)'/g)].map((m) => [m[1], m[2]]);
const FIJAS = pares(bloque("$col_fijas_inicio = ["));
const CONC = pares(bloque("$conceptos_posibles = ["));
const FIN = pares(bloque("$col_fijas_fin = ["));
const RES1 = pares(bloque("$columnas_resumen1 = ["));
const RES2 = pares(bloque("$columnas_resumen2 = ["));
const floatval = (v) => { const m = String(v ?? 0).replace(/[$. ]/g, "").match(/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/); return m ? Number(m[0]) : 0; };
const binder = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (/^[+-]?(\d+\.?\d*|\d*\.?\d+)([Ee][-+]?[0-2]?\d{1,3})?$/.test(v)) { const t = v.replace(/^[+-]/, ""); if (t.length > 1 && t[0] === "0" && t[1] !== ".") return v; return Number(v); }
  return v;
};
const empty = (v) => v === null || v === undefined || v === "" || v === "0";
const fechaPhp = (v) => { const [a, m, d] = v.slice(0, 10).split("-"); return `${d}-${m}-${a}`; };

/** Celdas que escribiría el PHP en una hoja: { "B8": {v, fmt} ... } (fmt: "#,##0" o null). */
function hojaPhp(titulo, emp, ccl, columnas, filas) {
  const celdas = { A4: { v: titulo }, A5: { v: emp || null }, A6: { v: ccl || null } };
  columnas.forEach(([, t], i) => (celdas[`${col(i + 2)}8`] = { v: t, encabezado: true }));
  filas.forEach((r, j) => {
    columnas.forEach(([k, , tipo], i) => {
      let v = r[k] ?? "";
      let fmt = null;
      if (tipo === "concepto") { v = floatval(r[k] ?? 0); if (!k.includes("cantidad")) fmt = "#,##0"; }
      else if (tipo === "liquido") { v = floatval(v); fmt = "#,##0"; }
      else { if (k.includes("fecha") && !empty(v) && v !== "0000-00-00") v = fechaPhp(v); v = binder(v); }
      celdas[`${col(i + 2)}${9 + j}`] = { v, fmt };
    });
  });
  return celdas;
}
function col(n) { let s = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }

(async () => {
  const { pool } = await jiti.import("./lib/db.ts");
  pool.on("error", () => {});
  globalThis._encargadosCc = { filas: await encargados(), en: Date.now() + 1e10 };
  const fq = await jiti.import("./lib/finiquitos/consultas.ts");
  const ex = await jiti.import("./lib/finiquitos/excel.ts");
  const filtros = { empresa, cc, desde, hasta };
  const t0 = Date.now();
  const datos = await fq.consultarFiniquitos(filtros, { correo, rol });
  const t1 = Date.now();
  const buf = await ex.generarExcelFiniquitos(datos, filtros);
  const t2 = Date.now();
  const archivo = path.join(require("../comun.cjs").SALIDA, `prueba_${rol}_${desde.replace(/ /g, "")}_${hasta.replace(/ /g, "")}.xlsx`);
  fs.writeFileSync(archivo, buf);
  console.log(`consulta ${t1 - t0} ms, Excel ${t2 - t1} ms, ${buf.length} bytes -> ${path.basename(archivo)}`);

  // Filas de las consultas originales (texto, como pg_fetch_assoc).
  const val = rol === "administrador" ? "bxcv5bxd855" : rol === "ggo" ? "g46sdf5g4s6df5g" : "0";
  const adm = rol === "rrhh" ? "0" : correo;
  const id = `${empresa ?? "0"},${cc ?? "0"},${desde},${hasta},${adm},${val},0`;
  const c = consultasExcel(id, adm !== "0" ? await correr(sqlAdministrativo(adm)) : []);
  const [o1, o2, o3] = await Promise.all(c.hojas.map((s) => correr(s)));

  // Lo que escribiría el PHP.
  const fijas = FIJAS.filter(([k]) => o1.some((r) => r[k] !== null && r[k] !== undefined && r[k] !== "")).map(([k, t]) => [k, t, "fijo"]);
  const activos = CONC.filter(([k]) => o1.some((r) => floatval(r[k] ?? 0) != 0)).map(([k, t]) => [k, t, "concepto"]);
  const emp = empresa ? `Empresa: ${empresa}` : "";
  const ccl = cc ? `Centro de Costo: ${cc}` : "";
  const esperado = [
    hojaPhp("(título)", emp, ccl, [...fijas, ...activos, ...FIN.map(([k, t]) => [k, t, "fijo"])], o1),
    hojaPhp("Resumen Finiquitos", emp, ccl, RES1.map(([k, t]) => [k, t, k === "liquido_pago" ? "liquido" : "fijo"]), o2),
    hojaPhp("Resumen Obra", emp, ccl, RES2.map(([k, t]) => [k, t, k === "liquido_pago" ? "liquido" : "fijo"]), o3),
  ];

  // Lo que quedó en el archivo.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const nombres = wb.worksheets.map((w) => w.name);
  console.log("hojas:", nombres.join(" | "), "· activa:", wb.views?.[0]?.activeTab ?? 0);
  let difs = 0;
  wb.worksheets.forEach((ws, k) => {
    const esp = esperado[k];
    const vistas = ws.views?.[0] ?? {};
    const filasEsp = Math.max(...Object.keys(esp).map((r) => Number(r.replace(/^[A-Z]+/, ""))));
    console.log(`\n[${ws.name}] filas esperadas hasta ${filasEsp}, en el archivo hasta ${ws.rowCount} · cuadrícula oculta: ${vistas.showGridLines === false} · combinadas: ${JSON.stringify(ws.model.merges)} · altos 1-3: ${[1, 2, 3].map((n) => ws.getRow(n).height).join(",")} · imágenes: ${ws.getImages().length}`);
    console.log(`  A4: «${ws.getCell("A4").value}» (PHP: ${k === 0 ? "«" + "título original" + "»" : "«" + esp.A4.v + "»"}) · A5: «${ws.getCell("A5").value ?? ""}» · A6: «${ws.getCell("A6").value ?? ""}»`);
    // Celdas esperadas
    for (const [ref, e] of Object.entries(esp)) {
      if (ref === "A4" && k === 0) continue;
      const cell = ws.getCell(ref);
      const v = cell.value === undefined ? null : cell.value;
      const vEsp = e.v === "" ? null : e.v;
      const fmt = cell.numFmt && cell.numFmt !== "General" ? cell.numFmt : null;
      const borde = Boolean(cell.border?.top?.style === "thin" && cell.border?.left?.style === "thin");
      const problemas = [];
      if (v !== vEsp && !(typeof v === "number" && typeof vEsp === "number" && Math.abs(v - vEsp) < 1e-9)) problemas.push(`valor ${JSON.stringify(v)} ≠ ${JSON.stringify(vEsp)}`);
      if (/\d$/.test(ref) && Number(ref.replace(/^[A-Z]+/, "")) >= 9 && fmt !== (e.fmt ?? null)) problemas.push(`formato ${fmt} ≠ ${e.fmt}`);
      if (Number(ref.replace(/^[A-Z]+/, "")) >= 8 && !borde) problemas.push("sin borde");
      if (e.encabezado && !(cell.font?.bold && cell.fill?.fgColor?.argb === "FFA0A0A0")) problemas.push("encabezado sin negrita/gris");
      if (problemas.length) { difs++; if (difs <= 15) console.log(`  ${ref}: ${problemas.join("; ")}`); }
    }
    // Celdas que sobran en el archivo
    ws.eachRow((row, n) => row.eachCell((cell) => { if (cell.value !== null && cell.value !== "" && !(cell.address in esp) && !(cell.address === "A4")) { difs++; if (difs <= 15) console.log(`  sobra ${cell.address}: ${cell.value}`); } }));
  });
  console.log(`\nfilas: detalle ${o1.length}, resumen ${o2.length}, obra ${o3.length} · conceptos: ${activos.length} · fijas: ${fijas.map(([k]) => k).join(",")}`);
  console.log(difs ? `DIFERENCIAS: ${difs}` : "IGUAL al PHP celda a celda (salvo el título corregido de la hoja 1)");
  await pool.end().catch(() => {});
  await poolBase.end().catch(() => {});
})().catch((e) => { console.error(e); process.exit(1); });
