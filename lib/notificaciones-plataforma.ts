import type { Notificacion, TipoNotificacion } from "@/lib/notificaciones-tipos";

// PLATAFORMA · tipos de notificación (este archivo sí se edita en cada una). La campanita, el
// panel y la bandeja son del shell y leen de aquí cómo se ve cada tipo. Una plataforma sin
// notificaciones deja TIPOS_NOTIFICACION vacío: la campanita no aparece.
//
// Para emitir una: crearNotificacion() de lib/notificaciones-db.ts desde un route handler o
// server action, con uno de estos tipos.

// Remuneraciones SAP no usa la campanita: los avisos de envío van por correo a RR.HH.
export const TIPOS_NOTIFICACION: Record<string, TipoNotificacion> = {};

/** Sin campanita en esta plataforma: no hay datos de ejemplo. */
export function ejemplosNotificaciones(_ahora: number): Notificacion[] {
  return [];
}
