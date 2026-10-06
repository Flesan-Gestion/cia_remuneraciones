import type { FiltrosLibro } from "@/lib/libro/tipos";

const PERIODO = /^\d{6}$/;
const CODIGO = /^[A-Za-z0-9_-]{1,30}$/;

/** Valida los filtros que llegan del navegador. Devuelve el mensaje de error si algo no calza. */
export function leerFiltrosLibro(entrada: unknown): FiltrosLibro | string {
  const f = (entrada ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const desde = texto(f.desde);
  const hasta = texto(f.hasta);
  if (!desde || !hasta || !PERIODO.test(desde) || !PERIODO.test(hasta)) return "Debe completar Fecha Inicio y Fecha Termino.";
  if (desde > hasta) return "El periodo «desde» no puede ser posterior a «hasta».";
  const empresa = texto(f.empresa);
  const cc = texto(f.cc);
  if ((empresa && !CODIGO.test(empresa)) || (cc && !CODIGO.test(cc))) return "Empresa o centro de costo inválidos.";
  return { empresa, cc: empresa ? cc : null, desde, hasta };
}
