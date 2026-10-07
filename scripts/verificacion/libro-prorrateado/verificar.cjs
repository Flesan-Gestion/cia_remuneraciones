// Verificación del libro prorrateado: la consulta nueva (lib/libro-prorrateado, cargada con jiti) contra
// la original de libro_rem_dis armada como la arma PHP (orig.cjs). Solo lectura. Ambas cruzan con la
// copia de la tabla de encargados (db/006), como la plataforma.
//   node verificar.cjs <escenarios: admin,rrhh,ggo,listas,periodos,rango> [periodo]
const path = require("path");
const fs = require("fs");
const DIR = __dirname;
const { RAIZ, SALIDA } = require("../comun.cjs");
const { sqlOriginal } = require(path.join(DIR, "orig.cjs"));
const QUE = new Set((process.argv[2] ?? "admin,rrhh,ggo,listas,periodos").split(","));
const PERIODO = process.argv[3] ?? "202609";
process.chdir(RAIZ);
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
process.env.AUTH_DISABLED = "false";
const { createJiti } = require(path.resolve("node_modules/jiti"));
const jiti = createJiti(path.join(RAIZ, "x.js"), { alias: { "@": RAIZ } });
const hora = () => new Date().toISOString().slice(11, 19);
const texto = { getTypeParser: () => (v) => v };

const FIJAS = ["sociedad", "cc", "nombre_completo", "rut", "np", "cargo", "tipo_contrato", "fecha_ingreso", "fecha_estimada_termino", "fecha_retiro", "dias", "porcentaje", "nombre_clasificacion_gasto", "ames", "planta"];

