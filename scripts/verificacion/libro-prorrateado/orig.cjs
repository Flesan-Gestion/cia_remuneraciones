// Arma el SQL del aplicativo antiguo libro_rem_dis exactamente como lo hace PHP
// (libro_rem_dist_excel.php + class_libro_rem_dist.php), a partir del texto de las plantillas.
const fs = require("fs");
const path = require("path");
const DIR = __dirname;

function plantilla(archivo) {
  let t = fs.readFileSync(path.join(DIR, "plantillas", archivo), "utf8").replace(/\r\n/g, "\n");
  t = t.replace(/^\s*\$query = "/, "");
  t = t.replace(/";\s*$/, "");
  return t;
}
const T = { valid: plantilla("orig_valid.txt"), ggo: plantilla("orig_ggo.txt"), main: plantilla("orig_main.txt"), tch: plantilla("orig_tch.txt") };

const NFG_LISTA = [
  "manuel.hidalgo@flesan.cl", "betsy.ramirez@flesan.cl", "cristobal.rojas@flesan.cl", "eduardo.cancino@flesan.cl", "gsimonet@flesan.cl",
  "ignacio.correa@flesan.cl", "jose.allende@flesan.cl", "makarena.fernandez@flesan.cl", "osvaldo.gonzalez@flesan.cl", "tomas.anriquez@flesan.cl", "yiturra@flesan.cl",
];

/** PHP: $a != '0' entre strings (comparación numérica si ambos son numéricos). */
const distintoDeCero = (v) => !(v === "0" || (/^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(v) && Number(v) === 0));

function whereBase(empresa, cc) {
  let where = "";
  if (distintoDeCero(empresa)) where += " AND libro_rem_nuevo.sociedad='" + empresa + "'";
  if (distintoDeCero(cc)) where += " AND (sap_maestro_empresa_dep_un_cc.external_code_cc)=case when '" + cc + "'='OYM0000755501' then 'OYM755501' else '" + cc + "' end";
  return where;
}

/**
 * id = "empresa,cc,fi,ft,Administrativo,validacion,pl" (el ?id= de la URL del antiguo).
 * filasAdministrativo: filas de `select * from tabla_encargados_cc where administrativo='X' and administrador IS null`
 * (solo para getLibroREM). Devuelve { funcion, sql }.
 */
function sqlOriginal(id, filasAdministrativo = []) {
  const parts = id.split(",");
  const empresa = parts[0] ?? "0";
  const cc = parts[1] ?? "0";
  const fi = parts[2] ?? "";
  const ft = parts[3] ?? "";
  const Administrativo = parts[4] ?? "";
  let validacion = parts[5] ?? "";
  const pl = parts[6] ?? "";
  if (Administrativo === "tchahuan@dvc.cl") validacion = "";

  if (validacion === "bxcv5bxd855") {
    const where = whereBase(empresa, cc);
    const sql = T.valid.replace("'$fecha_inicio'", "'" + fi + "'").replace("'$fecha_termino' \".$where.\"", "'" + ft + "' " + where);
    return { funcion: "getLibroREMvalidacion", sql };
  }
  if (validacion === "g46sdf5g4s6df5g") {
    let where = whereBase(empresa, cc);
    if (empresa === "0" && cc === "0" && Administrativo === "0") where = "";
    const sql = T.ggo
      .replace("'%\".$Administrativo.\"%'", "'%" + Administrativo + "%'")
      .replace("'$fecha_inicio'", "'" + fi + "'")
      .replace("'$fecha_termino' \".$where.\"", "'" + ft + "' " + where);
    return { funcion: "getLibroREMGGO", sql };
  }
  let where = whereBase(empresa, cc);
  if (Administrativo !== "0" && Administrativo !== "" && Administrativo !== "tchahuan@dvc.cl") {
    where += " AND (tabla_encargados_cc.correo='" + Administrativo + "' OR tabla_encargados_cc.visitador like '%" + Administrativo + "%')";
  } else if (Administrativo !== "0" && Administrativo !== "" && Administrativo === "tchahuan@dvc.cl") {
    where += " AND (tabla_encargados_cc.correo_ggo like '%" + Administrativo + "%')";
  }
  if (pl === "NP") where += " AND libro_rem_nuevo.planta='NP'";
  let nfg = " AND NOT (libro_rem_nuevo.sociedad = 'NFG')";
  if (NFG_LISTA.includes(Administrativo)) nfg = "";
  let and = "";
  for (const r of filasAdministrativo) {
    and += " AND not( (sap_maestro_colaborador.centro_costo ||'-'|| sap_maestro_colaborador.nombre_centro_costo) ='" + r.centro_coto + "' AND planta_noplanta='PL')";
  }
  const t = Administrativo === "tchahuan@dvc.cl" ? T.tch : T.main;
  const sql = t.replace(
    "'\".$fecha_inicio.\"' AND replace(libro_rem_nuevo.ames,'-','') <= '\".$fecha_termino.\"'\".$nfg.\"  \".$where.$and.\"",
    "'" + fi + "' AND replace(libro_rem_nuevo.ames,'-','') <= '" + ft + "'" + nfg + "  " + where + and,
  );
  return { funcion: "getLibroREM", sql };
}

module.exports = { sqlOriginal };

if (require.main === module) {
  const { sql, funcion } = sqlOriginal(process.argv[2]);
  if (/\$[a-zA-Z_]|"\./.test(sql)) throw new Error("Quedó PHP sin reemplazar en " + funcion);
  fs.writeFileSync(process.argv[3], sql);
  console.log(funcion, "->", process.argv[3]);
}
