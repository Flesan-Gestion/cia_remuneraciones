// Arma el SQL del aplicativo antiguo finiquito_rem EXACTAMENTE como lo arma PHP, leyendo el texto de
// class_finiquito_rem.php (las expresiones `$query = "...".$x."...";`) y evaluándolas con las mismas
// variables. El flujo (where, nfg, and) replica cada función del PHP línea a línea.
const fs = require("fs");
const path = require("path");
const PHP = path.join(require("../comun.cjs").FUENTES_PHP, "finiquito_rem/class_finiquito_rem.php");
const fuente = fs.readFileSync(PHP, "utf8").replace(/\r\n/g, "\n");

/** Cuerpo de cada método público. */
const cuerpos = {};
{
  const re = /public function (\w+)\s*\(/g;
  const marcas = [...fuente.matchAll(re)].map((m) => ({ nombre: m[1], i: m.index }));
  marcas.forEach((m, k) => (cuerpos[m.nombre] = fuente.slice(m.i, k + 1 < marcas.length ? marcas[k + 1].i : fuente.length)));
}

/** Expresiones asignadas a `$<variable> = ` dentro de un método (en orden), como texto PHP crudo. */
function expresiones(metodo, variable = "query") {
  const cuerpo = cuerpos[metodo];
  if (!cuerpo) throw new Error(`Método inexistente en el PHP: ${metodo}`);
  const res = [];
  const re = new RegExp(`\\$(?:this->)?${variable}\\s*=\\s*`, "g");
  let m;
  while ((m = re.exec(cuerpo))) {
    // Recorre hasta el ';' fuera de comillas.
    let i = m.index + m[0].length;
    const ini = i;
    let comilla = null;
    for (; i < cuerpo.length; i++) {
      const ch = cuerpo[i];
      if (comilla) {
        if (ch === "\\") i++;
        else if (ch === comilla) comilla = null;
      } else if (ch === '"' || ch === "'") comilla = ch;
      else if (ch === ";") break;
    }
    res.push(cuerpo.slice(ini, i));
    re.lastIndex = i;
  }
  return res;
}

/** Evalúa una expresión PHP de concatenación de strings ("..." . $v . '...') con interpolación. */
function evaluar(expr, vars) {
  let i = 0;
  let out = "";
  const valor = (nombre) => {
    if (!(nombre in vars)) throw new Error(`Variable PHP sin valor: $${nombre}`);
    return String(vars[nombre]);
  };
  const saltar = () => {
    while (i < expr.length && /\s/.test(expr[i])) i++;
  };
  while (true) {
    saltar();
    if (i >= expr.length) break;
    const ch = expr[i];
    if (ch === '"') {
      i++;
      while (expr[i] !== '"') {
        if (i >= expr.length) throw new Error("String sin cerrar");
        if (expr[i] === "\\") {
          const n = expr[i + 1];
          const esc = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', $: "$" };
          if (n in esc) {
            out += esc[n];
            i += 2;
          } else {
            out += "\\";
            i++;
          }
        } else if (expr[i] === "$" && /[a-zA-Z_]/.test(expr[i + 1] ?? "")) {
          const m = /^\$([a-zA-Z_][a-zA-Z0-9_]*)/.exec(expr.slice(i));
          out += valor(m[1]);
          i += m[0].length;
        } else out += expr[i++];
      }
      i++;
    } else if (ch === "'") {
      i++;
      while (expr[i] !== "'") {
        if (expr[i] === "\\" && (expr[i + 1] === "'" || expr[i + 1] === "\\")) {
          out += expr[i + 1];
          i += 2;
        } else out += expr[i++];
      }
      i++;
    } else if (ch === "$") {
      const m = /^\$([a-zA-Z_][a-zA-Z0-9_]*)(\['(\w+)'\])?/.exec(expr.slice(i));
      out += m[3] ? String(vars[m[1]][m[3]]) : valor(m[1]);
      i += m[0].length;
    } else if (ch === ".") i++;
    else throw new Error(`Expresión PHP no soportada cerca de: ${expr.slice(i, i + 40)}`);
  }
  return out;
}

/** PHP: $a != '0' entre strings (si ambos son numéricos, compara como números). */
const numerico = (v) => /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(v);
const distinto = (a, b) => (numerico(a) && numerico(b) ? Number(a) !== Number(b) : a !== b);

const LISTA_NFG = [
  "manuel.hidalgo@flesan.cl", "betsy.ramirez@flesan.cl", "cristobal.rojas@flesan.cl", "eduardo.cancino@flesan.cl", "gsimonet@flesan.cl", "ignacio.correa@flesan.cl",
  "jose.allende@flesan.cl", "makarena.fernandez@flesan.cl", "osvaldo.gonzalez@flesan.cl", "tomas.anriquez@flesan.cl", "yiturra@flesan.cl",
];

/** where de empresa y CC, común a todas las funciones del libro. */
function whereBase(empresa, cc) {
  let where = "";
  if (distinto(empresa, "0")) where += " AND sap_finiquito_grupo_flesan_g2.sociedad='" + empresa + "'";
  if (distinto(cc, "0"))
    where += " AND (sap_finiquito_grupo_flesan_g2.sociedad||sap_finiquito_grupo_flesan_g2.centro_de_coste)=case when '" + cc + "'='OYM0000755501' then 'OYM755501' else '" + cc + "' end";
  return where;
}

/** getLibroREMvalidacion / p2 / p3 / GGO / p2ggo: solo empresa y CC. */
function simple(metodo, empresa, cc, fecha_inicio, fecha_termino, Administrativo) {
  const where = whereBase(empresa, cc);
  const [q] = expresiones(metodo);
  return evaluar(q, { fecha_inicio, fecha_termino, where, Administrativo });
}

/** El SQL de la consulta que arma el $query1 de getLibroREM/p22/p33 (CC donde es administrativo sin administrador). */
function sqlAdministrativo(Administrativo) {
  return evaluar(expresiones("getLibroREM", "query1")[0], { Administrativo });
}

/** getLibroREM / p22 / p33: con encargado, planta, NFG y el $and de los CC de administrativo. */
function conEncargado(metodo, empresa, cc, fecha_inicio, fecha_termino, Administrativo, pl, filasAdministrativo) {
  let where = whereBase(empresa, cc);
  if (distinto(Administrativo, "0") && Administrativo !== "" && Administrativo !== "tchahuan@dvc.cl") {
    where += " AND (tabla_encargados_cc.correo='" + Administrativo + "' OR tabla_encargados_cc.visitador like '%" + Administrativo + "%')";
  } else if (Administrativo === "tchahuan@dvc.cl") {
    where += " AND (tabla_encargados_cc.correo_ggo like '%" + Administrativo + "%')";
  }
  if (pl === "NP") where += " AND sap_maestro_cargos.planta_noplanta='NP'";
  let nfg = " AND NOT (sap_finiquito_grupo_flesan_g2.sociedad = 'NFG')";
  if (LISTA_NFG.includes(Administrativo)) nfg = "";
  let and = "";
  for (const r of filasAdministrativo) {
    and += " AND not( (sap_maestro_colaborador.centro_costo ||'-'|| sap_maestro_colaborador.nombre_centro_costo) ='" + r.centro_coto + "' AND planta_noplanta='PL')";
  }
  const [qTch, qOtro] = expresiones(metodo);
  return evaluar(Administrativo === "tchahuan@dvc.cl" ? qTch : qOtro, { fecha_inicio, fecha_termino, nfg, where, and });
}

/**
 * Las tres consultas del Excel según el ?id= que arma finiquito_rem.php («empresa,cc,fi,ft,Administrativo[,validacion,pl]»),
 * como export_excel_finiquito.php. filasAdministrativo = resultado de sqlAdministrativo(Administrativo).
 * Devuelve { rama, hojas: [sql1, sql2, sql3] } o { rama, error } si el PHP terminaba con error fatal.
 */
function consultasExcel(id, filasAdministrativo = []) {
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
    return {
      rama: "validacion",
      hojas: ["getLibroREMvalidacion", "getLibroREMvalidacionp2", "getLibroREMvalidacionp3"].map((m) => simple(m, empresa, cc, fi, ft, Administrativo)),
    };
  }
  if (validacion === "g46sdf5g4s6df5g") {
    // getLibroREMvalidacionp3ggo no existe en la clase: PHP termina con «Call to undefined method».
    return { rama: "ggo", error: "Call to undefined method privada::getLibroREMvalidacionp3ggo()" };
  }
  return {
    rama: Administrativo === "tchahuan@dvc.cl" ? "tchahuan" : "encargado",
    hojas: ["getLibroREM", "getLibroREMvalidacionp22", "getLibroREMvalidacionp33"].map((m) => conEncargado(m, empresa, cc, fi, ft, Administrativo, pl, filasAdministrativo)),
  };
}

