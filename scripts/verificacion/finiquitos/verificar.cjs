// Verificación de Finiquitos: lib/finiquitos/consultas.ts (cargada con jiti) contra las consultas de
// finiquito_rem armadas como las arma PHP (orig.cjs), hoja por hoja, fila por fila y en el mismo orden.
// Solo lectura. Ambas cruzan con la copia de la tabla de encargados (db/006), como la plataforma.
//   node verificar.cjs <escenarios: admin,rrhh,encargados,tch,ggo,listas,semanas> [desde] [hasta]
const path = require("path");
const fs = require("fs");
const { correr, encargados, plataforma, pool: poolBase, RAIZ } = require("../comun.cjs");
const { consultasExcel, sqlAdministrativo, sueltas } = require("./orig.cjs");
const QUE = new Set((process.argv[2] ?? "admin,rrhh,encargados,tch,ggo,listas,semanas").split(","));
const DESDE = process.argv[3] ?? "202607Semana 4";
const HASTA = process.argv[4] ?? "202610Semana 1";
process.chdir(RAIZ);
process.env.AUTH_DISABLED = "false";
const { createJiti } = require(path.resolve("node_modules/jiti"));
const jiti = createJiti(path.join(RAIZ, "x.js"), { alias: { "@": RAIZ } });
const hora = () => new Date().toISOString().slice(11, 19);

