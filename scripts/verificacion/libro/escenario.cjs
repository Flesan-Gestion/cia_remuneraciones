// Corre un escenario con la lógica del PHP original (armando el SQL como class_libro_rem.php y
// libro_rem.php) y con la implementación nueva, y compara las columnas del Excel.
// Uso: node escenario.cjs <nombre> <rol 1-5> <correo> <empresa|0> <cc|0> <desde> <hasta>
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
// Las consultas del original cruzan con la copia de encargados (comun.cjs), la única fuente desde 2026-10-07.
const { correr, pool, FUENTES_PHP, SALIDA } = require("../comun.cjs");
const [, , nombre, rol, correo, empresa, cc, fi, ft] = process.argv;
const php = fs.readFileSync(path.join(FUENTES_PHP, "libro_rem_g2/class_libro_rem.php"), "utf8").replace(/\r/g, "").split("\n");
const cuerpo = (d, h) => { const t = php.slice(d - 1, h).join("\n"); return t.slice(t.indexOf('"') + 1, t.lastIndexOf('";')); };
(async () => {
  const q = async (s) => { const r = await correr(s); if (r.error) throw new Error(r.error); return r; };
  // ---- libro_rem.php (navegador): arma «Administrativo,validacion,pl»
  let adm = correo, val = "0", pl = "0";
  if (rol === "1") { val = "bxcv5bxd855"; }
  else if (rol === "5") { val = "g46sdf5g4s6df5g"; }
  else {
    // ver_planta = administrador de la última fila de getCentrosGestion para la empresa
    const cgs = await q(`SELECT e.external_code_empresa,e.nombre_empresa,e.external_code_cc,e.nombre_cc,t.correo,t.administrador
      FROM flesan_rrhh.sap_maestro_empresa_dep_un_cc e LEFT JOIN flesan_rrhh.tabla_encargados_cc t ON (t.llave=(e.external_code_empresa || '-' || e.nombre_empresa || e.external_code_cc|| '-' ||e.nombre_cc))
      WHERE external_code_cc not LIKE 'FL%' AND (correo='${correo}' OR visitador='${correo}')
      GROUP BY e.external_code_empresa,e.nombre_empresa,e.external_code_cc,e.nombre_cc,t.correo,t.administrador ORDER BY nombre_empresa,nombre_cc`);
    const deEmpresa = cgs.filter((r) => (r.external_code_empresa ?? "").trim() === empresa);
    const verPlanta = deEmpresa.length ? (deEmpresa[deEmpresa.length - 1].administrador ?? "").trim() : "";
    const a = await q(`SELECT DISTINCT visitador FROM flesan_rrhh.tabla_encargados_cc WHERE visitador like '%${correo}%'`);
    const administrador = a[0]?.visitador ?? "sin administrador";
    pl = verPlanta === "x" && administrador !== correo ? "NP" : "0";
    if (rol === "2") { adm = "0"; pl = "0"; }
    console.log(`[original] ver_planta=${JSON.stringify(verPlanta)} administrador=${JSON.stringify(administrador)} pl=${pl}`);
  }
  // ---- export_excel_libro.php → class_libro_rem.php
  let where = "";
  if (empresa !== "0") where += ` AND sap_liquidaciones_grupo_flesan_g2.sociedad='${empresa}'`;
  if (cc !== "0") where += ` AND (sap_liquidaciones_grupo_flesan_g2.sociedad||sap_liquidaciones_grupo_flesan_g2.centro_de_coste)=case when '${cc}'='OYM0000755501' then 'OYM755501' else '${cc}' end`;
  let sql;
  if (val === "bxcv5bxd855") {
    sql = cuerpo(208, 412).replace(/\$fecha_inicio/g, fi).replace(/\$fecha_termino/g, ft).replace(/ \$where/g, " " + where);
  } else if (val === "g46sdf5g4s6df5g") {
    sql = cuerpo(448, 505).replace(/\$fecha_inicio/g, fi).replace(/\$fecha_termino/g, ft).replace(/ \$where/g, " " + where).replace(/'%"\.\$Administrativo\."%'/g, `'%${adm}%'`);
  } else {
    if (adm !== "0" && adm !== "" && adm !== "tchahuan@dvc.cl")
      where += ` AND EXISTS (SELECT 1 FROM flesan_rrhh.tabla_encargados_cc e WHERE e.centro_coto=(sap_maestro_colaborador.centro_costo ||'-'|| sap_maestro_colaborador.nombre_centro_costo) AND (e.correo='${adm}' OR e.visitador like '%${adm}%'))`;
    if (pl === "NP") where += ` AND sap_maestro_cargos.planta_noplanta='NP'`;
    const lista = ["manuel.hidalgo@flesan.cl","betsy.ramirez@flesan.cl","cristobal.rojas@flesan.cl","eduardo.cancino@flesan.cl","gsimonet@flesan.cl","ignacio.correa@flesan.cl","jose.allende@flesan.cl","makarena.fernandez@flesan.cl","osvaldo.gonzalez@flesan.cl","tomas.anriquez@flesan.cl","yiturra@flesan.cl"];
    const nfg = lista.includes(adm) ? "" : " AND NOT (sap_liquidaciones_grupo_flesan_g2.sociedad = 'NFG')";
    const r1 = await q(`select * from flesan_rrhh.tabla_encargados_cc where administrativo='${adm}' and administrador IS null`);
    const and = r1.map((r) => ` AND not( (sap_maestro_colaborador.centro_costo ||'-'|| sap_maestro_colaborador.nombre_centro_costo) ='${r.centro_coto}' AND planta_noplanta='PL')`).join("");
    console.log(`[original] nfg=${nfg ? "excluye" : "incluye"} and=${r1.length} cc`);
    sql = cuerpo(793, 997).replace(/'"\.\$fecha_inicio\."'/g, `'${fi}'`).replace(/'"\.\$fecha_termino\."'/g, `'${ft}'`)
      .replace(/"\.\$nfg\." "\.\$where\.\$and\."/g, `${nfg} ${where}${and}`);
  }
  if (/\$[a-z_]+/i.test(sql.replace(/\$\$/g, ""))) throw new Error("Quedó una variable PHP sin reemplazar: " + sql.match(/\$[a-z_]+/i)[0]);
  const orig = await q(sql);
  console.log(`[original] ${orig.length} filas en ${orig.ms} ms`);
  await pool.end();
  fs.writeFileSync(path.join(SALIDA, `esc_${nombre}_orig.json`), JSON.stringify(orig));
  const roles = { 1: "administrador", 2: "rrhh", 3: "administrativo_rrhh", 4: "administrador_obra", 5: "ggo" };
  const filtros = JSON.stringify({ empresa: empresa === "0" ? null : empresa, cc: cc === "0" ? null : cc, desde: fi, hasta: ft });
  const acceso = JSON.stringify({ correo, rol: roles[rol] });
  console.log(execFileSync(process.execPath, [path.join(__dirname, "nuevo.cjs"), filtros, acceso, path.join(SALIDA, `esc_${nombre}_nuevo.json`)]).toString().trim());
  console.log(execFileSync(process.execPath, [path.join(__dirname, "comparar.cjs"), path.join(SALIDA, `esc_${nombre}_orig.json`), path.join(SALIDA, `esc_${nombre}_nuevo.json`)], { cwd: __dirname }).toString().trim());
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
