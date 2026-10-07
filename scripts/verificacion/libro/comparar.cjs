// Compara dos salidas en las columnas que usa el Excel (y el orden de las filas).
const fs = require("fs");
const [a, b] = [JSON.parse(fs.readFileSync(process.argv[2])), JSON.parse(fs.readFileSync(process.argv[3]))];
const conceptos = require("./conceptos.json").map((c) => c.clave);
const claves = ["sociedad", "cc", "nombre_completo", "rut", "np", "cargo", "tipo_contrato", "fecha_ingreso", "fecha_retiro", "dias", ...conceptos, "ames", "administrativo"];
const k = (r) => claves.map((c) => (r[c] === undefined ? "∅" : r[c])).join("¦");
console.log("filas:", a.length, "vs", b.length);
let difOrden = 0; const n = Math.min(a.length, b.length);
for (let i = 0; i < n; i++) if (k(a[i]) !== k(b[i])) difOrden++;
const ma = new Map(); for (const r of a) ma.set(k(r), (ma.get(k(r)) ?? 0) + 1);
const mb = new Map(); for (const r of b) mb.set(k(r), (mb.get(k(r)) ?? 0) + 1);
let soloA = 0, soloB = 0;
for (const [x, c] of ma) if ((mb.get(x) ?? 0) < c) soloA += c - (mb.get(x) ?? 0);
for (const [x, c] of mb) if ((ma.get(x) ?? 0) < c) soloB += c - (ma.get(x) ?? 0);
console.log("filas distintas en la misma posición:", difOrden, "| solo en original:", soloA, "| solo en nueva:", soloB);
if (soloA || soloB) {
  const ejA = a.find((r) => !mb.has(k(r)));
  const ejB = ejA && b.find((r) => r.np === ejA.np && r.ames === ejA.ames);
  if (ejA) for (const c of claves) if (!ejB || ejA[c] !== ejB[c]) console.log("  ", c, JSON.stringify(ejA[c]), "->", JSON.stringify(ejB?.[c]));
}
