"use client";

import { cn } from "@/lib/cn";
import { cifra, porcentaje } from "./formato";

export interface ItemDona {
  clave: string;
  nombre: string;
  valor: number;
  /** Texto chico junto al monto («12 contratos»). */
  detalle?: string;
  color: string;
}

const R = 70;
const C = 2 * Math.PI * R;

/**
 * Dona con la leyenda al lado: monto, detalle y % por categoría, y el total al centro. Cada
 * fila de la leyenda (y cada arco) filtra al hacer clic: `seleccion` es la clave elegida.
 */
export function DonaLeyenda({
  items,
  seleccion,
  onSeleccion,
  centro = "MM contratados",
  prefijo = "$ ",
  unidad = " MM",
  compacta = false,
}: {
  items: ItemDona[];
  seleccion?: string | null;
  onSeleccion?: (clave: string) => void;
  centro?: string;
  prefijo?: string;
  unidad?: string;
  /** Filas más bajas, para leyendas de 6 o más categorías. */
  compacta?: boolean;
}) {
  const total = items.reduce((s, i) => s + i.valor, 0);
  let acumulado = 0;
  const arcos = items.map((it) => {
    const largo = total ? (it.valor / total) * C : 0;
    const arco = { ...it, largo, desde: acumulado };
    acumulado += largo;
    return arco;
  });
  const atenuado = (clave: string) => !!seleccion && seleccion !== clave;

  return (
    <div className="@container flex-1 flex">
      <div className="flex-1 flex flex-col @[26rem]:flex-row items-center gap-6 @[36rem]:gap-8">
        <div className="relative w-40 h-40 @[36rem]:w-48 @[36rem]:h-48 shrink-0">
          <svg
            viewBox="0 0 180 180"
            className="w-full h-full"
            role="img"
            aria-label={`Total ${cifra(total)}${unidad}`}
          >
            <circle
              cx={90}
              cy={90}
              r={R}
              fill="none"
              stroke="var(--color-surface-2)"
              strokeWidth={22}
            />
            {arcos.map((a) => (
              <circle
                key={a.clave}
                cx={90}
                cy={90}
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={22}
                strokeDasharray={`${Math.max(a.largo - 3, 0.5)} ${C}`}
                strokeDashoffset={-a.desde}
                transform="rotate(-90 90 90)"
                opacity={atenuado(a.clave) ? 0.2 : 1}
                className={cn(
                  "transition-opacity",
                  onSeleccion && "cursor-pointer",
                )}
                onClick={onSeleccion ? () => onSeleccion(a.clave) : undefined}
              >
                <title>{`${a.nombre}: ${prefijo}${cifra(a.valor)}${unidad} (${porcentaje(a.valor, total)} %)`}</title>
              </circle>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="rep-cifra text-[1.375rem] @[36rem]:text-[1.75rem] font-extrabold text-text">
              {cifra(total)}
            </span>
            <span className="text-[0.5625rem] font-semibold tracking-[0.14em] uppercase text-muted">
              {centro}
            </span>
          </div>
        </div>
        <ul className="flex flex-col flex-1 w-full min-w-0">
          {items.map((it) => {
            const contenido = (
              <>
                <span
                  aria-hidden
                  className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: it.color }}
                />
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="text-[0.8125rem] text-muted font-medium">
                    {it.nombre}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <b
                      className={cn(
                        "rep-cifra font-extrabold text-text",
                        compacta ? "text-base" : "text-lg",
                      )}
                    >
                      {prefijo}
                      {cifra(it.valor)}
                      {unidad}
                    </b>
                    {it.detalle && (
                      <span className="text-[0.6875rem] text-faint">
                        {it.detalle}
                      </span>
                    )}
                  </span>
                </span>
                <span className="rep-cifra text-[0.8125rem] text-muted mt-1">
                  {porcentaje(it.valor, total)} %
                </span>
              </>
            );
            return (
              <li key={it.clave}>
                {onSeleccion ? (
                  <button
                    type="button"
                    onClick={() => onSeleccion(it.clave)}
                    aria-pressed={seleccion === it.clave}
                    data-atenuado={atenuado(it.clave) || undefined}
                    className={cn(
                      "rep-filtrable w-full flex items-start gap-3 rounded-[0.625rem] px-2.5 text-left cursor-pointer",
                      compacta ? "py-1" : "py-2",
                    )}
                  >
                    {contenido}
                  </button>
                ) : (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-2.5",
                      compacta ? "py-1" : "py-2",
                    )}
                  >
                    {contenido}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
