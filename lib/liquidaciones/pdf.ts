import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { MESES, miles } from "@/lib/liquidaciones/formato";
import type { ConceptoLiquidacion, LiquidacionDetalle } from "@/lib/liquidaciones/consultas";

/**
 * PDF de liquidaciones con el formato de la liquidación de SAP (2026-10-21): una página A4 por
 * liquidación, con las letras, posiciones y líneas medidas en una liquidación de SAP (Consorcio
 * Minero, septiembre 2026). Coordenadas en puntos desde la esquina superior izquierda. Los espacios
 * al inicio de los textos son parte del formato de SAP. Solo runtime Node.
 */

/** Las letras de la liquidación de SAP, incrustadas como en la de ejemplo: sin incrustar, cada visor
 * pone la Courier que tiene y la negrita se ve más delgada. */
const COURIER = "Courier New";
const COURIER_NEGRITA = "Courier New Bold";
/** Los títulos de sección. */
const ARIAL_NEGRITA = "Arial Bold";
const ARCHIVOS: Record<string, string> = { [COURIER]: "cour.ttf", [COURIER_NEGRITA]: "courbd.ttf", [ARIAL_NEGRITA]: "arialbd.ttf" };
const FUENTES = path.join(process.cwd(), "lib/liquidaciones/fuentes");
let fuentes: [string, Buffer][] | null = null;

/** Sin kerning ni ligaduras, como SAP. Solo hace falta en Arial (Courier New es de ancho fijo), y va
 * solo ahí porque pdfkit no guarda las medidas del texto que pide `features`: en todo el texto, el
 * PDF de un mes completo tarda cinco veces más. pdfkit tipa `features` como lista de etiquetas, pero
 * fontkit también acepta { etiqueta: false }. */
const SIN_KERNING = { kern: false, liga: false, clig: false, calt: false } as unknown as PDFKit.Mixins.OpenTypeFeatures[];
const rasgos = (nombre: string) => (nombre === ARIAL_NEGRITA ? SIN_KERNING : undefined);

const LETRA = 10;
/** De la línea superior de cada fila a la línea base de su texto. */
const BASE = 12;
const GRIS = "#F2F2F2";

/** La dirección es fija, como la imprime SAP. */
const DIRECCION = "Avda. Apoquindo # 6550 P.10 Las Condes";

/** Columnas del recuadro de datos y del detalle. */
const X0 = 26.76;
const X_VALOR = 111.82;
const X_HABERES = 338.59;
const X_DESCUENTOS = 452;
const X1 = 565.41;

/** Recuadro de datos: siete filas. */
const Y_DATOS = 90.46;
const FILA_DATOS = 14.75;

/** Detalle: encabezado gris y una fila por título de sección o concepto. */
const Y_DETALLE = 205.72;
const Y_CUERPO = 232.22;
const FILA = 14.5;
/** Bajo el detalle: totales y las tres filas del resumen (Alcance Liquido, Descuentos, Total a Pagar). */
const FILA_TOTALES = 14.15;
const FILAS_RESUMEN = [13.61, 14.45, 14.15];
/** Hasta aquí puede llegar el resumen. Con el alto de SAP caben unas 36 filas de detalle (hoy, a lo
 * más 25); si alguna trae más, sus filas se achican para que la liquidación quepa en la página. */
const PIE = 813;

/** Posiciones de horas extra (tabla de paso): su cantidad es la de «Horas Extra». */
const POSICIONES_HORAS = new Set([118, 130, 137]);

/** Descuentos legales que SAP no resta al calcular el Alcance Liquido: adicional de Isapre no
 * deducible, cotización voluntaria AFP, APV y APV exento (comparado con liquidaciones de SAP). */
const FUERA_DEL_ALCANCE = new Set(["/302", "MD04", "MD10", "MD11"]);

/** Secciones del detalle, por tipo de la tabla de paso. En SAP los haberes imponibles van pegados al
 * borde y los conceptos de las demás secciones con un espacio al inicio. */
