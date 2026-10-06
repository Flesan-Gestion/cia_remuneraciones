"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { cifra } from "./formato";

export interface SerieApilada {
  clave: string;
  nombre: string;
  color: string;
  /** Un valor por categoría, en el mismo orden que `categorias`. */
  valores: number[];
}

/**
 * Barras verticales apiladas por categoría (años, meses) con el total arriba de cada barra,
 * leyenda abajo y detalle al pasar el mouse o con foco. `seleccion` atenúa las otras series.
 */
export function BarrasApiladas({
  categorias,
  series,
  seleccion,
  alto = 200,
  unidad = " MM",
}: {
  categorias: string[];
  series: SerieApilada[];
  seleccion?: string | null;
  /** Alto máximo de barra en px. */
  alto?: number;
  unidad?: string;
}) {
  const [activa, setActiva] = useState<number | null>(null);
  const totales = categorias.map((_, i) => series.reduce((s, se) => s + (se.valores[i] ?? 0), 0));
  const max = Math.max(...totales, 1);

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div
        className="rep-grilla grid items-end gap-2 lg:gap-2.5 border-b border-border-strong pt-2 flex-1"
        style={{ gridTemplateColumns: `repeat(${categorias.length}, minmax(0, 1fr))`, minHeight: alto + 28 }}
      >
        {categorias.map((cat, i) => (
          <div
            key={cat}
            tabIndex={0}
            role="img"
            aria-label={`${cat}: ${series.map((s) => `${s.nombre} ${cifra(s.valores[i] ?? 0)}`).join(", ")}; total ${cifra(totales[i])}${unidad}`}
            onMouseEnter={() => setActiva(i)}
            onMouseLeave={() => setActiva(null)}
            onFocus={() => setActiva(i)}
            onBlur={() => setActiva(null)}
            className="relative flex flex-col items-center justify-end gap-1.5 h-full outline-none focus-visible:ring-2 focus-visible:ring-flesan-red rounded-t-md"
          >
            <span className={cn("rep-cifra text-xs font-bold transition-colors", activa === i ? "text-text" : "text-muted")}>{cifra(totales[i])}</span>
            <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden">
              {series.map((s) => (
                <div
                  key={s.clave}
                  className="transition-opacity"
                  style={{
                    height: Math.max(((s.valores[i] ?? 0) / max) * alto, (s.valores[i] ?? 0) > 0 ? 1 : 0),
                    background: s.color,
                    opacity: seleccion && seleccion !== s.clave ? 0.18 : 1,
                  }}
                />
              ))}
            </div>
            {activa === i && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 min-w-40 rounded-[0.625rem] border border-border-strong bg-surface px-3 py-2 shadow-lg pointer-events-none">
                <div className="text-xs font-semibold text-text mb-1">{cat}</div>
                {series.map((s) => (
                  <div key={s.clave} className="flex items-center gap-2 text-[0.6875rem] text-muted">
                    <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                    <span className="flex-1">{s.nombre}</span>
                    <b className="rep-cifra text-text">{cifra(s.valores[i] ?? 0)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-2 lg:gap-2.5" style={{ gridTemplateColumns: `repeat(${categorias.length}, minmax(0, 1fr))` }}>
        {categorias.map((c) => (
          <span key={c} className="text-center text-xs text-muted">
            {c}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.clave} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
            {s.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}
