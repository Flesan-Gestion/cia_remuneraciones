import { readFileSync } from "node:fs";
import path from "node:path";
import { HojaXlsx, type CeldaXlsx } from "@/lib/exportar/xlsx-servidor";
import { ancho, esPreliminar, largoMostrado, numeroComoPhp, valorFijoComoPhp } from "@/lib/libro/excel";
import { MESES } from "@/lib/liquidaciones/formato";
import { COLUMNAS_FIN, COLUMNAS_INICIO, CONCEPTOS } from "@/lib/libro-prorrateado/conceptos";
import type { FilaProrrateado } from "@/lib/libro-prorrateado/consultas";

/**
 * El Excel del libro prorrateado, igual al de libro_rem_dist_excel.php (PhpSpreadsheet): hoja
 * «libro_rem», logo en A1:C3 (combinadas, filas de 25 puntos), título del informe en A4 y empresa y
 * CC en A5:A6, encabezados en la fila 8 desde la columna B (gris, negrita) y una fila por registro
 * desde la 9, con bordes finos. Solo van los conceptos con algún valor distinto de cero, en el orden
 * de la lista; COSTO EMPRESA suma las vacaciones proporcionales. Los valores se convierten como lo
 * hacía PHP. Solo runtime Node.
 */

const LOGO = path.join(process.cwd(), "lib/libro-prorrateado/logo.png");
let logo: Buffer | null = null;

/**
 * Título de A4: «Informe de Costos Distribuido Septiembre 2026» o «… Enero 2026 a Septiembre 2026»,
 * con «Preliminar» mientras la fecha de hace un mes no pasa del día 10 del mes hasta (esPreliminar).
 */
export function tituloInforme(desde: string, hasta: string, ahora = new Date()) {
  const mes = (p: string) => `${MESES[Number(p.slice(4, 6)) - 1] ?? ""} ${p.slice(0, 4)}`;
  const texto = desde === hasta ? mes(desde) : `${mes(desde)} a ${mes(hasta)}`;
  return `Informe de Costos Distribuido ${esPreliminar(hasta, ahora) ? "Preliminar " : ""}${texto}`;
}

export interface EncabezadoProrrateado {
  /** Códigos elegidos (el original escribía el código, no el nombre). */
  empresa: string | null;
  cc: string | null;
  desde: string;
  hasta: string;
}

export async function generarExcelProrrateado(filas: FilaProrrateado[], encabezado: EncabezadoProrrateado, ahora = new Date()): Promise<Buffer> {
  const hoja = new HojaXlsx("libro_rem");
  // 1. Logo: 1600 × 600 px con setHeight(100), que redondea el ancho (267 px), y corrido 80 px a la
  // derecha y 10 hacia abajo para quedar al centro de A1:C3.
  logo ??= readFileSync(LOGO);
  hoja.imagen(logo, Math.round((1600 * 100) / 600), 100, { x: 80, y: 10 });
  hoja.combinar("A1:C3");

  // Conceptos con algún valor (el de la consulta, sin las vacaciones), en el orden de la lista.
  const activos = CONCEPTOS.filter((c) => filas.some((f) => numeroComoPhp(f[c.clave]) !== 0));
  const columnas = [
    ...COLUMNAS_INICIO.map((c) => ({ clave: c.clave as string, titulo: c.titulo as string, concepto: false })),
    ...activos.map((c) => ({ clave: c.clave, titulo: c.titulo, concepto: true })),
    ...COLUMNAS_FIN.map((c) => ({ clave: c.clave as string, titulo: c.titulo as string, concepto: false })),
  ];
  const valores = (f: FilaProrrateado) =>
    columnas.map((c) => {
      if (!c.concepto) return valorFijoComoPhp(c.clave, f[c.clave]);
      const n = numeroComoPhp(f[c.clave]);
      return c.clave === "costo_empresa" ? n + numeroComoPhp(f.vacaciones_proporcionales) : n;
    });

  // Ancho de cada columna según su contenido (autosize), antes de escribir las filas.
  const anchos = columnas.map((c) => ancho(c.titulo.length, true));
  for (const f of filas) {
    valores(f).forEach((v, i) => {
      anchos[i] = Math.max(anchos[i], ancho(largoMostrado(v, columnas[i].concepto)));
    });
  }
  anchos.forEach((a, i) => hoja.anchoColumna(i + 2, a));

  // A1:C3 centradas (horizontal y vertical), con filas de 25 puntos para el logo.
  const centradas: CeldaXlsx[] = [1, 2, 3].map((col) => ({ col, valor: null, estilo: "centrado" }));
  for (const n of [1, 2, 3]) await hoja.fila(n, centradas, 25);

  // 2. Cabeceras (A4:A6 en negrita).
  await hoja.fila(4, [{ col: 1, valor: tituloInforme(encabezado.desde, encabezado.hasta, ahora), estilo: "negrita" }]);
  await hoja.fila(5, [{ col: 1, valor: encabezado.empresa ? `Empresa: ${encabezado.empresa}` : "", estilo: "negrita" }]);
  await hoja.fila(6, [{ col: 1, valor: encabezado.cc ? `Centro de Costo: ${encabezado.cc}` : "", estilo: "negrita" }]);

  // Encabezados en la fila 8 desde la columna B; datos desde la 9, todo con borde fino. Como en el
  // libro de remuneraciones, la condición para dejar sin formato las cantidades nunca se cumplía:
  // todas las columnas de conceptos van con #,##0.
  await hoja.fila(8, columnas.map((c, i) => ({ col: i + 2, valor: c.titulo, estilo: "encabezado" })));
  let n = 9;
  for (const f of filas) {
    const celdas: CeldaXlsx[] = valores(f).map((v, i) => ({ col: i + 2, valor: v, estilo: columnas[i].concepto ? "borde_miles" : "borde" }));
    await hoja.fila(n++, celdas);
  }
  return hoja.generar();
}

/** El nombre con que el navegador guardaba el archivo en el aplicativo antiguo (decisión del 2026-10-06: igual). */
export const NOMBRE_ARCHIVO_PRORRATEADO = "Libro_remuneraciones.xlsx";
