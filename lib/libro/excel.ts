import { readFileSync } from "node:fs";
import path from "node:path";
import { HojaXlsx, type CeldaXlsx } from "@/lib/exportar/xlsx-servidor";
import { COLUMNAS_FIN, COLUMNAS_INICIO, CONCEPTOS } from "@/lib/libro/conceptos";
import type { FilaLibro } from "@/lib/libro/consultas";

/**
 * El Excel del Libro de Remuneraciones, igual al de export_excel_libro.php (PhpSpreadsheet):
 * hoja «libro_rem», logo en A1, títulos en A4:A6, encabezados en la fila 8 desde la columna B
 * (gris, negrita) y una fila por registro desde la 9, con bordes finos. Solo van los conceptos
 * que tienen algún valor, en el orden de la lista. Los valores se convierten como lo hacía PHP.
 * Solo runtime Node.
 */

const LOGO = path.join(process.cwd(), "lib/libro/logo.png");
let logo: Buffer | null = null;

/** floatval(str_replace(['$', '.', ' '], '', $v)) de PHP: «37,04» → 37, «2.5» → 25, «» → 0. */
export function numeroComoPhp(v: string | null | undefined): number {
  const limpio = String(v ?? 0).replace(/[$. ]/g, "");
  const m = limpio.match(/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/);
  return m ? Number(m[0]) : 0;
}

/** number_format($n, 0) != 0: el concepto va al Excel si algún valor redondea a distinto de cero. */
function tieneValor(n: number) {
  return Math.abs(n) >= 0.5;
}

/** Cómo guardaba PhpSpreadsheet (DefaultValueBinder) un texto: los números como número, salvo
 * los que empiezan con cero; el resto como texto. */
export function valorComoPhpSpreadsheet(v: string | null | undefined): string | number {
  if (v == null || v === "") return "";
  if (/^[+-]?(\d+\.?\d*|\d*\.?\d+)([Ee][-+]?[0-2]?\d{1,3})?$/.test(v)) {
    const sinSigno = v.replace(/^[+-]/, "");
    if (sinSigno.length > 1 && sinSigno[0] === "0" && sinSigno[1] !== ".") return v;
    const n = Number(v);
    if (!Number.isFinite(n) || (!v.includes(".") && Math.abs(n) > 9.22e18)) return v;
    return n;
  }
  return v;
}

/** date("d-m-Y", strtotime($v)) para las fechas AAAA-MM-DD que entrega la base. */
export function fechaComoPhp(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}

/** Valor de una columna fija, como los Excel antiguos: las fechas con date("d-m-Y", strtotime($v))
 * salvo vacías o 0000-00-00; el resto, como lo guardaba PhpSpreadsheet. */
export function valorFijoComoPhp(clave: string, v: string | null | undefined): string | number {
  if (clave.includes("fecha") && v && v !== "0" && v !== "0000-00-00") return fechaComoPhp(v);
  return valorComoPhpSpreadsheet(v);
}

/** La fecha de hoy en Chile, AAAA-MM-DD (los antiguos fijaban la zona Chile/Continental). */
export function hoyEnChile(ahora: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora);
}

/**
 * «Preliminar» en el título mientras la fecha de hace un mes no pasa del día 10 del mes `hasta`
 * (AAAAMM al inicio): en los antiguos, date('Y-m-d', strtotime('-1 month')) <= 'AAAA-MM-10'.
 * Ej.: septiembre es preliminar hasta el 10 de octubre.
 */
export function esPreliminar(hasta: string, ahora = new Date()) {
  const [a, m, d] = hoyEnChile(ahora).split("-").map(Number);
  // strtotime('-1 month'): el mismo día del mes anterior; si no existe, se desborda como en PHP (31 de marzo → 3 de marzo).
  const haceUnMes = new Date(Date.UTC(a, m - 2, d)).toISOString().slice(0, 10);
  return haceUnMes <= `${hasta.slice(0, 4)}-${hasta.slice(4, 6)}-10`;
}

