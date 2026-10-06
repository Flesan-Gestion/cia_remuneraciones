import { Fpdf, latin1 } from "@/lib/liquidaciones/fpdf";
import { miles } from "@/lib/liquidaciones/formato";
import type { LiquidacionDetalle } from "@/lib/liquidaciones/consultas";

/**
 * PDF de liquidaciones: una página por liquidación, dibujada con las mismas posiciones, textos y
 * cálculos que liquidaciones_pdf_new.php del aplicativo antiguo. Los espacios al inicio de los
 * textos son parte del diseño original (alinean las etiquetas dentro de los recuadros).
 */

/** Carta, como el original: new PDF('P','mm',array(215.9,279.4)). */
const CARTA: [number, number] = [215.9, 279.4];

/** Posiciones de horas extra: llevan la cantidad junto a la descripción. */
const POSICIONES_HORAS = new Set([118, 130, 137]);

export async function generarPdf(liquidaciones: LiquidacionDetalle[], clave?: string): Promise<Buffer> {
  const pdf = new Fpdf({ formato: CARTA, clave });
  for (const liquidacion of liquidaciones) {
    if (liquidacion.conceptos.length) dibujarLiquidacion(pdf, liquidacion);
  }
  return pdf.Output();
}

function dibujarLiquidacion(pdf: Fpdf, d: LiquidacionDetalle) {
  const conceptos = d.conceptos;

  // Encabezados de sección y su línea en blanco en las columnas de montos (solo si la sección tiene conceptos).
  let haberes = "";
  let haberesSuma = "";
  let espaciod1 = "";
  let haberesNo = "";
  let haberesNoSuma = "";
  let espaciod2 = "";
  let descuentosLe = "";
  let descuentosLeResta = "";
  let espacioh1 = "";
  let descuentosLega = "";
  let descuentosLegaResta = "";
  let espacioh2 = "";
  let asignacion = "";
  let asignacionResta = "";
  let espacioh3 = "";
  let c1 = 0;
  let c2 = 0;
  let c3 = 0;
  let c4 = 0;
  let c5 = 0;
  let c9 = 0;
  for (const v of conceptos) {
    if (v.tipo === "1") {
      haberes = "HABERES\n";
      haberesSuma = "\n";
      espaciod1 = "\n";
      c1 = 1;
    }
    if (v.tipo === "2") {
      haberesNo = "HABERES NO IMPONIBLES\n";
      haberesNoSuma = "\n";
      espaciod2 = "\n";
      c2 = 1;
    }
    if (v.tipo === "3") {
      descuentosLe = "DESCUENTOS LEGALES\n";
      descuentosLeResta = "\n";
      espacioh1 = "\n";
      c3 = 1;
    }
    if (v.tipo === "4") {
      descuentosLega = "DESCUENTOS\n";
      descuentosLegaResta = "\n";
      espacioh2 = "\n";
      c4 = 1;
    }
    if (v.tipo === "6") {
      asignacion = "ASIGNACIÓN FAMILIAR\n";
      asignacionResta = "\n";
      espacioh3 = "\n";
      c5 = 1;
    }
    if (v.tipo === "9") c9 = 1;
  }

  let count = c1 + c2 + c3 + c4 + c5;
  if (count === 0) count = c9;

  let totalHaberes = 0;
  let totalDescuentos = 0;
  let diasTrabajados = "0";
  let liquido = 0;
  let espacioh = "";
  let espaciod = "";
  let espaciodddd = "";
  for (const v of conceptos) {
    const importe = Number(v.importe ?? 0) || 0;
    if (v.posicion === 700) {
      diasTrabajados = v.cantidad !== null && Number(v.cantidad) > 30 ? "30" : (v.cantidad ?? "");
    }
    if (v.tipo === "1") {
      haberes += POSICIONES_HORAS.has(v.posicion) ? `${v.descripcion}    ${v.cantidad ?? ""} - Hrs \n` : `${v.descripcion}\n`;
      haberesSuma += `${miles(v.importe)}\n`;
      espaciod += "\n";
      count++;
      totalHaberes += importe;
    }
    if (v.tipo === "2") {
      haberesNo += `${v.descripcion}\n`;
      haberesNoSuma += `${miles(v.importe)}\n`;
      espaciod += "\n";
      count++;
      totalHaberes += importe;
    }
    if (v.tipo === "3") {
      descuentosLe += `${v.descripcion}\n`;
      descuentosLeResta += `${miles(v.importe)}\n`;
      espacioh += "\n";
      count++;
      totalDescuentos += importe;
    }
    if (v.tipo === "4") {
      descuentosLega += `${v.descripcion}\n`;
      descuentosLegaResta += `${miles(v.importe)}\n`;
      espacioh += "\n";
      count++;
      totalDescuentos += importe;
    }
    if (v.tipo === "6") {
      asignacion += `${v.descripcion}\n`;
      asignacionResta += `${miles(v.importe)}\n`;
      espaciodddd += "\n";
      count++;
      totalHaberes += importe;
    }
    if (v.posicion === 800) liquido += importe;
  }

  pdf.AddPage();
  pdf.SetFont("Arial", "B", 16);
  let y = pdf.GetY();
  pdf.SetXY(35, y + 1);

  pdf.SetFont("Arial", "B", 8);
  pdf.MultiCell(
    85.1,
    5,
    latin1(`      ${d.razon_social ?? ""}\n      Rut: ${d.rut_sociedad ?? ""} \n      Avenida Apoquindo # 6550 P. 10 LAS CONDES`),
    1,
    1,
  );
  pdf.Ln();

  y = pdf.GetY();
  pdf.SetXY(-29 + 65, y);
  pdf.SetFont("Calibri Regular", "", 12);
  pdf.Cell(100, 3, latin1(`LIQUIDACION DE REMUNERACIONES MES DE ${d.mes ?? ""} del ${d.anio}`));
  // El original mostraba aquí «Esta liquidación es de carácter preliminar…» con una condición
  // amarrada al año 2022 que ya no se cumple nunca; se mantiene sin leyenda.

  y = pdf.GetY();
  pdf.SetXY(32, y + 12);
  pdf.SetFont("Arial", "", 8);
  pdf.MultiCell(
    133,
    5.2,
    latin1(
      `         Nombre: ${d.nombre_completo ?? ""}\n            Cargo: ${d.nombre_cargo ?? ""} \n  L. de trabajo: ${d.lugar_trabajo ?? ""} \n    C.de Costo: ${d.centro_costo ?? ""} - ${substrBytes(d.nombre_cc, 34)}`,
    ),
    1,
    1,
  );
  y = pdf.GetY();
  pdf.SetXY(130, y - 19.8);
  pdf.Cell(26, 3, latin1(`Codigo: ${d.numero_de_personal}`));
  y = pdf.GetY();
  pdf.SetXY(134.5, y + 5.2);
  pdf.Cell(26, 3, latin1(`Rut: ${miles(d.rut)}-${d.digito ?? ""}`));
  y = pdf.GetY();
  pdf.SetXY(121, y + 5);
  pdf.Cell(26, 3, latin1(`Fecha ingreso: ${d.fecha_ingreso ?? "01-01-1970"}`));
  y = pdf.GetY();
  pdf.SetXY(118.1, y + 5.5);
  pdf.Cell(26, 3, latin1(`Días Trabajados: ${diasTrabajados}`));

  const pos = count * 4.7;
  y = pdf.GetY();
  pdf.SetXY(32, y + 7);
  pdf.SetFont("Arial", "B", 8);
  pdf.MultiCell(86, 4.7, "                                              Detalle", 1, 1);
  y = pdf.GetY();
  pdf.SetXY(32 + 85.9, y - 4.7);
  pdf.MultiCell(23.5, 4.7, "       Haberes", 1, 1);
  y = pdf.GetY();
  pdf.SetXY(32 + 109.5, y - 4.7);
  pdf.MultiCell(23.5, 4.7, "    Descuentos", 1, 1);

  y = pdf.GetY();
  pdf.SetXY(32, y);
  pdf.MultiCell(86, 4.7, latin1(haberes + haberesNo + descuentosLe + descuentosLega + asignacion), 1, 1);
  y = pdf.GetY();
  pdf.SetXY(32 + 85.9, y - pos);
  pdf.MultiCell(23.5, 4.7, haberesSuma + haberesNoSuma + espacioh1 + espacioh2 + espacioh + asignacionResta, 1, 0);
  y = pdf.GetY();
  pdf.SetXY(32 + 109.5, y - pos);
  pdf.MultiCell(23.5, 4.7, espaciod1 + espaciod + espaciod2 + descuentosLeResta + descuentosLegaResta + espacioh3 + espaciodddd, 1, 0);

  y = pdf.GetY();
  pdf.SetXY(32, y);
  pdf.MultiCell(86, 4.7, "", 1, 1);
  y = pdf.GetY();
  pdf.SetXY(32 + 85.9, y - 4.7);
  pdf.MultiCell(23.5, 4.7, `        ${miles(totalHaberes)}`, 1, 0);
  y = pdf.GetY();
  pdf.SetXY(32 + 109.5, y - 4.7);
  pdf.MultiCell(23.5, 4.7, `        ${miles(totalDescuentos)}`, 1, 0);
  y = pdf.GetY();
  pdf.SetXY(32, y);
  pdf.MultiCell(
    133,
    4.7,
    `                                               TOTAL A PAGAR                                                       ${miles(liquido)}`,
    1,
    0,
  );
}

/** substr($s, 0, n) de PHP corta por bytes UTF-8; aquí igual, sin dejar un carácter a medias. */
function substrBytes(texto: string | null, n: number) {
  const bytes = Buffer.from(texto ?? "", "utf8").subarray(0, n);
  return bytes.toString("utf8").replace(/�$/, "");
}
