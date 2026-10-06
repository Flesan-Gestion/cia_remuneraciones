"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { cifra } from "./formato";

export interface PuntoComparado {
  nombre: string;
  /** Valor del período actual; null = aún sin datos (meses futuros). */
  actual: number | null;
  anterior: number;
  meta?: number | null;
}

/**
 * Barras por período (meses) del año actual al lado del anterior, con la meta como línea
 * punteada. Un clic en una columna la elige (`onSeleccion`); las demás se atenúan.
 */
export function BarrasComparadas({
  puntos,
  seleccion,
  onSeleccion,
  etiquetaActual = "2026",
  etiquetaAnterior = "2025",
  alto = 210,
  divisor = 1000,
}: {
  puntos: PuntoComparado[];
  seleccion?: number | null;
  onSeleccion?: (indice: number) => void;
  etiquetaActual?: string;
  etiquetaAnterior?: string;
  alto?: number;
  /** Divide las cifras al rotular (1000: UF → miles de UF). */
  divisor?: number;
}) {
  const [encima, setEncima] = useState<number | null>(null);
  const meta = puntos.find((p) => p.meta != null)?.meta ?? null;
  const max = Math.max(...puntos.map((p) => Math.max(p.actual ?? 0, p.anterior)), meta ?? 0, 1);
  const h = (v: number) => (v / max) * alto;

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div
        className="rep-grilla relative grid items-end gap-1.5 lg:gap-2.5 border-b border-border-strong flex-1"
        style={{ gridTemplateColumns: `repeat(${puntos.length}, minmax(0, 1fr))`, minHeight: alto + 26 }}
      >
        {meta != null && (
          <>
            <span aria-hidden className="absolute inset-x-0 border-t-[1.5px] border-dashed border-text/45 pointer-events-none" style={{ bottom: h(meta) }} />
            <span className="absolute right-0 text-[0.6875rem] text-muted bg-surface px-1 pointer-events-none" style={{ bottom: h(meta) + 3 }}>
              Meta {cifra(meta / divisor)}
            </span>
          </>
        )}
        {puntos.map((p, i) => {
          const conDatos = p.actual !== null;
          const atenuada = seleccion != null && seleccion !== i;
          const bajoMeta = meta != null && p.actual !== null && p.actual < meta;
          return (
            <button
              key={p.nombre}
              type="button"
              disabled={!conDatos || !onSeleccion}
              onClick={() => onSeleccion?.(i)}
              onMouseEnter={() => setEncima(i)}
              onMouseLeave={() => setEncima(null)}
              onFocus={() => setEncima(i)}
              onBlur={() => setEncima(null)}
              aria-pressed={seleccion === i}
              aria-label={`${p.nombre}: ${conDatos ? cifra(p.actual! / divisor) : "sin datos"} ${etiquetaActual}, ${cifra(p.anterior / divisor)} ${etiquetaAnterior}`}
              className={cn(
                "relative flex flex-col items-center justify-end gap-1.5 h-full transition-opacity rounded-t-md focus-visible:outline-2 focus-visible:outline-flesan-red",
                conDatos && onSeleccion ? "cursor-pointer" : "cursor-default",
                atenuada && "opacity-35",
              )}
            >
              <span className={cn("rep-cifra text-[0.6875rem] font-bold", seleccion === i ? "text-text" : "text-muted")}>{conDatos ? cifra(p.actual! / divisor) : ""}</span>
              <span className="flex items-end gap-[3px] w-full">
                <span className="flex-1 rounded-t-[4px] bg-border-strong" style={{ height: h(p.anterior) }} />
                <span
                  className="flex-1 rounded-t-[4px]"
                  style={{ height: conDatos ? h(p.actual!) : 0, background: "var(--color-serie-1)", opacity: bajoMeta ? 0.62 : 1 }}
                />
              </span>
              {encima === i && (
                <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 min-w-36 rounded-[0.625rem] border border-border-strong bg-surface px-3 py-2 shadow-lg pointer-events-none text-left">
                  <span className="block text-xs font-semibold text-text mb-1">{p.nombre}</span>
                  <span className="flex justify-between gap-3 text-[0.6875rem] text-muted">
                    {etiquetaActual} <b className="rep-cifra text-text">{conDatos ? cifra(p.actual! / divisor) : "—"}</b>
                  </span>
                  <span className="flex justify-between gap-3 text-[0.6875rem] text-muted">
                    {etiquetaAnterior} <b className="rep-cifra text-text">{cifra(p.anterior / divisor)}</b>
                  </span>
                  {meta != null && (
                    <span className="flex justify-between gap-3 text-[0.6875rem] text-muted">
                      Meta <b className="rep-cifra text-text">{cifra(meta / divisor)}</b>
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="grid gap-1.5 lg:gap-2.5" style={{ gridTemplateColumns: `repeat(${puntos.length}, minmax(0, 1fr))` }}>
        {puntos.map((p) => (
          <span key={p.nombre} className="text-center text-xs text-muted">
            {p.nombre}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-serie-1" />
          {etiquetaActual}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-border-strong" />
          {etiquetaAnterior}
        </span>
        {meta != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 border-t-[1.5px] border-dashed border-muted" />
            Meta mensual
          </span>
        )}
        {onSeleccion && <span className="ml-auto text-faint">Clic en un mes para verlo solo</span>}
      </div>
    </div>
  );
}
