"use client";

import { cn } from "@/lib/cn";
import { cifra, colorCumplimiento, fondoSerie, iniciales } from "./formato";

export interface ItemRanking {
  clave: string;
  nombre: string;
  detalle?: string;
  valor: number;
  meta: number | null;
}

/**
 * Ranking contra meta: avatar, nombre, barra de lo logrado con la marca de la meta y la
 * insignia de cumplimiento con el semáforo. Cada fila filtra al hacer clic.
 */
export function RankingMeta({
  items,
  seleccion,
  onSeleccion,
  prefijo = "UF ",
  unidad = "",
  divisor = 1000,
}: {
  items: ItemRanking[];
  seleccion?: string | null;
  onSeleccion?: (clave: string) => void;
  prefijo?: string;
  unidad?: string;
  divisor?: number;
}) {
  const max = Math.max(...items.map((i) => Math.max(i.valor, i.meta ?? 0)), 1);
  const orden = [...items].sort((a, b) => b.valor - a.valor);

  return (
    <div className="@container flex flex-col gap-1">
      <ul className="flex flex-col gap-0.5">
        {orden.map((it) => {
          const pct = it.meta ? (it.valor / it.meta) * 100 : null;
          const color = colorCumplimiento(pct);
          const contenido = (
            <>
              <span
                aria-hidden
                className="w-[1.875rem] h-[1.875rem] shrink-0 rounded-lg text-[0.6875rem] font-extrabold inline-flex items-center justify-center"
                style={{ background: fondoSerie("var(--color-serie-1)", 16), color: "var(--color-serie-1)" }}
              >
                {iniciales(it.nombre)}
              </span>
              <span className="flex flex-col min-w-0 w-[clamp(7rem,28cqw,10rem)] shrink-0">
                <b className="text-[0.8125rem] font-bold text-text truncate">{it.nombre}</b>
                {it.detalle && <span className="text-[0.6875rem] text-faint truncate">{it.detalle}</span>}
              </span>
              <span className="relative flex-1 h-2.5 rounded-full bg-surface-2 @max-[26rem]:hidden" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${(it.valor / max) * 100}%`, background: color }} />
                {it.meta != null && <span className="absolute -top-1 w-0.5 h-[1.125rem] rounded-full bg-text" style={{ left: `${(it.meta / max) * 100}%` }} />}
              </span>
              <b className="rep-cifra text-[0.9375rem] font-extrabold text-right whitespace-nowrap ml-auto">
                {prefijo}
                {cifra(it.valor / divisor)}
                {unidad}
              </b>
              <span
                className="rep-cifra text-xs font-bold px-2 py-0.5 rounded-full w-14 text-center shrink-0"
                style={{ background: fondoSerie(color, 15), color }}
              >
                {pct === null ? "—" : `${Math.round(pct)} %`}
              </span>
            </>
          );
          const clases = "w-full flex items-center gap-3 px-2 py-2 rounded-[0.625rem] text-left";
          return (
            <li key={it.clave}>
              {onSeleccion ? (
                <button
                  type="button"
                  onClick={() => onSeleccion(it.clave)}
                  aria-pressed={seleccion === it.clave}
                  data-atenuado={(seleccion && seleccion !== it.clave) || undefined}
                  className={cn("rep-filtrable cursor-pointer", clases)}
                >
                  {contenido}
                </button>
              ) : (
                <div className={clases}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted pt-2 mt-1 border-t border-border">
        <LeyendaSemaforo />
      </div>
    </div>
  );
}

/** Leyenda del semáforo de cumplimiento. */
export function LeyendaSemaforo() {
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-serie-5" />
        Sobre la meta
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-serie-2" />
        90–99 %
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-serie-3" />
        Bajo 90 %
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-0.5 h-3 rounded-full bg-text" />
        Meta
      </span>
    </>
  );
}