const SECCIONES: { tipo: string; titulo: string; sangria: string; derecha: number }[] = [
  { tipo: "1", titulo: " Haberes", sangria: "", derecha: X_DESCUENTOS },
  { tipo: "2", titulo: " Haberes No imponibles", sangria: " ", derecha: X_DESCUENTOS },
  { tipo: "6", titulo: " Asignación Familiar", sangria: " ", derecha: X_DESCUENTOS },
  { tipo: "3", titulo: " Descuentos Legales", sangria: " ", derecha: X1 },
  { tipo: "4", titulo: " Descuentos", sangria: " ", derecha: X1 },
];

type Doc = PDFKit.PDFDocument;

export async function generarPdf(liquidaciones: LiquidacionDetalle[], clave?: string): Promise<Buffer> {
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: "A4",
    margin: 0,
    info: { Title: "Liquidación de remuneraciones", Producer: "Liquidaciones SAP · Grupo Flesan" },
    ...(clave
      ? {
          pdfVersion: "1.7ext3" as const,
          userPassword: clave,
          // Contraseña de propietario aleatoria: nadie puede quitar la protección.
          ownerPassword: crypto.randomUUID(),
          permissions: { printing: "highResolution" as const, copying: true },
        }
      : {}),
  });
  fuentes ??= Object.entries(ARCHIVOS).map(([nombre, archivo]) => [nombre, readFileSync(path.join(FUENTES, archivo))]);
  for (const [nombre, datos] of fuentes) doc.registerFont(nombre, datos);
  const partes: Buffer[] = [];
  doc.on("data", (parte: Buffer) => partes.push(parte));
  const fin = new Promise<void>((resolver, rechazar) => {
    doc.on("end", resolver);
    doc.on("error", rechazar);
  });
  for (const liquidacion of liquidaciones) {
    if (liquidacion.conceptos.length) dibujarLiquidacion(doc, liquidacion);
  }
  doc.end();
  await fin;
  return Buffer.concat(partes);
}

