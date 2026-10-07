// Reglas del libro prorrateado compartidas entre servidor y cliente (sin dependencias de Node).
import type { AccesoLibro } from "@/lib/libro/tipos";

/** El antiguo desviaba este correo a la consulta que fallaba, salvo con rol RRHH (ahí no viajaba el correo). */
const EXCEPCION_ANTIGUO = "tchahuan@dvc.cl";

/**
 * Quién obtiene el libro prorrateado. Es el mismo rol de los libros (usuarios.rol_remuneraciones),
 * pero en el aplicativo antiguo (libro_rem_dis) la consulta de Administrativo RRHH y Administrador
 * OBRA nombraba la tabla de encargados sin cruzarla y fallaba siempre: recibían un Excel con «LA
 * OBRA NO TIENE TRABAJADORES». Lo mismo le pasaba a tchahuan@dvc.cl. Decisión del 2026-10-06:
 * siguen sin acceso, para que nadie cambie lo que ve.
 */
export function veProrrateado(acceso: Pick<AccesoLibro, "correo" | "rol">): boolean {
  switch (acceso.rol) {
    case "rrhh":
      return true;
    case "administrador":
    case "ggo":
      return acceso.correo.trim().toLowerCase() !== EXCEPCION_ANTIGUO;
    default:
      return false;
  }
}
