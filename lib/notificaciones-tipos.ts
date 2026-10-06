import type { LucideIcon } from "lucide-react";

// SHELL · tipos de las notificaciones. Aparte de lib/notificaciones-db.ts para que el cliente
// (campanita y bandeja) los importe sin arrastrar el pool de Postgres.

export interface Notificacion {
  id: number;
  /** Clave del tipo, declarada en lib/notificaciones-plataforma.ts. */
  tipo: string;
  titulo: string;
  cuerpo: string;
  /** Ruta interna a la que lleva (ej. /checklists/12#item-4); null si no lleva a ninguna. */
  enlace: string | null;
  /** Lo propio del tipo. `cita` se muestra bajo el cuerpo (motivo de un rechazo, comentario). */
  datos: { cita?: string } & Record<string, unknown>;
  leidaEn: string | null;
  creadaEn: string;
}

export interface RespuestaNotificaciones {
  notificaciones: Notificacion[];
  noLeidas: number;
  /** true: la plataforma no tiene aún la tabla y lo que se ve son datos de ejemplo. */
  ejemplo: boolean;
}

/** Cómo se ve un tipo en la campanita y la bandeja. */
export interface TipoNotificacion {
  etiqueta: string;
  icono: LucideIcon;
  /** Color del ícono, como token (ej. var(--color-status-ok)). El rojo de marca solo para lo que exige acción. */
  color: string;
}

/** Tiempo relativo corto. Pasado el mes cae a la fecha: «hace 47 d» no le dice nada a nadie. */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const minutos = Math.round((ahora - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} d`;
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
