"use client";

import { cn } from "@/lib/cn";
import { cifra, porcentaje } from "./formato";

export interface TramoPiramide {
  nombre: string;
  /** Cantidad a la izquierda y a la derecha (ej. hombres y mujeres). */
  izquierda: number;
  derecha: number;
}

/**
 * Pirámide de población: un tramo por fila (el mayor arriba), un lado a cada costado del eje.
 * Un clic en la fila filtra el tramo; un clic en la leyenda filtra el lado.
 */
export function PiramideEdad({
  tramos,
  lados,
  seleccion,
  onSeleccion,
  seleccionLado,
  onLado,
}: {
  /** En orden ascendente (el tramo más joven primero); se dibuja al revés. */
  tramos: TramoPiramide[];
  lados: [{ clave: string; nombre: string; color: string }, { clave: string; nombre: string; color: string }];
  seleccion?: number | null;
  onSeleccion?: (indice: number) => void;
  seleccionLado?: string | null;
  onLado?: (clave: string) => void;
}) {
  const max = Math.max(...tramos.map((t) => Math.max(t.izquierda, t.derecha)), 1);
  const totales = [tramos.reduce((s, t) => s + t.izquierda, 0), tramos.reduce((s, t) => s + t.derecha, 0)];
  const total = totales[0] + totales[1];
  const apagado = (i: 0 | 1) => !!seleccionLado && seleccionLado !== lados[i].clave;

  return (
    <div className="@container flex-1 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {lados.map((l, i) => (
          <button
            key={l.clave}
            type="button"
            onClick={() => onLado?.(l.clave)}
            disabled={!onLado}
            aria-pressed={seleccionLado === l.clave}
            data-atenuado={apagado(i as 0 | 1) || undefined}
            className={cn("rep-filtrable flex items-baseline gap-2 px-3 py-2 rounded-[0.625rem] border border-border", i === 0 ? "justify-end text-right" : "", onLado && "cursor-pointer")}
          >
            {i === 1 && <span aria-hidden className="w-2.5 h-2.5 rounded-sm self-center" style={{ background: l.color }} />}
            <span className="text-[0.8125rem] font-semibold">{l.nombre}</span>
            <b className="rep-cifra text-lg font-extrabold">{cifra(totales[i])}</b>
            <span className="rep-cifra text-xs text-muted">{porcentaje(totales[i], total)} %</span>
            {i === 0 && <span aria-hidden className="w-2.5 h-2.5 rounded-sm self-center" style={{ background: l.color }} />}
          </button>
        ))}
      </div>
      <ul className="flex-1 flex flex-col justify-between gap-0.5">
        {[...tramos].reverse().map((t, k) => {
          const i = tramos.length - 1 - k;
          const atenuado = seleccion != null && seleccion !== i;
          return (
            <li key={t.nombre}>
              <button
                type="button"
                onClick={() => onSeleccion?.(i)}
                disabled={!onSeleccion}
                aria-pressed={seleccion === i}
                aria-label={`${t.nombre} años: ${cifra(t.izquierda)} ${lados[0].nombre.toLowerCase()}, ${cifra(t.derecha)} ${lados[1].nombre.toLowerCase()}`}
                data-atenuado={atenuado || undefined}
                className={cn("rep-filtrable w-full grid grid-cols-[minmax(0,1fr)_4.25rem_minmax(0,1fr)] items-center gap-2 px-1 py-1.5 rounded-md", onSeleccion && "cursor-pointer")}
              >
                <span className="flex items-center justify-end gap-2 min-w-0">
                  <span className="rep-cifra text-[0.6875rem] text-muted">{cifra(t.izquierda)}</span>
                  <span
                    className="h-5 rounded-l-[4px] transition-opacity"
                    style={{ width: `${(t.izquierda / max) * 82}%`, background: lados[0].color, opacity: apagado(0) ? 0.25 : 1 }}
                  />
                </span>
                <span className="text-center text-xs font-semibold text-text whitespace-nowrap">{t.nombre}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-5 rounded-r-[4px] transition-opacity"
                    style={{ width: `${(t.derecha / max) * 82}%`, background: lados[1].color, opacity: apagado(1) ? 0.25 : 1 }}
                  />
                  <span className="rep-cifra text-[0.6875rem] text-muted">{cifra(t.derecha)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
