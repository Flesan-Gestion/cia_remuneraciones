"use client";

import { cn } from "@/lib/cn";
import { cifra, porcentaje } from "./formato";

export interface ItemColumna {
  clave: string;
  nombre: string;
  valor: number;
}

/**
 * Columnas simples por tramo (histograma): cantidad arriba, % abajo y el tramo como rótulo.
 * Un clic en la columna la elige y atenúa las demás.
 */
export function Columnas({
  items,
  seleccion,
  onSeleccion,
  color = "var(--color-serie-1)",
  alto = 170,
}: {
  items: ItemColumna[];
  seleccion?: string | null;
  onSeleccion?: (clave: string) => void;
  color?: string;
  alto?: number;
}) {
  const total = items.reduce((s, i) => s + i.valor, 0);
  const max = Math.max(...items.map((i) => i.valor), 1);
  const plantilla = { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` };

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="rep-grilla grid items-end gap-2 border-b border-border-strong" style={{ ...plantilla, height: alto + 22 }}>
        {items.map((it) => (
          <button
            key={it.clave}
            type="button"
            onClick={() => onSeleccion?.(it.clave)}
            disabled={!onSeleccion}
            aria-pressed={seleccion === it.clave}
            aria-label={`${it.nombre}: ${cifra(it.valor)}`}
            className={cn(
              "flex flex-col items-center justify-end gap-1 h-full rounded-t-md transition-opacity focus-visible:outline-2 focus-visible:outline-flesan-red",
              onSeleccion && "cursor-pointer",
              seleccion && seleccion !== it.clave && "opacity-35",
            )}
          >
            <b className="rep-cifra text-xs font-bold text-text">{cifra(it.valor)}</b>
            <span className="w-[72%] rounded-t-[4px]" style={{ height: (it.valor / max) * alto, background: color }} />
          </button>
        ))}
      </div>
      <div className="grid gap-2" style={plantilla}>
        {items.map((it) => (
          <span key={it.clave} className="flex flex-col items-center text-center">
            <span className="text-xs font-semibold text-text whitespace-nowrap">{it.nombre}</span>
            <span className="rep-cifra text-[0.6875rem] text-faint">{porcentaje(it.valor, total)} %</span>
          </span>
        ))}
      </div>
    </div>
  );
}