function dibujarLiquidacion(doc: Doc, d: LiquidacionDetalle) {
  const suma = (conceptos: ConceptoLiquidacion[], valor: (c: ConceptoLiquidacion) => string | null) =>
    conceptos.reduce((total, c) => total + (Number(valor(c) ?? 0) || 0), 0);
  const deTipo = (...tipos: string[]) => d.conceptos.filter((c) => tipos.includes(c.tipo));
  const totalHaberes = suma(deTipo("1", "2", "6"), (c) => c.importe);
  const descuentosLegales = suma(deTipo("3"), (c) => c.importe);
  const totalDescuentos = descuentosLegales + suma(deTipo("4"), (c) => c.importe);
  const liquido = suma(d.conceptos.filter((c) => c.posicion === 800), (c) => c.importe);
  const dias = Math.min(30, suma(d.conceptos.filter((c) => c.posicion === 700), (c) => c.cantidad));
  const horas = suma(d.conceptos.filter((c) => POSICIONES_HORAS.has(c.posicion)), (c) => c.cantidad);

  doc.addPage({ size: "A4", margin: 0 });
  // Bordes de 0,75 pt con extremo cuadrado: las líneas cubren las esquinas, como en SAP.
  doc.lineWidth(0.75).strokeColor("black").lineCap("square");

  // Empresa
  recuadro(doc, 26.46, 7.2, 281.59, 49.65);
  [` ${(d.razon_social ?? "").toUpperCase()}`, ` Rut: ${d.rut_sociedad ?? ""}`, ` ${DIRECCION}`].forEach((texto, i) =>
    escribir(doc, texto, 26.46, 7.2 + i * 14.15 + BASE, { fuente: COURIER_NEGRITA, maximo: 281.59 - 26.46 }),
  );

  escribir(doc, ` LIQUIDACIÓN DE Remuneración MES DE ${d.mes ?? ""}-${d.anio}`, X0, 78.46, { fuente: COURIER_NEGRITA, tamano: 12 });

  // Datos de la persona: etiqueta y valor en dos columnas.
  recuadro(doc, X0, Y_DATOS, X1, Y_DATOS + 7 * FILA_DATOS);
  const columnas: [number, number, [string, string][]][] = [
    [
      X0,
      X_VALOR,
      [
        [" Nombre", d.nombre_completo ?? ""],
        [" Cargo", d.nombre_cargo ?? ""],
        [" Ubicación", d.ubicacion ?? ""],
        [" C.de Costos", d.nombre_cc ?? ""],
        [" AFP", (d.afp ?? "").replace(/^AFP:\s*/i, "")],
        [" Salud", d.salud ?? ""],
      ],
    ],
    [
      X_HABERES,
      X_DESCUENTOS,
      [
        [" Código", d.numero_de_personal.padStart(8, "0")],
        [" Rut", d.rut ? `${miles(d.rut)}-${d.digito ?? ""}` : ""],
        [" Fecha de Ingreso", fechaConMes(d.fecha_ingreso)],
        [" Días Trabajados", `${decimal(dias).padStart(9)} `],
        [" Horas Extra", `${decimal(horas).padStart(9)} `],
        [" Total Imponible", miles(d.total_imponible).padStart(14)],
        [" Renta A.Impuesto", miles(d.renta_afecta).padStart(14)],
      ],
    ],
  ];
  for (const [xEtiqueta, xValor, filas] of columnas) {
    const maximo = (xValor === X_VALOR ? X_HABERES : X1) - xValor;
    filas.forEach(([etiqueta, valor], i) => {
      const base = Y_DATOS + i * FILA_DATOS + BASE;
      escribir(doc, etiqueta, xEtiqueta, base, { fuente: COURIER_NEGRITA });
      escribir(doc, valor, xValor, base, { maximo });
    });
  }

  // Detalle: los conceptos de cada sección, ordenados por su código de SAP.
  const lineas: ({ titulo: string } | { texto: string; monto: string; derecha: number })[] = [];
  for (const s of SECCIONES) {
    const conceptos = deTipo(s.tipo).sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0));
    if (!conceptos.length) continue;
    lineas.push({ titulo: s.titulo });
    for (const c of conceptos) lineas.push({ texto: s.sangria + c.descripcion, monto: miles(c.importe), derecha: s.derecha });
  }
  const resumen = FILA_TOTALES + FILAS_RESUMEN.reduce((a, b) => a + b, 0);
  const fila = Math.min(FILA, (PIE - Y_CUERPO - resumen) / Math.max(lineas.length, 1));
  const yTotales = Y_CUERPO + lineas.length * fila;

  doc.rect(X0, Y_DETALLE, X1 - X0, Y_CUERPO - Y_DETALLE).fill(GRIS);
  recuadro(doc, X0, Y_DETALLE, X1, Y_CUERPO);
  for (const x of [X_HABERES, X_DESCUENTOS]) linea(doc, x, Y_DETALLE, x, Y_CUERPO);
  for (const [texto, desde, hasta] of [
    [" Detalle", X0, X_HABERES],
    [" Haberes", X_HABERES, X_DESCUENTOS],
    [" Descuentos", X_DESCUENTOS, X1],
  ] as const) {
    centrado(doc, texto, desde, hasta, Y_DETALLE + BASE, COURIER_NEGRITA);
  }

  for (const x of [X0, X_HABERES, X_DESCUENTOS, X1]) linea(doc, x, Y_CUERPO, x, yTotales);
  lineas.forEach((l, i) => {
    const base = Y_CUERPO + i * fila + BASE;
    if ("titulo" in l) {
      escribir(doc, l.titulo, X0, base, { fuente: ARIAL_NEGRITA });
    } else {
      escribir(doc, l.texto, X0, base, { maximo: X_HABERES - X0 });
      aLaDerecha(doc, l.monto, l.derecha, base);
    }
  });

  // Totales: sin división entre Detalle y Haberes.
  recuadro(doc, X0, yTotales, X_DESCUENTOS, yTotales + FILA_TOTALES);
  recuadro(doc, X_DESCUENTOS, yTotales, X1, yTotales + FILA_TOTALES);
  aLaDerecha(doc, `$ ${miles(totalHaberes)}`, X_DESCUENTOS, yTotales + BASE);
  aLaDerecha(doc, `$ ${miles(totalDescuentos)}`, X1, yTotales + BASE);

  // Resumen. Como en SAP, «Descuentos (-)» muestra todos los descuentos, aunque del alcance líquido
  // al total a pagar solo se restan los que no son legales.
  const voluntarios = suma(deTipo("3").filter((c) => FUERA_DEL_ALCANCE.has(c.codigo)), (c) => c.importe);
  const yResumen = yTotales + FILA_TOTALES;
  const filasResumen: [string, number][] = [
    ["Alcance Liquido", totalHaberes - descuentosLegales + voluntarios],
    ["Descuentos (-)", totalDescuentos],
    ["Total a Pagar", liquido],
  ];
  let y = yResumen;
  filasResumen.forEach(([etiqueta, monto], i) => {
    escribir(doc, etiqueta, 168.53, y + BASE, { fuente: COURIER_NEGRITA });
    aLaDerecha(doc, "$", 466.16, y + BASE);
    aLaDerecha(doc, miles(monto), X1, y + BASE);
    y += FILAS_RESUMEN[i];
  });
  const yTotal = yResumen + FILAS_RESUMEN[0] + FILAS_RESUMEN[1];
  for (const x of [X0, X_DESCUENTOS, X1]) linea(doc, x, yResumen, x, y);
  linea(doc, X0, yTotal, X1, yTotal);
  linea(doc, X0, y, X1, y);
}

