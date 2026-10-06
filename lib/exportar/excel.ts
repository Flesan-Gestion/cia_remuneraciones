/**
 * Descarga de tablas a Excel (.xlsx) en el navegador, con ExcelJS.
 *
 * La idea: el Excel trae exactamente lo que se ve (filtros y orden aplicados), con formato
 * de número chileno, encabezado con estilo, columnas con ancho útil y, si hay filtros, una
 * hoja «Filtros» que deja constancia de qué se estaba mirando.
 */

export type TipoColumna = "texto" | "numero" | "monto" | "porcentaje" | "fecha";

export interface ColumnaExcel<F> {
  titulo: string;
  /** Valor de la celda para una fila (número crudo en montos y porcentajes, no el texto formateado). */
  valor: (fila: F) => string | number | Date | null | undefined;
  tipo?: TipoColumna;
  /** Ancho en caracteres (por defecto, según el título y el tipo). */
  ancho?: number;
}

export interface HojaExcel<F> {
  nombre: string;
  columnas: ColumnaExcel<F>[];
  filas: F[];
  /** Fila de totales al pie (misma cantidad de valores que columnas; null deja la celda vacía). */
  totales?: (string | number | null)[];
}

export interface OpcionesExcel {
  /** Nombre del archivo sin extensión. Se le agrega la fecha. */
  archivo: string;
  /** Filtros vigentes, para la hoja «Filtros» (etiqueta → valor). */
  filtros?: Record<string, string>;
}

// Formatos de número al estilo es-CL: Excel usa la configuración regional del usuario para
// los separadores, así que el formato solo define decimales y símbolos.
const FORMATOS: Record<TipoColumna, string | undefined> = {
  texto: undefined,
  numero: "#,##0",
  monto: '"$" #,##0',
  porcentaje: "0.0%",
  fecha: "dd-mm-yyyy",
};

const ROJO = "FFE30613";
const NEGRO = "FF231F20";
const GRIS_BORDE = "FFD9D9D9";

function nombreHoja(nombre: string) {
  // Excel no acepta estos caracteres y limita el nombre a 31.
  return nombre.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Hoja";
}

export async function descargarExcel<F>(hojas: HojaExcel<F>[], opciones: OpcionesExcel) {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "Grupo Flesan";
  libro.created = new Date();

  for (const h of hojas) {
    const hoja = libro.addWorksheet(nombreHoja(h.nombre), { views: [{ state: "frozen", ySplit: 1 }] });
    hoja.columns = h.columnas.map((c) => ({
      header: c.titulo,
      width: c.ancho ?? Math.max(c.titulo.length + 4, c.tipo === "texto" || !c.tipo ? 22 : 14),
      style: FORMATOS[c.tipo ?? "texto"] ? { numFmt: FORMATOS[c.tipo ?? "texto"] } : {},
    }));

    for (const f of h.filas) hoja.addRow(h.columnas.map((c) => c.valor(f) ?? null));

    if (h.totales) {
      const fila = hoja.addRow(h.totales);
      fila.font = { bold: true };
      fila.eachCell((celda) => {
        celda.border = { top: { style: "thin", color: { argb: NEGRO } } };
      });
    }

    const encabezado = hoja.getRow(1);
    encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
    encabezado.alignment = { vertical: "middle" };
    encabezado.height = 20;
    encabezado.eachCell((celda) => {
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NEGRO } };
      celda.border = { bottom: { style: "medium", color: { argb: ROJO } } };
    });
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: h.columnas.length } };
    hoja.eachRow((fila, n) => {
      if (n > 1) fila.eachCell((celda) => (celda.border = { ...celda.border, bottom: { style: "hair", color: { argb: GRIS_BORDE } } }));
    });
  }

  const hojaFiltros = libro.addWorksheet("Filtros");
  hojaFiltros.columns = [
    { header: "Filtro", width: 24 },
    { header: "Valor", width: 48 },
  ];
  hojaFiltros.getRow(1).font = { bold: true };
  const filtros = Object.entries(opciones.filtros ?? {});
  if (filtros.length) filtros.forEach(([k, v]) => hojaFiltros.addRow([k, v]));
  else hojaFiltros.addRow(["Sin filtros", "Todos los registros"]);
  hojaFiltros.addRow([]);
  hojaFiltros.addRow(["Generado", new Date().toLocaleString("es-CL")]);
  hojaFiltros.addRow(["Uso", "Interno · Grupo Flesan"]);

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fecha = new Date().toISOString().slice(0, 10);
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `${opciones.archivo} ${fecha}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}