/** Las listas del filtro y las demás consultas sueltas de finiquito_rem.php. */
const sueltas = {
  getfecha: () => evaluar(expresiones("getfecha")[0], {}),
  getCentrosGestion1: () => evaluar(expresiones("getCentrosGestion1")[0], {}),
  getCentrosGestion2: (correo_ggo) => evaluar(expresiones("getCentrosGestion2")[0], { correo_ggo }),
  getCentrosGestion: (c) => evaluar(expresiones("getCentrosGestion")[0], { correo_administrador: c, correo_visitador: c, correo_gerente: c }),
  ggo: (correo) => evaluar(expresiones("ggo")[0], { correo }),
  acceso: (correo) => evaluar(expresiones("acceso")[0], { correo }),
  Administrativ: (correo) => evaluar(expresiones("Administrativ")[0], { correo }),
};

module.exports = { consultasExcel, sqlAdministrativo, sueltas, expresiones, evaluar, cuerpos };

if (require.main === module) {
  // Autoprueba: que todas las expresiones se puedan evaluar y no quede PHP.
  const ids = ["DM,0,202609Semana 1,202609Semana 3,x@flesan.cl,bxcv5bxd855,0", "0,0,202609Semana 1,202609Semana 3,0,0,0", "DM,ACA1,202609Semana 1,202610Semana 1,x@flesan.cl,0,0", "0,0,202609Semana 1,202609Semana 3,tchahuan@dvc.cl,g46sdf5g4s6df5g,0"];
  for (const id of ids) {
    const r = consultasExcel(id, [{ centro_coto: "CC1-Nombre" }]);
    for (const s of r.hojas ?? []) if (/\$[a-z_]|"\s*\./i.test(s)) throw new Error("Quedó PHP sin reemplazar: " + id);
    console.log(id, "->", r.rama, (r.hojas ?? []).map((s) => s.length));
  }
  for (const [k, f] of Object.entries(sueltas)) console.log(k, f("a@b.cl").replace(/\s+/g, " ").slice(0, 110));
  console.log("query1:", sqlAdministrativo("x@flesan.cl"));
  if (process.argv[2]) fs.writeFileSync(process.argv[3], consultasExcel(process.argv[2]).hojas[Number(process.argv[4] ?? 0)]);
}
