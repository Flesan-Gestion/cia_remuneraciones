"use client";

import { cn } from "@/lib/cn";
import { colorTope, decimal } from "./formato";

export interface ItemTope {
  clave: string;
  nombre: string;
  detalle?: string;
  /** Porcentaje (ej. rotación de 12 meses). */
  valor: number;
  tope: number;
}

/**
 * Ranking contra un tope, donde menos es mejor (rotación, ausentismo, merma): barra con la marca
 * del tope y la cifra con el semáforo de `colorTope`. Ordena de mayor a menor. Filtra al hacer clic.
 */
export function RankingTope({
  items,
  seleccion,
  onSeleccion,
  unidad = " %",
}: {
  items: ItemTope[];
  seleccion?: string | null;
  onSeleccion?: (clave: string) => void;
  unidad?: string;
}) {
  const max = Math.max(...items.map((i) => Math.max(i.valor, i.tope)), 1) * 1.08;
  const orden = [...items].sort((a, b) => b.valor - a.valor);

  return (
    <div className="@container flex flex-col gap-1">
      <ul className="flex flex-col gap-0.5">
        {orden.map((it) => {
          const color = colorTope(it.valor, it.tope);
          return (
            <li key={it.clave}>
              <button
                type="button"
                onClick={() => onSeleccion?.(it.clave)}
                disabled={!onSeleccion}
                aria-pressed={seleccion === it.clave}
                data-atenuado={(seleccion && seleccion !== it.clave) || undefined}
                className={cn("rep-filtrable w-full flex items-center gap-3 px-2 py-2 rounded-[0.625rem] text-left", onSeleccion && "cursor-pointer")}
              >
                <span className="flex flex-col min-w-0 w-[clamp(6.5rem,26cqw,9rem)] shrink-0">
                  <b className="text-[0.8125rem] font-bold text-text truncate">{it.nombre}</b>
                  {it.detalle && <span className="text-[0.6875rem] text-faint truncate">{it.detalle}</span>}
                </span>
                <span className="relative flex-1 h-2.5 rounded-full bg-surface-2 @max-[22rem]:hidden" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${(it.valor / max) * 100}%`, background: color }} />
                  <span className="absolute -top-1 w-0.5 h-[1.125rem] rounded-full bg-text" style={{ left: `${(it.tope / max) * 100}%` }} />
                </span>
                <b className="rep-cifra text-[0.9375rem] font-extrabold text-right whitespace-nowrap w-16 ml-auto" style={{ color }}>
                  {decimal(it.valor)}
                  {unidad}
                </b>
                <span className="rep-cifra text-[0.6875rem] text-faint whitespace-nowrap w-16 text-right shrink-0">tope {it.tope}{unidad}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted pt-2 mt-1 border-t border-border">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-serie-5" />
          Holgado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-serie-2" />
          Cerca del tope
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-serie-3" />
          Sobre el tope
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-0.5 h-3 rounded-full bg-text" />
          Tope
        </span>
      </div>
    </div>
  );
}
