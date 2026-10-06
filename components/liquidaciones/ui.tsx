"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// Piezas chicas que comparten las pantallas de Liquidaciones y Envío por correo.

export const fetcher = async (url: string) => {
  const r = await fetch(url);
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error ?? `Error ${r.status}`);
  return datos;
};

/** POST/PUT con JSON; lanza el mensaje de error que devuelva la API. */
export async function enviarJson<T = unknown>(url: string, cuerpo: unknown, metodo = "POST"): Promise<T> {
  const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error ?? `Error ${r.status}`);
  return datos as T;
}

/** Etiqueta arriba del control, como en los formularios del estándar. */
export function Campo({ etiqueta, requerido, children, className }: { etiqueta: string; requerido?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="label-meta text-muted">
        {etiqueta}
        {requerido && <span className="text-flesan-red"> *</span>}
      </span>
      {children}
    </div>
  );
}

/** Encabezado de las tarjetas de filtros (Liquidaciones y Libro): ícono, título y una línea de ayuda. */
export function EncabezadoTarjeta({ icono, titulo, children }: { icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-flesan-red/10 text-flesan-red rounded-flesan">{icono}</div>
      <div className="min-w-0">
        <h2 className="font-label font-semibold text-base text-text tracking-wide">{titulo}</h2>
        <p className="text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}

/** Casilla con estado «algunas marcadas» (indeterminada). */
export function Casilla({ marcada, indeterminada, onCambio, etiqueta }: { marcada: boolean; indeterminada?: boolean; onCambio: (v: boolean) => void; etiqueta: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminada);
  }, [indeterminada]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={etiqueta}
      checked={marcada}
      onChange={(e) => onCambio(e.target.checked)}
      className="w-4 h-4 accent-flesan-red cursor-pointer align-middle"
    />
  );
}

export type Tono = "neutro" | "ok" | "alerta" | "malo" | "info";

const TONOS: Record<Tono, string> = {
  neutro: "border-border-strong text-muted",
  ok: "border-status-ok/40 text-status-ok bg-status-ok/10",
  alerta: "border-status-warn/50 text-status-warn bg-status-warn/10",
  malo: "border-flesan-red/40 text-flesan-red bg-flesan-red/10",
  info: "border-serie-1/40 text-serie-1 bg-serie-1/10",
};

export function Estado({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={cn("badge whitespace-nowrap", TONOS[tono])}>{children}</span>;
}

/** Encabezado de columna de las tablas de la plataforma. */
export function Th({ children, derecha, className }: { children?: ReactNode; derecha?: boolean; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 font-label text-[0.6875rem] tracking-[0.1em] uppercase text-muted font-semibold whitespace-nowrap",
        derecha ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Paginacion({ pagina, paginas, onCambio, total, unidad }: { pagina: number; paginas: number; onCambio: (p: number) => void; total: number; unidad: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-border text-xs text-muted">
      {total} {unidad}
      {paginas > 1 && (
        <span className="ml-auto flex items-center gap-2">
          <button type="button" disabled={pagina === 0} onClick={() => onCambio(pagina - 1)} className="btn-flesan btn-flesan-ghost btn-flesan-sm disabled:opacity-40">
            Anterior
          </button>
          Página {pagina + 1} de {paginas}
          <button type="button" disabled={pagina >= paginas - 1} onClick={() => onCambio(pagina + 1)} className="btn-flesan btn-flesan-ghost btn-flesan-sm disabled:opacity-40">
            Siguiente
          </button>
        </span>
      )}
    </div>
  );
}

/** Aviso dentro de la página (no flotante). */
export function Nota({ tono = "info", titulo, children }: { tono?: "info" | "alerta"; titulo?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-flesan border px-4 py-3 text-sm",
        tono === "alerta" ? "border-status-warn/50 bg-status-warn/10 text-text" : "border-border bg-surface-2 text-muted",
      )}
    >
      {titulo && <p className="font-semibold text-text mb-0.5">{titulo}</p>}
      {children}
    </div>
  );
}

export function fechaHoraCorta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
