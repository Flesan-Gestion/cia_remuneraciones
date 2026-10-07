// Lee la lista de columnas del SELECT original y la lista de conceptos del Excel, y las cruza.
const fs = require("fs");
const base = require("path").join(require("../comun.cjs").FUENTES_PHP, "libro_rem_g2") + "/";
const php = fs.readFileSync(base + "class_libro_rem.php", "utf8").replace(/\r/g, "").split("\n");
const sel = php.slice(247, 401).join("\n"); // líneas 248-401 (getLibroREMvalidacion)
const excel = fs.readFileSync(base + "export_excel_libro.php", "utf8").replace(/\r/g, "");
const bloqueConceptos = excel.slice(excel.indexOf("$conceptos_posibles = ["), excel.indexOf("];", excel.indexOf("$conceptos_posibles = [")));
const conceptos = [...bloqueConceptos.matchAll(/'([^']+)'\s*=>\s*'([^']*)'/g)].map((m) => ({ clave: m[1], titulo: m[2] }));
// columnas: separar por "AS alias," al final de cada expresión
const cols = [];
const re = /(sum|max|COALESCE)\(([\s\S]*?)\)\s+AS\s+([^\s,]+)\s*,?/gi;
for (const linea of sel.split("\n")) {
  const m = linea.match(/^\s*(.*)\s+AS\s+([A-Za-zñóí_0-9]+)\s*,?\s*$/i);
  if (!m) continue;
  const expr = m[1];
  const alias = m[2];
  const codigos = [...expr.matchAll(/cc_nomina = '([^']+)'/g)].map((x) => x[1]);
  let tipo = "otro";
  if (/^max\(case/i.test(expr)) tipo = "max_cantidad";
  else if (/^sum\(case/i.test(expr) && /replace\(sap_liquidaciones_grupo_flesan_g2\.cantidad/i.test(expr)) tipo = "sum_cantidad";
  else if (/^sum\(case/i.test(expr) && /importe::integer/i.test(expr)) tipo = "sum_importe";
  cols.push({ alias, tipo, codigos, expr: expr.length > 120 ? expr.slice(0, 120) + "…" : expr });
}
const porAlias = new Map(cols.map((c) => [c.alias, c]));
const salida = conceptos.map((c) => {
  const col = porAlias.get(c.clave);
  return { clave: c.clave, titulo: c.titulo, tipo: col ? col.tipo : "NO_EXISTE", codigos: col ? col.codigos.join(",") : "" };
});
console.log(JSON.stringify(salida));
console.error("conceptos:", conceptos.length, " columnas SELECT:", cols.length);
console.error("Tipos 'otro':", cols.filter((c) => c.tipo === "otro").map((c) => c.alias + " <= " + c.expr).join("\n"));
console.error("No existen:", salida.filter((s) => s.tipo === "NO_EXISTE").map((s) => s.clave).join(", "));
const repetidos = salida.filter((s, i) => salida.findIndex((t) => t.clave === s.clave) !== i);
console.error("Claves repetidas en el Excel:", repetidos.map((r) => r.clave).join(", ") || "ninguna");
