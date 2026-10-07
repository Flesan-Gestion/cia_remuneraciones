// Prueba sintética: una copia de encargados modificada SOLO en memoria (nada se escribe) para ejercitar
// reglas que hoy ningún encargado con finiquitos activa: CC de «administrativo» sin planta (también con
// centro_coto nulo), visitador en una lista con comas, la rama de tchahuan@dvc.cl y los CC repetidos.
const path = require("path");
const { correr, encargados, fijarEncargados, pool: poolBase, RAIZ } = require("../comun.cjs");
const { consultasExcel, sqlAdministrativo } = require("./orig.cjs");
process.chdir(RAIZ);
const { createJiti } = require(path.resolve("node_modules/jiti"));
const jiti = createJiti(path.join(RAIZ, "x.js"), { alias: { "@": RAIZ } });
const vacia = { llave: null, sociedad: "CFM", centro_coto: null, administrativo: null, correo: null, ver_planta: null, administrador: null, correo_administrador: null, visitador: null, correo_visitador: null, gerente: null, correo_gerente: null, correo_ggo: null, division: null };
(async () => {
  const real = await encargados();
  let id = 900000;
  const fila = (x) => ({ ...vacia, id: id++, ...x });
  const U = "prueba.sintetica@flesan.cl";
  const extra = [
    fila({ centro_coto: "CFMCFM020014-Obra CFM, Desm Y Dem (Wp1 Y Wp2) Montura", correo: U, administrativo: U }),
    fila({ centro_coto: "CFMCFM010010-Dem y Desm Area Humeda 2 -TECK Quebrada", visitador: `otra@flesan.cl,${U}` }),
    fila({ centro_coto: null, administrativo: U }),
    fila({ sociedad: "DM", centro_coto: "DMFOP110125G-FOP - FOP110125G Pavimentos Cerro Castil", correo_ggo: "x@flesan.cl,tchahuan@dvc.cl" }),
    fila({ centro_coto: "CFMCFM020019A-Centro Operacional Antofagasta", correo_ggo: "tchahuan@dvc.cl", administrativo: "tchahuan@dvc.cl" }),
    fila({ centro_coto: "CFMA06CFM-Propuestas Mineria", correo: "prueba.doble@flesan.cl" }),
    fila({ centro_coto: "CFMA06CFM-Propuestas Mineria", correo: "prueba.doble@flesan.cl" }),
  ];
  const copia = [...real, ...extra];
  fijarEncargados(copia);
  const { pool } = await jiti.import("./lib/db.ts");
  pool.on("error", () => {});
  globalThis._encargadosCc = { filas: copia, en: Date.now() + 1e10 };
  const fq = await jiti.import("./lib/finiquitos/consultas.ts");
  const { CONCEPTOS, COLUMNAS_INICIO, COLUMNAS_FIN, COLUMNAS_RESUMEN, COLUMNAS_OBRA } = await jiti.import("./lib/finiquitos/conceptos.ts");
  const CLAVES = [[...COLUMNAS_INICIO, ...CONCEPTOS, ...COLUMNAS_FIN].map((c) => c.clave), COLUMNAS_RESUMEN.map((c) => c.clave), COLUMNAS_OBRA.map((c) => c.clave)];
  const R = "202607Semana 4,202610Semana 1";
  for (const [nombre, acceso, idPhp, dobles] of [
    ["encargado sintético (administrativo sin planta, visitador en lista, centro nulo)", { correo: U, rol: "administrativo_rrhh" }, `0,0,${R},${U},0,0`],
    ["tchahuan@dvc.cl con CC de GGO sintéticos", { correo: "tchahuan@dvc.cl", rol: "ggo" }, `0,0,${R},tchahuan@dvc.cl,g46sdf5g4s6df5g,0`],
    ["encargado de un CC repetido (el original duplica)", { correo: "prueba.doble@flesan.cl", rol: "administrativo_rrhh" }, `0,0,${R},prueba.doble@flesan.cl,0,0`, true],
    ["administrador con un CC repetido (el original duplica)", { correo: "a@flesan.cl", rol: "administrador" }, `0,0,${R},a@flesan.cl,bxcv5bxd855,0`, true],
  ]) {
    const adm = idPhp.split(",")[4];
    const c = consultasExcel(idPhp, await correr(sqlAdministrativo(adm)));
    const orig = await Promise.all(c.hojas.map((s) => correr(s)));
    const nuevo = await fq.consultarFiniquitos({ empresa: null, cc: null, desde: "202607Semana 4", hasta: "202610Semana 1" }, acceso);
    const hojas = [nuevo.detalle, nuevo.resumen, nuevo.obra];
    const malas = [];
    let alDoble = 0;
    hojas.forEach((n, k) => {
      const o = orig[k];
      if (o.error) return malas.push(`hoja ${k + 1}: error ${o.error}`);
      if (o.length !== n.length) malas.push(`hoja ${k + 1}: original ${o.length}, nueva ${n.length}`);
      for (let i = 0; i < Math.min(o.length, n.length); i++) for (const clave of CLAVES[k]) {
        const a = o[i][clave] ?? null, b = n[i][clave] ?? null;
        if (a === b) continue;
        if (dobles && Number(a) === 2 * Number(b)) { alDoble++; continue; }
        malas.push(`hoja ${k + 1} fila ${i} ${clave}: ${a} → ${b}`);
        break;
      }
    });
    const filas = orig.map((o) => o.length ?? o.error).join("/");
    console.log(`${malas.length ? "DIFERENCIA" : "OK"} ${nombre}: ${filas} filas${dobles ? ` · valores al doble en el original: ${alDoble}` : ""}${malas.length ? "\n   " + malas.slice(0, 5).join("\n   ") : ""}`);
  }
  await pool.end().catch(() => {});
  await poolBase.end().catch(() => {});
})().catch((e) => { console.error(e); process.exit(1); });
