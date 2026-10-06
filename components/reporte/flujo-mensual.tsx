"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { cifra } from "./formato";

export interface PuntoFlujo {
  nombre: string;
  entradas: number;
  salidas: number;
  /** Saldo al cierre del período (ej. dotación), para el detalle. */
  saldo?: number;
}

/**
 * Entradas y salidas por período en barras divergentes: las entradas hacia arriba, las salidas
 * hacia abajo y el neto bajo cada columna. Sirve para ingresos y egresos de personal, altas y
 * bajas de clientes, compras y consumos de bodega.
 */
export function FlujoMensual({
  puntos,
  alto = 200,
  etiquetaEntradas = "Ingresos",
  etiquetaSalidas = "Egresos",
  etiquetaSaldo = "Dotación",
  colorEntradas = "var(--color-serie-5)",
  colorSalidas = "var(--color-serie-3)",
}: {
  puntos: PuntoFlujo[];
  alto?: number;
  etiquetaEntradas?: string;
  etiquetaSalidas?: string;
  etiquetaSaldo?: string;
  colorEntradas?: string;
  colorSalidas?: string;
}) {
  const [encima, setEncima] = useState<number | null>(null);
  const max = Math.max(...puntos.map((p) => Math.max(p.entradas, p.salidas)), 1);
  const mitad = alto / 2;
  const h = (v: number) => (v / max) * (mitad - 14);
  const columnas = { gridTemplateColumns: `repeat(${puntos.length}, minmax(0, 1fr))` };

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="relative grid gap-1.5 lg:gap-2.5" style={{ ...columnas, height: alto }}>
        <span aria-hidden className="absolute inset-x-0 border-t border-border-strong pointer-events-none" style={{ top: mitad }} />
        {puntos.map((p, i) => (
          <div
            key={p.nombre}
            tabIndex={0}
            role="img"
            aria-label={`${p.nombre}: ${cifra(p.entradas)} ${etiquetaEntradas.toLowerCase()}, ${cifra(p.salidas)} ${etiquetaSalidas.toLowerCase()}`}
            onMouseEnter={() => setEncima(i)}
            onMouseLeave={() => setEncima(null)}
            onFocus={() => setEncima(i)}
            onBlur={() => setEncima(null)}
            className={cn(
              "relative h-full rounded-md focus-visible:outline-2 focus-visible:outline-flesan-red",
              encima !== null && encima !== i && "opacity-45",
              "transition-opacity",
            )}
          >
            <span className="absolute inset-x-[12%] flex flex-col items-center justify-end" style={{ bottom: mitad, height: mitad }}>
              <span className="rep-cifra text-[0.625rem] font-bold text-muted mb-0.5">{p.entradas || ""}</span>
              <span className="w-full rounded-t-[4px]" style={{ height: h(p.entradas), background: colorEntradas }} />
            </span>
            <span className="absolute inset-x-[12%] flex flex-col items-center" style={{ top: mitad, height: mitad }}>
              <span className="w-full rounded-b-[4px]" style={{ height: h(p.salidas), background: colorSalidas }} />
              <span className="rep-cifra text-[0.625rem] font-bold text-muted mt-0.5">{p.salidas || ""}</span>
            </span>
            {encima === i && (
              <span className="absolute bottom-[55%] left-1/2 -translate-x-1/2 z-10 min-w-36 rounded-[0.625rem] border border-border-strong bg-surface px-3 py-2 shadow-lg pointer-events-none text-left">
                <span className="block text-xs font-semibold text-text mb-1">{p.nombre}</span>
                <span className="flex justify-between gap-3 text-[0.6875rem] text-muted">
                  {etiquetaEntradas} <b className="rep-cifra text-text">{cifra(p.entradas)}</b>
                </span>
                <span className="flex justify-between gap-3 text-[0.6875rem] text-muted">
                  {etiquetaSalidas} <b className="rep-cifra text-text">{cifra(p.salidas)}</b>
                </span>
                {p.saldo !== undefined && (
                  <span className="flex justify-between gap-3 text-[0.6875rem] text-muted border-t border-border mt-1 pt-1">
                    {etiquetaSaldo} <b className="rep-cifra text-text">{cifra(p.saldo)}</b>
                  </span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-1.5 lg:gap-2.5" style={columnas}>
        {puntos.map((p) => {
          const neto = p.entradas - p.salidas;
          return (
            <span key={p.nombre} className="flex flex-col items-center gap-0.5 text-center">
              <span className="text-xs text-muted whitespace-nowrap">{p.nombre}</span>
              <b className="rep-cifra text-[0.6875rem]" style={{ color: neto > 0 ? colorEntradas : neto < 0 ? colorSalidas : "var(--color-faint)" }}>
                {neto > 0 ? "+" : neto < 0 ? "−" : ""}
                {cifra(Math.abs(neto))}
              </b>
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: colorEntradas }} />
          {etiquetaEntradas}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: colorSalidas }} />
          {etiquetaSalidas}
        </span>
        <span className="ml-auto text-faint">Bajo cada mes, el neto</span>
      </div>
    </div>
  );
}
