import type { FiltrosFiniquitos } from "@/lib/finiquitos/tipos";

/** «202609Semana 3»: periodo AAAAMM y la semana de SAP, como las opciones del filtro. */
const SEMANA = /^\d{6}[\p{L}\d ]{0,20}$/u;
const CODIGO = /^[A-Za-z0-9_-]{1,30}$/;

/** Valida los filtros que llegan del navegador. Devuelve el mensaje de error si algo no calza. */
export function leerFiltrosFiniquitos(entrada: unknown): FiltrosFiniquitos | string {
  const f = (entrada ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  // La semana va tal cual: se compara como texto con la de cada finiquito.
  const desde = typeof f.desde === "string" ? f.desde : null;
  const hasta = typeof f.hasta === "string" ? f.hasta : null;
  if (!desde || !hasta || !SEMANA.test(desde) || !SEMANA.test(hasta)) return "Debe completar Fecha Inicio y Fecha Termino.";
  if (desde > hasta) return "La semana «desde» no puede ser posterior a «hasta».";
  const empresa = texto(f.empresa);
  const cc = texto(f.cc);
  if ((empresa && !CODIGO.test(empresa)) || (cc && !CODIGO.test(cc))) return "Empresa o centro de costo inválidos.";
  return { empresa, cc: empresa ? cc : null, desde, hasta };
}
