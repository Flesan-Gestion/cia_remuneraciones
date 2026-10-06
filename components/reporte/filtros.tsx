"use client";

import { X } from "lucide-react";
import { Rotulo } from "./tarjeta";

export interface FiltroActivo {
  clave: string;
  texto: string;
  color?: string;
  quitar: () => void;
}

/**
 * Barra de filtros cruzados: muestra lo elegido con clic en los gráficos, cada uno con su ×, y
 * «Limpiar» cuando hay más de uno. Sin filtros, invita a hacer clic en un gráfico.
 */
export function BarraFiltros({ filtros, onLimpiar }: { filtros: FiltroActivo[]; onLimpiar?: () => void }) {
  return (
    <div data-tutorial="filtros" className="card flex flex-wrap items-center gap-2.5 px-5 min-h-12 py-2 rounded-full! shadow-none!" aria-live="polite">
      <Rotulo className="mr-1">Filtros</Rotulo>
      {filtros.length === 0 && <span className="text-[0.8125rem] text-faint">Clic en un gráfico para filtrar</span>}
      {filtros.map((f) => (
        <button
          key={f.clave}
          type="button"
          onClick={f.quitar}
          aria-label={`Quitar filtro ${f.texto}`}
          className="inline-flex items-center gap-2 pl-3 pr-2 py-1 rounded-full border border-border-strong bg-surface-2 text-[0.8125rem] text-text cursor-pointer hover:border-faint"
        >
          {f.color && <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: f.color }} />}
          {f.texto}
          <X className="w-3.5 h-3.5 text-muted" aria-hidden />
        </button>
      ))}
      {filtros.length > 1 && onLimpiar && (
        <button type="button" onClick={onLimpiar} className="ml-auto text-xs text-muted hover:text-text cursor-pointer">
          Limpiar
        </button>
      )}
    </div>
  );
}
