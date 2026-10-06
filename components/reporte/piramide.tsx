"use client";

import { cn } from "@/lib/cn";
import { cifra, porcentaje } from "./formato";

export interface NivelPiramide {
  numero: number;
  nombre: string;
  cantidad: number;
  valor: number;
}

/**
 * Pirámide jerárquica: un peldaño por nivel (el 1 arriba, el más angosto), con cantidad,
 * barra y monto. La intensidad del peldaño sigue al monto; un nivel sin datos queda apagado.
 * Cada fila filtra al hacer clic.
 */
export function Piramide({
  niveles,
  seleccion,
  onSeleccion,
  unidadCantidad = "contratos",
  color = "var(--color-serie-4)",
  prefijo = "$ ",
  unidad = " MM",
}: {
  niveles: NivelPiramide[];
  seleccion?: number | null;
  onSeleccion?: (numero: number) => void;
  unidadCantidad?: string;
  color?: string;
  prefijo?: string;
  unidad?: string;
}) {
  const total = niveles.reduce((s, n) => s + n.valor, 0);
  const max = Math.max(...niveles.map((n) => n.valor), 1);
  const paso = 16;
  const base = 64;

  return (
    <ul className="@container flex flex-col gap-0.5">
      {niveles.map((n, i) => {
        const arriba = base + i * paso;
        const abajo = base + (i + 1) * paso;
        const recorte = ((abajo - arriba) / 2 / abajo) * 100;
        const peso = n.valor / max;
        const vacio = n.cantidad === 0;
        const atenuado = seleccion != null && seleccion !== n.numero;
        const contenido = (
          <>
            <span className="flex justify-center w-[clamp(5.5rem,30cqw,13.5rem)] shrink-0 @max-[22rem]:hidden" aria-hidden>
              <span
                className="h-[2.125rem] flex items-center justify-center"
                style={{
                  // Ancho relativo a la columna: la pirámide se achica con la tarjeta.
                  width: `${(abajo / (base + niveles.length * paso)) * 100}%`,
                  clipPath: `polygon(${recorte.toFixed(1)}% 0, ${(100 - recorte).toFixed(1)}% 0, 100% 100%, 0 100%)`,
                  background: vacio ? "var(--color-surface-2)" : `color-mix(in srgb, ${color} ${Math.round(30 + 60 * peso)}%, transparent)`,
                }}
              >
                <span className={cn("w-[1.375rem] h-[1.375rem] rounded-full bg-surface border border-border-strong text-[0.6875rem] font-bold inline-flex items-center justify-center", vacio ? "text-faint" : "text-text")}>
                  {n.numero}
                </span>
              </span>
            </span>
            <span className={cn("flex flex-col leading-tight w-[clamp(5.5rem,24cqw,9rem)] shrink-0 min-w-0", vacio && "opacity-45")}>
              <b className="text-[0.8125rem] font-bold text-text truncate">Nivel {n.numero}</b>
              <span className="text-[0.6875rem] text-faint truncate">{n.nombre}</span>
            </span>
            <span className={cn("flex items-baseline gap-1 w-[4.5rem] shrink-0", vacio && "opacity-45")}>
              <b className="rep-cifra text-lg font-extrabold text-text">{cifra(n.cantidad)}</b>
              <span className="text-[0.625rem] text-faint @max-[30rem]:hidden">{unidadCantidad}</span>
            </span>
            <span className="flex-1 min-w-8 h-1.5 rounded-full bg-surface-2 overflow-hidden @max-[36rem]:hidden">
              <span className="block h-full rounded-full" style={{ width: `${peso * 100}%`, background: color }} />
            </span>
            <b className={cn("rep-cifra text-[0.9375rem] font-extrabold text-right shrink-0 ml-auto whitespace-nowrap", vacio ? "text-faint" : "text-text")}>
              {prefijo}
              {cifra(n.valor)}
              {unidad}
            </b>
            <span className="rep-cifra text-xs text-muted text-right w-12 shrink-0 @max-[26rem]:hidden">{porcentaje(n.valor, total)} %</span>
          </>
        );
        const clases = "w-full flex items-center gap-2.5 h-9 px-2 rounded-lg text-left";
        return (
          <li key={n.numero}>
            {onSeleccion ? (
              <button
                type="button"
                onClick={() => onSeleccion(n.numero)}
                aria-pressed={seleccion === n.numero}
                data-atenuado={atenuado || undefined}
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
  );
}
