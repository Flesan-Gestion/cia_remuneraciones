import { ejemplosNotificaciones } from "@/lib/notificaciones-plataforma";

// Modo ejemplo (sin tabla de notificaciones): las leídas se recuerdan en memoria del servidor
// mientras corre, para que «marcar leída» se note en la maqueta. Al reiniciar vuelven a estar
// como en los datos de ejemplo.

declare global {
  var _notificacionesLeidasEjemplo: Set<number> | undefined;
}
const leidas = (globalThis._notificacionesLeidasEjemplo ??= new Set<number>());

export function listarEjemplo(limite: number) {
  const ahora = Date.now();
  const todas = ejemplosNotificaciones(ahora).map((n) => (leidas.has(n.id) && !n.leidaEn ? { ...n, leidaEn: new Date(ahora).toISOString() } : n));
  return { notificaciones: todas.slice(0, limite), noLeidas: todas.filter((n) => !n.leidaEn).length };
}

export function marcarEjemplo(seleccion: { ids?: number[]; todas?: boolean }) {
  const ids = seleccion.todas ? ejemplosNotificaciones(Date.now()).map((n) => n.id) : (seleccion.ids ?? []);
  for (const id of ids) leidas.add(id);
}
