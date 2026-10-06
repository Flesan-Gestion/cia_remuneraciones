"use client";

import Link from "next/link";
import useSWR from "swr";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { TIPOS_NOTIFICACION } from "@/lib/notificaciones-plataforma";
import { haceCuanto, type Notificacion, type RespuestaNotificaciones } from "@/lib/notificaciones-tipos";

// SHELL · lo que comparten la campanita y la bandeja: la consulta y la fila. Así un tipo se ve
// igual en los dos lados (si un rechazo es rojo en el panel, lo es en la bandeja).

/** Hay notificaciones en esta plataforma si declara al menos un tipo. */
export const hayNotificaciones = Object.keys(TIPOS_NOTIFICACION).length > 0;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`notificaciones_${r.status}`);
    return r.json();
  });

/**
 * Últimas notificaciones del usuario. Se refrescan solas cada minuto: sin websocket a propósito,
 * un poll por minuto sobre una tabla indexada por destinatario es mucho más barato de operar.
 */
export function useNotificaciones(limite = 10, activo = true) {
  const { data, mutate, isLoading, error } = useSWR<RespuestaNotificaciones>(activo ? `/api/notificaciones?limite=${limite}` : null, fetcher, {
    refreshInterval: 60_000,
  });

  async function marcar(seleccion: { ids?: number[]; todas?: boolean }) {
    // Optimista: se ve leída al instante y se confirma con el refresco.
    await mutate(
      async (actual) => {
        await fetch("/api/notificaciones/leer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(seleccion) }).catch(() => {});
        return actual;
      },
      {
        optimisticData: (actual) => {
          if (!actual) return actual as unknown as RespuestaNotificaciones;
          const ahora = new Date().toISOString();
          const notificaciones = actual.notificaciones.map((n) => (!n.leidaEn && (seleccion.todas || seleccion.ids?.includes(n.id)) ? { ...n, leidaEn: ahora } : n));
          const marcadas = actual.notificaciones.filter((n) => !n.leidaEn).length - notificaciones.filter((n) => !n.leidaEn).length;
          return { ...actual, notificaciones, noLeidas: seleccion.todas ? 0 : Math.max(0, actual.noLeidas - marcadas) };
        },
        revalidate: true,
      },
    );
  }

  return {
    notificaciones: data?.notificaciones ?? [],
    noLeidas: data?.noLeidas ?? 0,
    ejemplo: data?.ejemplo ?? false,
    cargando: isLoading,
    error: Boolean(error),
    marcar,
  };
}

/**
 * Una notificación: punto rojo si no está leída, ícono y color de su tipo, título, detalle, cita
 * opcional y hace cuánto. El «marcar leída» es un botón hermano del enlace (dentro sería un
 * control dentro de otro, y el clic terminaría navegando).
 */
export function FilaNotificacion({
  n,
  onAbrir,
  onMarcar,
  fecha,
}: {
  n: Notificacion;
  onAbrir?: () => void;
  onMarcar: () => void;
  /** Texto de fecha (por defecto, hace cuánto). */
  fecha?: string;
}) {
  const tipo = TIPOS_NOTIFICACION[n.tipo];
  const Icono = tipo?.icono ?? Bell;
  const noLeida = !n.leidaEn;
  const contenido = (
    <>
      <span aria-hidden className="relative shrink-0 mt-0.5">
        <span
          className="w-8 h-8 rounded-xl inline-flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${tipo?.color ?? "var(--color-muted)"} 13%, transparent)`, color: tipo?.color ?? "var(--color-muted)" }}
        >
          <Icono className="w-4 h-4" />
        </span>
        {noLeida && <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-flesan-red ring-2 ring-surface" />}
      </span>
      <span className="min-w-0 flex-1 flex flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className={cn("text-[0.8125rem] leading-snug text-text flex-1 min-w-0", noLeida ? "font-semibold" : "font-medium")}>{n.titulo}</span>
          <span className="text-[0.6875rem] text-faint whitespace-nowrap shrink-0">{fecha ?? haceCuanto(n.creadaEn)}</span>
        </span>
        {n.cuerpo && <span className="text-xs leading-snug text-muted">{n.cuerpo}</span>}
        {n.datos?.cita && (
          <span className="text-xs leading-snug text-text mt-1 pl-2 border-l-2 line-clamp-3" style={{ borderColor: tipo?.color ?? "var(--color-border-strong)" }}>
            {n.datos.cita}
          </span>
        )}
      </span>
    </>
  );
  const clases = "flex gap-3 flex-1 min-w-0 px-3 py-2.5 text-left";
  return (
    <div className={cn("group flex items-start rounded-xl transition-colors hover:bg-bg", noLeida && "bg-bg/60")}>
      {n.enlace ? (
        <Link
          href={n.enlace}
          onClick={() => {
            if (noLeida) onMarcar();
            onAbrir?.();
          }}
          className={clases}
        >
          {contenido}
        </Link>
      ) : (
        <button type="button" onClick={() => noLeida && onMarcar()} className={cn(clases, "cursor-default")}>
          {contenido}
        </button>
      )}
      {noLeida && (
        <button
          type="button"
          onClick={onMarcar}
          title="Marcar como leída"
          aria-label={`Marcar como leída: ${n.titulo}`}
          className="shrink-0 self-start mt-2 mr-1.5 w-7 h-7 inline-flex items-center justify-center rounded-lg text-faint hover:text-flesan-red hover:bg-surface cursor-pointer opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Check className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
