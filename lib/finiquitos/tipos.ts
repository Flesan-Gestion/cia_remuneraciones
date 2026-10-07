// Reglas de Finiquitos compartidas entre servidor y cliente (sin dependencias de Node).
import type { AccesoLibro, RolLibro } from "@/lib/libro/tipos";
import { periodoLegible } from "@/lib/liquidaciones/formato";

/** GGO que el antiguo desviaba a la consulta de los encargados, filtrada por sus CC de GGO: la única que funcionaba. */
export const EXCEPCION_GGO = "tchahuan@dvc.cl";

/**
 * Quién obtiene finiquitos. Es el mismo rol de los libros (usuarios.rol_remuneraciones), pero en el
 * aplicativo antiguo (finiquito_rem) el Excel del GGO llamaba a una función que no existe
 * (getLibroREMvalidacionp3ggo) y se descargaba un archivo dañado; solo tchahuan@dvc.cl pasaba por
 * otra rama y lo obtenía. Decisión del 2026-10-07: el GGO sigue sin finiquitos, salvo esa persona.
 */
export function veFiniquitos(acceso: Pick<AccesoLibro, "correo" | "rol">): boolean {
  switch (acceso.rol) {
    case "administrador":
    case "rrhh":
    case "administrativo_rrhh":
    case "administrador_obra":
      return true;
    case "ggo":
      return acceso.correo.trim().toLowerCase() === EXCEPCION_GGO;
    default:
      return false;
  }
}

/** Qué ve cada rol, en una línea (las reglas están en lib/finiquitos/consultas.ts). */
export const ALCANCE_FINIQUITOS: Partial<Record<RolLibro, string>> = {
  administrador: "Todas las empresas.",
  rrhh: "Todas las empresas.",
  administrativo_rrhh: "Las personas de los centros de costo donde eres encargado o visitador.",
  administrador_obra: "Las personas de los centros de costo donde eres encargado o visitador.",
  ggo: "Las personas de los centros de costo donde figuras como GGO.",
};

export interface FiltrosFiniquitos {
  empresa: string | null;
  cc: string | null;
  /** Semana de pago como la ofrecía el antiguo: el periodo AAAAMM de la marca seguido de la semana
   * de SAP («202609Semana 3»). Se compara como texto con el mes de pago y la semana de cada finiquito. */
  desde: string;
  hasta: string;
}

/** «202609Semana 3» → «Septiembre 2026 Semana 3». */
export function semanaLegible(valor: string): string {
  const m = /^(\d{6})(.*)$/.exec(valor);
  return m ? `${periodoLegible(m[1])} ${m[2].trim()}`.trim() : valor;
}

/** «Septiembre 2026 Semana 1» o «Agosto 2026 Semana 4 a Septiembre 2026 Semana 3». */
export function rangoSemanas(desde: string, hasta: string): string {
  return desde === hasta ? semanaLegible(desde) : `${semanaLegible(desde)} a ${semanaLegible(hasta)}`;
}