function linea(doc: Doc, x1: number, y1: number, x2: number, y2: number) {
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
}

function recuadro(doc: Doc, x0: number, y0: number, x1: number, y1: number) {
  doc.rect(x0, y0, x1 - x0, y1 - y0).stroke();
}

function fuente(doc: Doc, nombre: string, tamano: number) {
  doc.font(nombre).fontSize(tamano).fillColor("black");
}

function ancho(doc: Doc, texto: string, nombre: string) {
  return doc.widthOfString(texto, { features: rasgos(nombre) });
}

/** `texto` con su línea base en `base`. Si no cabe en `maximo`, se achica la letra. */
function escribir(doc: Doc, texto: string, x: number, base: number, { fuente: nombre = COURIER, tamano = LETRA, maximo = Infinity } = {}) {
  fuente(doc, nombre, tamano);
  const medida = ancho(doc, texto, nombre);
  if (medida > maximo) doc.fontSize((tamano * maximo) / medida);
  doc.text(texto, x, base, { lineBreak: false, baseline: "alphabetic", features: rasgos(nombre) });
}

function aLaDerecha(doc: Doc, texto: string, derecha: number, base: number) {
  fuente(doc, COURIER, LETRA);
  escribir(doc, texto, derecha - ancho(doc, texto, COURIER), base);
}

function centrado(doc: Doc, texto: string, desde: number, hasta: number, base: number, nombre: string) {
  fuente(doc, nombre, LETRA);
  escribir(doc, texto, (desde + hasta - ancho(doc, texto, nombre)) / 2, base, { fuente: nombre });
}

/** 30 → «30,00» */
function decimal(n: number) {
  const [entero, fraccion] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}${miles(entero)},${fraccion}`;
}

/** «16-06-2026» → «16-Junio-2026» */
function fechaConMes(fecha: string | null) {
  const [dia, mes, anio] = (fecha ?? "").split("-");
  const nombre = MESES[Number(mes) - 1];
  return nombre ? `${dia}-${nombre}-${anio}` : (fecha ?? "");
}
