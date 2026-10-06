// PLATAFORMA · estado de los datos (este archivo sí se edita en cada una). Lo consume el
// indicador de la barra superior (components/estado-datos.tsx, shell).
//
// Remuneraciones SAP lee las tablas de RR.HH. de la base transaccional, que no registran una fecha
// de carga: no se muestra el indicador.

/** Cada cuántas horas se espera que lleguen datos nuevos; pasado ese plazo se marcan atrasados. */
export const CADA_HORAS = 24;

export interface EstadoDatos {
  actualizadoEn: Date;
}

/** «Actualizar» del indicador. Sin indicador, no hace nada. */
export async function actualizarDatos(): Promise<void> {}

export async function obtenerEstadoDatos(): Promise<EstadoDatos | null> {
  return null;
}