/** Ancho aproximado como el autosize de PhpSpreadsheet (Calibri 11). */
export function ancho(largo: number, negrita = false) {
  return Math.min(80, Math.ceil(largo * (negrita ? 1.2 : 1.1)) + 2);
}

export function largoMostrado(v: string | number, conMiles: boolean) {
  if (typeof v !== "number") return v.length;
  return conMiles ? Math.round(v).toLocaleString("es-CL").length : String(v).length;
}

export interface EncabezadoLibro {
  /** Código de la razón social elegida (el original escribía el código). */
  empresa: string | null;
  cc: string | null;
}

export async function generarExcelLibro(filas: FilaLibro[], encabezado: EncabezadoLibro): Promise<Buffer> {
  const hoja = new HojaXlsx("libro_rem");
  // 1. Imagen: 222 × 45 px escalada a 50 px de alto, como setHeight(50).
  logo ??= readFileSync(LOGO);
  hoja.imagen(logo, (222 * 50) / 45, 50);

  // Conceptos con algún valor, en el orden de la lista maestra; los valores ya convertidos.
  const activos = filas.length ? CONCEPTOS.filter((c) => filas.some((f) => tieneValor(numeroComoPhp(f[c.clave])))) : [];
  const columnas = [
    ...COLUMNAS_INICIO.map((c) => ({ clave: c.clave as string, titulo: c.titulo as string, concepto: false })),
    ...activos.map((c) => ({ clave: c.clave, titulo: c.titulo, concepto: true })),
    ...COLUMNAS_FIN.map((c) => ({ clave: c.clave as string, titulo: c.titulo as string, concepto: false })),
  ];
  const valores = (f: FilaLibro) =>
    columnas.map((c) => {
      if (c.concepto) return numeroComoPhp(f[c.clave]);
      const v = f[c.clave] ?? "";
      return c.clave.includes("fecha") && v ? fechaComoPhp(v) : valorComoPhpSpreadsheet(v);
    });

  // Ancho de cada columna según su contenido (autosize), antes de escribir las filas.
  if (filas.length) {
    const anchos = columnas.map((c) => ancho(c.titulo.length, true));
    for (const f of filas) {
      valores(f).forEach((v, i) => {
        anchos[i] = Math.max(anchos[i], ancho(largoMostrado(v, columnas[i].concepto)));
      });
    }
    anchos.forEach((a, i) => hoja.anchoColumna(i + 2, a));
  }

  // 2. Cabeceras informativas (A4:A6 en negrita).
  await hoja.fila(4, [{ col: 1, valor: "Libro de Remuneraciones", estilo: "negrita" }]);
  await hoja.fila(5, [{ col: 1, valor: encabezado.empresa ? `Empresa: ${encabezado.empresa}` : "", estilo: "negrita" }]);
  await hoja.fila(6, [{ col: 1, valor: encabezado.cc ? `Centro de Costo: ${encabezado.cc}` : "", estilo: "negrita" }]);

  if (filas.length) {
    // Encabezados en la fila 8 desde la columna B; datos desde la 9, todo con borde fino. El
    // original quería dejar sin formato las cantidades, pero su condición nunca se cumplía:
    // todas las columnas de conceptos van con #,##0.
    await hoja.fila(8, columnas.map((c, i) => ({ col: i + 2, valor: c.titulo, estilo: "encabezado" })));
    let n = 9;
    for (const f of filas) {
      const celdas: CeldaXlsx[] = valores(f).map((v, i) => ({ col: i + 2, valor: v, estilo: columnas[i].concepto ? "borde_miles" : "borde" }));
      await hoja.fila(n++, celdas);
    }
  }
  return hoja.generar();
}

/** Libro_remuneraciones_06-10-2026.xlsx, con la fecha de hoy en Chile (como el navegador del antiguo). */
export function nombreArchivoLibro(ahora = new Date()) {
  const [a, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora).split("-");
  return `Libro_remuneraciones_${d}-${m}-${a}.xlsx`;
}