(async () => {
  const { pool } = await jiti.import("./lib/db.ts");
  pool.on("error", () => {});
  globalThis._encargadosCc = { filas: await encargados(), en: Date.now() + 1e10 };
  const fq = await jiti.import("./lib/finiquitos/consultas.ts");
  const { CONCEPTOS, COLUMNAS_INICIO, COLUMNAS_FIN, COLUMNAS_RESUMEN, COLUMNAS_OBRA } = await jiti.import("./lib/finiquitos/conceptos.ts");
  const CLAVES = {
    detalle: [...COLUMNAS_INICIO.map((c) => c.clave), ...CONCEPTOS.map((c) => c.clave), ...COLUMNAS_FIN.map((c) => c.clave)],
    resumen: COLUMNAS_RESUMEN.map((c) => c.clave),
    obra: COLUMNAS_OBRA.map((c) => c.clave),
  };
  const roles = await plataforma(`SELECT correo, rol_remuneraciones FROM ${process.env.ESQUEMA_PLATAFORMA}.usuarios WHERE rol_remuneraciones IS NOT NULL ORDER BY correo`);
  const resumen = { escenarios: 0, iguales: 0, distintos: [] };
  const tiempos = [];

  /** id del antiguo («empresa,cc,fi,ft,Administrativo,validacion,pl») como lo armaba finiquito_rem.php. */
  const idDe = (f, a) => {
    const base = `${f.empresa ?? "0"},${f.cc ?? "0"},${f.desde},${f.hasta}`;
    if (a.rol === "administrador") return `${base},${a.correo},bxcv5bxd855,0`;
    if (a.rol === "ggo") return `${base},${a.correo},g46sdf5g4s6df5g,0`;
    if (a.rol === "rrhh") return `${base},0,0,0`;
    return `${base},${a.correo},0,0`; // ver_planta nunca se llenaba: siempre ",0,0"
  };

  async function comparar(nombre, filtros, acceso) {
    resumen.escenarios++;
    const id = idDe(filtros, acceso);
    const adm = id.split(",")[4];
    const filasAdm = adm && adm !== "0" ? await correr(sqlAdministrativo(adm)) : [];
    const c = consultasExcel(id, filasAdm);
    const t0 = Date.now();
    const nuevo = await fq.consultarFiniquitos(filtros, acceso);
    const t1 = Date.now();
    if (c.error) {
      const vacio = !nuevo.detalle.length && !nuevo.resumen.length && !nuevo.obra.length;
      if (vacio) resumen.iguales++;
      else resumen.distintos.push({ nombre, motivo: "el antiguo fallaba y la nueva trae filas" });
      console.log(`${hora()} ${vacio ? "OK" : "DIFERENCIA"} ${nombre}: el antiguo fallaba (${c.error}); nueva sin filas: ${vacio}`);
      return;
    }
    const orig = await Promise.all(c.hojas.map((s) => correr(s)));
    const t2 = Date.now();
    tiempos.push({ nombre, nueva: t1 - t0, original: t2 - t1 });
    const malas = [];
    ["detalle", "resumen", "obra"].forEach((h, k) => {
      const o = orig[k];
      const n = nuevo[h];
      if (o.error) return malas.push(`${h}: original con error ${o.error}`);
      if (o.length !== n.length) malas.push(`${h}: original ${o.length} filas, nueva ${n.length}`);
      for (let i = 0; i < Math.min(o.length, n.length) && malas.length < 6; i++) {
        for (const clave of CLAVES[h]) {
          const a = o[i][clave] ?? null;
          const b = n[i][clave] ?? null;
          if (a !== b) {
            malas.push(`${h} fila ${i} (np ${o[i].np ?? ""}, ${o[i].cc}, ${o[i].ames} ${o[i].semana}) ${clave}: ${a} → ${b}`);
            break;
          }
        }
      }
    });
    const filas = `${orig[0].length}/${orig[1].length}/${orig[2].length} filas`;
    if (!malas.length) {
      resumen.iguales++;
      console.log(`${hora()} OK ${nombre}: ${filas} iguales (nueva ${t1 - t0} ms, original ${t2 - t1} ms)`);
    } else {
      resumen.distintos.push({ nombre, malas });
      console.log(`${hora()} DIFERENCIA ${nombre}: ${filas}\n   ${malas.join("\n   ")}`);
    }
  }

  const rango = { empresa: null, cc: null, desde: DESDE, hasta: HASTA };
  const semanas = await fq.listarSemanas();
  const admin = { correo: "jorge.barrozo@flesan.cl", rol: "administrador" };
  const rrhh = { correo: "rrhh.prueba@flesan.cl", rol: "rrhh" };
  const { empresas } = await fq.listarEmpresasFiniquitos(admin);

  if (QUE.has("admin")) {
    await comparar("admin todo", rango, admin);
    for (const s of semanas) await comparar(`admin ${s}`, { ...rango, desde: s, hasta: s }, admin);
    for (const e of empresas) await comparar(`admin ${e.codigo}`, { ...rango, empresa: e.codigo }, admin);
    for (const e of empresas) for (const cc of e.centros.slice(0, 3)) await comparar(`admin ${e.codigo}/${cc.codigo}`, { ...rango, empresa: e.codigo, cc: cc.codigo }, admin);
    await comparar("admin rango invertido", { ...rango, desde: HASTA, hasta: DESDE }, admin);
  }
  if (QUE.has("rrhh")) {
    await comparar("rrhh todo", rango, rrhh);
    for (const s of semanas.slice(0, 4)) await comparar(`rrhh ${s}`, { ...rango, desde: s, hasta: s }, rrhh);
    for (const e of empresas) await comparar(`rrhh ${e.codigo}`, { ...rango, empresa: e.codigo }, rrhh);
    await comparar("rrhh NFG", { ...rango, empresa: "NFG" }, rrhh);
  }
  if (QUE.has("encargados")) {
    for (const r of roles.filter((x) => x.rol_remuneraciones === "administrativo_rrhh" || x.rol_remuneraciones === "administrador_obra")) {
      const a = { correo: r.correo, rol: r.rol_remuneraciones };
      await comparar(`encargado ${r.correo}`, rango, a);
      const lista = (await fq.listarEmpresasFiniquitos(a)).empresas;
      if (lista[0]) await comparar(`encargado ${r.correo} ${lista[0].codigo}`, { ...rango, empresa: lista[0].codigo }, a);
      if (lista[0]?.centros[0]) await comparar(`encargado ${r.correo} ${lista[0].codigo}/${lista[0].centros[0].codigo}`, { ...rango, empresa: lista[0].codigo, cc: lista[0].centros[0].codigo }, a);
    }
  }
  if (QUE.has("tch")) await comparar("ggo tchahuan@dvc.cl", rango, { correo: "tchahuan@dvc.cl", rol: "ggo" });
  if (QUE.has("ggo")) {
    for (const r of roles.filter((x) => x.rol_remuneraciones === "ggo" && x.correo !== "tchahuan@dvc.cl")) await comparar(`ggo ${r.correo}`, rango, { correo: r.correo, rol: "ggo" });
  }
  if (QUE.has("listas")) {
    // getCentrosGestion1 agrupado como PHP (clave código_nombre) contra la lista nueva; y la de cada encargado y GGO con acceso.
    const phpCg1 = (filas) => {
      const m = new Map();
      for (const f of filas) {
        const k = `${(f.external_code_empresa ?? "").trim()}_${(f.nombre_empresa ?? "").trim()}`;
        if (!m.has(k)) m.set(k, { clave: k, nombre: (f.nombre_empresa ?? "").trim(), centros: [] });
        const e = m.get(k);
        const cc = { codigo: (f.external_code_cc ?? "").trim(), nombre: (f.nombre_cc ?? "").trim() };
        if (!e.centros.some((c) => c.codigo === cc.codigo && c.nombre === cc.nombre)) e.centros.push(cc);
      }
      return [...m.values()];
    };
    const phpCg = (filas) => {
      const m = new Map();
      for (const f of filas) {
        const k = (f.external_code_empresa ?? "").trim();
        if (!m.has(k)) m.set(k, { clave: k, nombre: "", centros: [] });
        const e = m.get(k);
        e.nombre = (f.nombre_empresa ?? "").trim();
        const cc = { codigo: (f.external_code_cc ?? "").trim(), nombre: (f.nombre_cc ?? "").trim() };
        if (!e.centros.some((c) => c.codigo === cc.codigo && c.nombre === cc.nombre)) e.centros.push(cc);
      }
      return [...m.values()];
    };
    const s = (x) => JSON.stringify(x.map((e) => ({ clave: e.clave ?? e.codigo, nombre: e.nombre, centros: e.centros })));
    const cmp = (nombre, a, b) => {
      resumen.escenarios++;
      if (s(a) === s(b)) { resumen.iguales++; return console.log(`${hora()} OK ${nombre}: ${a.length} empresas, ${a.reduce((n, e) => n + e.centros.length, 0)} CC`); }
      resumen.distintos.push({ nombre });
      console.log(`${hora()} DIFERENCIA ${nombre}\n   ${s(a).slice(0, 300)}\n   ${s(b).slice(0, 300)}`);
    };
    cmp("lista admin/rrhh (getCentrosGestion1)", phpCg1(await correr(sueltas.getCentrosGestion1())), empresas);
    let formularios = 0;
    for (const r of roles.filter((x) => !["administrador", "rrhh"].includes(x.rol_remuneraciones))) {
      const a = { correo: r.correo, rol: r.rol_remuneraciones };
      const nueva = await fq.listarEmpresasFiniquitos(a);
      if (r.rol_remuneraciones === "ggo" && r.correo !== "tchahuan@dvc.cl") {
        resumen.escenarios++;
        if (!nueva.empresas.length && !nueva.formulario) resumen.iguales++; else resumen.distintos.push({ nombre: `lista ggo ${r.correo}` });
        continue;
      }
      const esGgo = (await correr(sueltas.ggo(r.correo))).length > 0;
      const o = await correr(esGgo ? sueltas.getCentrosGestion2(r.correo) : sueltas.getCentrosGestion(r.correo));
      const lista = phpCg(o);
      const acceso = (await correr(sueltas.acceso(r.correo))).length > 0;
      const form = acceso || lista.length > 0 || esGgo;
      if (form !== nueva.formulario) resumen.distintos.push({ nombre: `formulario ${r.correo}`, php: form, nueva: nueva.formulario });
      if (form) formularios++;
      cmp(`lista ${r.rol_remuneraciones} ${r.correo} (${esGgo ? "getCentrosGestion2" : "getCentrosGestion"}; formulario ${form})`, lista, nueva.empresas);
    }
    console.log(`${hora()} encargados/GGO con formulario: ${formularios}`);
  }
  if (QUE.has("semanas")) {
    resumen.escenarios++;
    const o = (await correr(sueltas.getfecha())).map((r) => `${r.periodo_para_nomina ?? ""}${r.semana ?? ""}`);
    if (JSON.stringify(o) === JSON.stringify(semanas)) { resumen.iguales++; console.log(`${hora()} OK semanas: ${semanas.join(" | ")}`); }
    else { resumen.distintos.push({ nombre: "semanas" }); console.log(`${hora()} DIFERENCIA semanas`, o, semanas); }
  }
  fs.writeFileSync(path.join(require("../comun.cjs").SALIDA, "tiempos.json"), JSON.stringify(tiempos, null, 1));
  console.log(`${hora()} FIN`, JSON.stringify({ ...resumen, distintos: resumen.distintos.map((d) => d.nombre) }));
  await pool.end().catch(() => {});
  await poolBase.end().catch(() => {});
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
