import { readFileSync } from "node:fs";
import path from "node:path";
import { LibroXlsx, type CeldaXlsx, type HojaXlsx } from "@/lib/exportar/xlsx-servidor";
import { ancho, esPreliminar, largoMostrado, numeroComoPhp, valorFijoComoPhp } from "@/lib/libro/excel";
import { COLUMNAS_FIN, COLUMNAS_INICIO, COLUMNAS_OBRA, COLUMNAS_RESUMEN, CONCEPTOS } from "@/lib/finiquitos/conceptos";
import type { FilaFiniquito, Finiquitos } from "@/lib/finiquitos/consultas";
import { rangoSemanas } from "@/lib/finiquitos/tipos";

/**
 * El Excel de finiquitos, igual al de export_excel_finiquito.php (PhpSpreadsheet): tres hojas
 * («Finiquito_rem», «RESUMEN FINIQUITOS» y «RESUMEN OBRA»), cada una sin cuadrícula, con el logo en
 * A1:C3 (combinadas, filas de 25 puntos), el título en A4 y empresa y CC en A5:A6, encabezados en la
 * fila 8 desde la columna B (gris, negrita) y una fila por registro desde la 9, con bordes finos. En la
 * primera solo van las columnas fijas con algún dato y los conceptos con algún valor distinto de cero,
 * en el orden de la lista. Los valores se convierten como lo hacía PHP. Solo runtime Node.
 */

const LOGO = path.join(process.cwd(), "lib/finiquitos/logo.png");
let logo: Buffer | null = null;

/**
 * Título de A4 de la primera hoja: «Finiquito Remuneraciones Septiembre 2026 Semana 1» o «… Agosto 2026
 * Semana 4 a Septiembre 2026 Semana 3», con «Preliminar» hasta el día 10 del mes siguiente al de «hasta».
 * El original quería poner el mes, pero lo buscaba en los dos últimos caracteres de la semana («a 1») y
 * salía «Finiquito Remuneraciones  2026»; se corrigió el 2026-10-07.
 */
export function tituloFiniquitos(desde: string, hasta: string, ahora = new Date()) {
  return `Finiquito Remuneraciones ${esPreliminar(hasta, ahora) ? "Preliminar " : ""}${rangoSemanas(desde, hasta)}`;
}

export interface EncabezadoFiniquitos {
  /** Códigos elegidos (el original escribía el código, no el nombre). */
  empresa: string | null;
  cc: string | null;
  desde: string;
  hasta: string;
}

interface Columna {
  clave: string;
  titulo: string;
  /** Monto: floatval(str_replace(['$', '.', ' '], '', $v)) de PHP. */
  numero: boolean;
  /** Con formato #,##0. */
  miles: boolean;
}

/** Una hoja: logo y títulos (crearEncabezado del original) y la tabla desde B8. */
async function escribirHoja(hoja: HojaXlsx, titulo: string, e: EncabezadoFiniquitos, columnas: Columna[], filas: FilaFiniquito[]) {
  // Logo de 6667 × 2500 px con setHeight(100), que redondea el ancho (267 px), corrido 80 px a la
  // derecha y 10 hacia abajo para quedar al centro de A1:C3.
  logo ??= readFileSync(LOGO);
  hoja.imagen(logo, Math.round((6667 * 100) / 2500), 100, { x: 80, y: 10 });
  hoja.combinar("A1:C3");

  const valores = (f: FilaFiniquito) => columnas.map((c) => (c.numero ? numeroComoPhp(f[c.clave]) : valorFijoComoPhp(c.clave, f[c.clave])));
  // Ancho de cada columna según su contenido (autosize), antes de escribir las filas.
  const anchos = columnas.map((c) => ancho(c.titulo.length, true));
  for (const f of filas) {
    valores(f).forEach((v, i) => {
      anchos[i] = Math.max(anchos[i], ancho(largoMostrado(v, columnas[i].miles)));
    });
  }
  anchos.forEach((a, i) => hoja.anchoColumna(i + 2, a));

  // A1:C3 centradas (horizontal y vertical), con filas de 25 puntos para el logo; A4:A6 en negrita.
  const centradas: CeldaXlsx[] = [1, 2, 3].map((col) => ({ col, valor: null, estilo: "centrado" }));
  for (const n of [1, 2, 3]) await hoja.fila(n, centradas, 25);
  await hoja.fila(4, [{ col: 1, valor: titulo, estilo: "negrita" }]);
  await hoja.fila(5, [{ col: 1, valor: e.empresa ? `Empresa: ${e.empresa}` : "", estilo: "negrita" }]);
  await hoja.fila(6, [{ col: 1, valor: e.cc ? `Centro de Costo: ${e.cc}` : "", estilo: "negrita" }]);

  // Encabezados en la fila 8 desde la columna B; datos desde la 9, todo con borde fino.
  await hoja.fila(8, columnas.map((c, i) => ({ col: i + 2, valor: c.titulo, estilo: "encabezado" })));
  let n = 9;
  for (const f of filas) {
    const celdas: CeldaXlsx[] = valores(f).map((v, i) => ({ col: i + 2, valor: v, estilo: columnas[i].miles ? "borde_miles" : "borde" }));
    await hoja.fila(n++, celdas);
  }
}

const fija = (c: { clave: string; titulo: string }): Columna => ({ clave: c.clave, titulo: c.titulo, numero: false, miles: false });
const liquido = (c: { clave: string; titulo: string }): Columna => (c.clave === "liquido_pago" ? { ...c, numero: true, miles: true } : fija(c));

export async function generarExcelFiniquitos(datos: Finiquitos, encabezado: EncabezadoFiniquitos, ahora = new Date()): Promise<Buffer> {
  const libro = new LibroXlsx();

  // 1. Finiquito_rem: las columnas fijas con algún dato (ni vacío ni nulo), los conceptos con algún
  // valor distinto de cero (las cantidades de horas, sin formato) y AMES y SEMANA siempre.
  const { detalle } = datos;
  const columnas: Columna[] = [
    ...COLUMNAS_INICIO.filter((c) => detalle.some((f) => f[c.clave] != null && f[c.clave] !== "")).map(fija),
    ...CONCEPTOS.filter((c) => detalle.some((f) => numeroComoPhp(f[c.clave]) !== 0)).map((c) => ({
      clave: c.clave,
      titulo: c.titulo,
      numero: true,
      miles: !c.clave.includes("cantidad"),
    })),
    ...COLUMNAS_FIN.map(fija),
  ];
  const opciones = { sinCuadricula: true };
  await escribirHoja(libro.hoja("Finiquito_rem", opciones), tituloFiniquitos(encabezado.desde, encabezado.hasta, ahora), encabezado, columnas, detalle);

  // 2. RESUMEN FINIQUITOS y 3. RESUMEN OBRA: columnas fijas; el líquido a pago con #,##0.
  await escribirHoja(libro.hoja("RESUMEN FINIQUITOS", opciones), "Resumen Finiquitos", encabezado, COLUMNAS_RESUMEN.map(liquido), datos.resumen);
  await escribirHoja(libro.hoja("RESUMEN OBRA", opciones), "Resumen Obra", encabezado, COLUMNAS_OBRA.map(liquido), datos.obra);
  return libro.generar();
}

/** El nombre con que el navegador guardaba el archivo en el aplicativo antiguo. */
export const NOMBRE_ARCHIVO_FINIQUITOS = "Finiquito_remuneraciones.xlsx";