(async () => {
  const { pool } = await jiti.import("./lib/db.ts");
  pool.on("error", () => {});
  const enc = await jiti.import("./lib/encargados-cc.ts");
  const { Pool } = require(path.resolve("node_modules/pg"));
  const plat = new Pool({ connectionString: process.env.DATABASE_URL_PLATAFORMA, max: 1 });
  const { rows: copia } = await plat.query(`SELECT id, ${enc.COLUMNAS_ENCARGADOS.join(", ")} FROM ${process.env.ESQUEMA_PLATAFORMA}.encargados_cc ORDER BY id`);
  const { rows: roles } = await plat.query(`SELECT correo, rol_remuneraciones FROM ${process.env.ESQUEMA_PLATAFORMA}.usuarios WHERE rol_remuneraciones IS NOT NULL ORDER BY correo`);
  await plat.end();
  globalThis._encargadosCc = { filas: copia, en: Date.now() + 1e10 };

  const pr = await jiti.import("./lib/libro-prorrateado/consultas.ts");
  const { CONCEPTOS } = await jiti.import("./lib/libro-prorrateado/conceptos.ts");

  /** La consulta original, como texto (pg_fetch_assoc), cruzando con la copia si nombra la tabla de encargados. */
  async function original(sql) {
    const params = [];
    // El PHP califica columnas con «tabla_encargados_cc.»: al cruzar con la copia se conserva ese alias.
    const conAlias = sql.replace(/flesan_rrhh.tabla_encargados_cc(?!s+(ASs+)?[a-z])/g, "flesan_rrhh.tabla_encargados_cc AS tabla_encargados_cc");
    const s = sql.includes("flesan_rrhh.tabla_encargados_cc") ? enc.conEncargados(conAlias, params, copia) : sql;
    const c = await pool.connect();
    try {
      await c.query("BEGIN READ ONLY");
      const r = await c.query({ text: s, values: params, types: texto });
      await c.query("COMMIT");
      return r.rows;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      return { error: e.message };
    } finally {
      c.release();
    }
  }

  const igualConcepto = (o, n) => o === n || (n == null && (o == null || o === "0" || o === "-0"));
  const resumen = { escenarios: 0, iguales: 0, distintos: [] };

  async function comparar(nombre, filtros, acceso, id, { esperarDobles = false } = {}) {
    resumen.escenarios++;
    const t0 = Date.now();
    const nuevas = await pr.consultarProrrateado(filtros, acceso);
    const t1 = Date.now();
    const { sql } = sqlOriginal(id);
    const orig = await original(sql);
    const t2 = Date.now();
    if (orig.error) {
      console.log(`${hora()} ${nombre}: original con error (${orig.error}); nueva ${nuevas.length} filas`);
      resumen.distintos.push({ nombre, motivo: "original con error" });
      return;
    }
    const difs = [];
    const n = Math.max(orig.length, nuevas.length);
    for (let i = 0; i < n && difs.length < 2000; i++) {
      const o = orig[i];
      const v = nuevas[i];
      if (!o || !v) {
        difs.push({ i, motivo: !o ? "sobra en nueva" : "falta en nueva", o: o && FIJAS.map((k) => o[k]).join("|"), v: v && FIJAS.map((k) => v[k]).join("|") });
        continue;
      }
      const malas = [];
      for (const k of FIJAS) if (String(o[k] ?? "") !== String(v[k] ?? "")) malas.push(`${k}: ${o[k]} → ${v[k]}`);
      for (const c of CONCEPTOS) if (!igualConcepto(o[c.clave], v[c.clave])) malas.push(`${c.clave}: ${o[c.clave]} → ${v[c.clave]}`);
      if (malas.length) difs.push({ i, np: o.np, cc: o.cc, ames: o.ames, malas });
    }
    const ms = `nueva ${t1 - t0} ms, original ${t2 - t1} ms`;
    if (!difs.length) {
      resumen.iguales++;
      console.log(`${hora()} OK ${nombre}: ${orig.length} filas iguales (${ms})`);
      return;
    }
    if (esperarDobles) {
      // GGO corregido: solo pueden diferir filas cuyo original es exactamente el doble de la nueva.
      const noDobles = difs.filter((d) => !d.malas || d.malas.some((m) => {
        const [, a, b] = /: (.*) → (.*)$/.exec(m) ?? [];
        const x = Number(a), y = b === "undefined" ? 0 : Number(b);
        return m.startsWith("porcentaje") || !(Number.isFinite(x) && (Math.abs(x - 2 * y) < 1e-9 || Math.abs(x - 2 * y) <= 1 || (a === "0" && y === 0)));
      }));
      const ccs = [...new Set(difs.map((d) => d.cc))];
      console.log(`${hora()} ${noDobles.length ? "DIFERENCIA" : "OK (corregido)"} ${nombre}: ${orig.length} filas; ${difs.length} distintas, todas al doble en el original: ${!noDobles.length} · CC: ${ccs.join(", ")} (${ms})`);
      if (noDobles.length) {
        resumen.distintos.push({ nombre, difs: noDobles.slice(0, 3) });
        console.log(JSON.stringify(noDobles.slice(0, 2), null, 1));
      } else resumen.iguales++;
      return;
    }
    resumen.distintos.push({ nombre, filas: [orig.length, nuevas.length], difs: difs.slice(0, 3) });
    console.log(`${hora()} DIFERENCIA ${nombre}: original ${orig.length}, nueva ${nuevas.length}, ${difs.length} filas distintas (${ms})`);
    console.log(JSON.stringify(difs.slice(0, 3), null, 1));
  }

  const admin = { correo: "jorge.barrozo@flesan.cl", rol: "administrador" };
  const rrhh = { correo: "rrhh.prueba@flesan.cl", rol: "rrhh" };
  const id = (f, acceso) => {
    const e = f.empresa ?? "0";
    const cc = f.cc ?? "0";
    if (acceso.rol === "administrador") return `${e},${cc},${f.desde},${f.hasta},${acceso.correo},bxcv5bxd855,0`;
    if (acceso.rol === "ggo") return `${e},${cc},${f.desde},${f.hasta},${acceso.correo},g46sdf5g4s6df5g,0`;
    return `${e},${cc},${f.desde},${f.hasta},0,0,0`;
  };
  const caso = (nombre, f, acceso, op) => comparar(nombre, f, acceso, id(f, acceso), op);
  const empresas = await pr.listarEmpresasProrrateado(admin);

  if (QUE.has("admin")) {
    await caso(`admin todas ${PERIODO}`, { empresa: null, cc: null, desde: PERIODO, hasta: PERIODO }, admin);
    for (const e of empresas) await caso(`admin ${e.codigo} ${PERIODO}`, { empresa: e.codigo, cc: null, desde: PERIODO, hasta: PERIODO }, admin);
    for (const e of empresas.slice(0, 6)) {
      for (const c of e.centros.slice(0, 2)) await caso(`admin ${e.codigo}/${c.codigo} ${PERIODO}`, { empresa: e.codigo, cc: c.codigo, desde: PERIODO, hasta: PERIODO }, admin);
    }
    await caso(`admin todas 202401-202403`, { empresa: null, cc: null, desde: "202401", hasta: "202403" }, admin);
  }
  if (QUE.has("rango")) {
    await caso(`admin todas 202601-${PERIODO}`, { empresa: null, cc: null, desde: "202601", hasta: PERIODO }, admin);
    await caso(`rrhh CFM 202501-${PERIODO}`, { empresa: "CFM", cc: null, desde: "202501", hasta: PERIODO }, rrhh);
  }
  if (QUE.has("rrhh")) {
    for (const e of empresas) await caso(`rrhh ${e.codigo} ${PERIODO}`, { empresa: e.codigo, cc: null, desde: PERIODO, hasta: PERIODO }, rrhh);
    await caso(`rrhh DM/CC ${PERIODO}`, { empresa: "DM", cc: empresas.find((e) => e.codigo === "DM")?.centros[0]?.codigo ?? null, desde: PERIODO, hasta: PERIODO }, rrhh);
    await caso(`rrhh NFG ${PERIODO}`, { empresa: "NFG", cc: null, desde: "202401", hasta: PERIODO }, rrhh);
  }
  if (QUE.has("ggo")) {
    for (const r of roles.filter((x) => x.rol_remuneraciones === "ggo" && x.correo !== "tchahuan@dvc.cl")) {
      const g = { correo: r.correo, rol: "ggo" };
      await caso(`ggo ${r.correo} ${PERIODO}`, { empresa: null, cc: null, desde: PERIODO, hasta: PERIODO }, g, { esperarDobles: true });
      await caso(`ggo ${r.correo} 202601-${PERIODO}`, { empresa: null, cc: null, desde: "202601", hasta: PERIODO }, g, { esperarDobles: true });
      const lista = await pr.listarEmpresasProrrateado(g);
      if (lista[0]) await caso(`ggo ${r.correo} ${lista[0].codigo} ${PERIODO}`, { empresa: lista[0].codigo, cc: null, desde: PERIODO, hasta: PERIODO }, g, { esperarDobles: true });
      if (lista[0]?.centros[0]) await caso(`ggo ${r.correo} ${lista[0].codigo}/${lista[0].centros[0].codigo}`, { empresa: lista[0].codigo, cc: lista[0].centros[0].codigo, desde: "202601", hasta: PERIODO }, g, { esperarDobles: true });
    }
  }
  if (QUE.has("listas")) {
    // getCentrosGestion1 / 2 / (encargado) agrupados como PHP, contra la lista nueva.
    const phpAgrupar = (filas) => {
      const m = new Map();
      for (const f of filas) {
        const k = (f.external_code_empresa ?? "").trim();
        if (!m.has(k)) m.set(k, { codigo: k, nombre: "", centros: [] });
        const e = m.get(k);
        e.nombre = (f.nombre_empresa ?? "").trim();
        const cc = { codigo: (f.external_code_cc ?? "").trim(), nombre: (f.nombre_cc ?? "").trim() };
        if (!e.centros.some((c) => c.codigo === cc.codigo && c.nombre === cc.nombre)) e.centros.push(cc);
      }
      return [...m.values()];
    };
    const P = "c:/Users/martin.norambuena/Desktop/Aplicativos/liquidaciones_cia/libro_rem_dis/class_libro_rem_dist.php";
    const lineas = fs.readFileSync(P, "utf8").replace(/\r\n/g, "\n").split("\n");
    const tpl = (desde, hasta) => lineas.slice(desde - 1, hasta).join("\n").replace(/^[\s\S]*?query = "/, "").replace(/";\s*$/, "");
    const cg1 = tpl(58, 83), cg2 = tpl(105, 110), cg = tpl(37, 42);
    const cmp = (nombre, a, b) => {
      if (!Array.isArray(a)) { resumen.distintos.push({ nombre }); return console.log(`${hora()} ERROR original ${nombre}: ${a.error}`); }
      resumen.escenarios++;
      const s = (x) => JSON.stringify(x.map(({ codigo, nombre, centros }) => ({ codigo, nombre, centros })));
      const orden = (x) => JSON.stringify(x.map(({ codigo, nombre, centros }) => ({ codigo, nombre, centros: [...centros].sort((p, q) => (p.codigo + p.nombre).localeCompare(q.codigo + q.nombre)) })).sort((p, q) => p.codigo.localeCompare(q.codigo)));
      if (s(a) === s(b)) { resumen.iguales++; return console.log(`${hora()} OK ${nombre}: ${a.length} empresas, ${a.reduce((n, e) => n + e.centros.length, 0)} CC`); }
      if (orden(a) === orden(b)) { resumen.iguales++; return console.log(`${hora()} OK (mismo contenido, otro orden de empates) ${nombre}`); }
      resumen.distintos.push({ nombre });
      console.log(`${hora()} DIFERENCIA ${nombre}`, s(a).slice(0, 400), "\n vs ", s(b).slice(0, 400));
    };
    const o1 = await original(cg1);
    cmp("lista admin/rrhh (getCentrosGestion1)", Array.isArray(o1) ? phpAgrupar(o1) : o1, await pr.listarEmpresasProrrateado(admin));
    for (const r of roles.filter((x) => x.rol_remuneraciones === "ggo" && x.correo !== "tchahuan@dvc.cl")) {
      const g = { correo: r.correo, rol: "ggo" };
      const esGgo = (await original(`SELECT DISTINCT correo_ggo FROM flesan_rrhh.tabla_encargados_cc WHERE correo_ggo like '%${r.correo}%' limit 1`)).length > 0;
      const o = esGgo ? await original(cg2.replace("\".$correo_ggo.\"", r.correo)) : await original(cg.replace("\".$correo_administrador.\"", r.correo).replace("\".$correo_visitador.\"", r.correo));
      cmp(`lista ggo ${r.correo} (${esGgo ? "getCentrosGestion2" : "getCentrosGestion"})`, Array.isArray(o) ? phpAgrupar(o) : o, await pr.listarEmpresasProrrateado(g));
    }
  }
  if (QUE.has("periodos")) {
    resumen.escenarios++;
    const o = (await original(`SELECT  distinct periodo_para_nomina FROM flesan_rrhh.sap_liquidaciones_grupo_flesan_g2 WHERE NOT (periodo_para_nomina = '000000') AND (periodo_para_nomina||'01')::INTEGER<=(replace(CURRENT_DATE::TEXT,'-',''))::INTEGER-100 order by periodo_para_nomina desc`)).map((r) => r.periodo_para_nomina);
    const n = await pr.listarPeriodosProrrateado();
    if (JSON.stringify(o) === JSON.stringify(n)) { resumen.iguales++; console.log(`${hora()} OK periodos: ${n.length} (${n[0]} … ${n[n.length - 1]})`); }
    else { resumen.distintos.push({ nombre: "periodos" }); console.log(`${hora()} DIFERENCIA periodos`, o.slice(0, 3), n.slice(0, 3), o.length, n.length); }
  }
  console.log(`${hora()} FIN`, JSON.stringify({ ...resumen, distintos: resumen.distintos.map((d) => d.nombre) }));
  await pool.end().catch(() => {});
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
