"use client";

import { cn } from "@/lib/cn";
import { cifra, porcentaje } from "./formato";
import type { ItemDona } from "./dona-leyenda";

/**
 * Participación en una barra al 100 % con una ficha por categoría debajo (nombre, monto, % y
 * detalle). Alternativa a la dona cuando el bloque es ancho y bajo. Filtra al hacer clic.
 */
export function BarraParticipacion({
  items,
  seleccion,
  onSeleccion,
  prefijo = "UF ",
  unidad = " mil",
  divisor = 1000,
}: {
  items: ItemDona[];
  seleccion?: string | null;
  onSeleccion?: (clave: string) => void;
  prefijo?: string;
  unidad?: string;
  divisor?: number;
}) {
  const total = items.reduce((s, i) => s + i.valor, 0);
  const atenuado = (c: string) => !!seleccion && seleccion !== c;
  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex h-8 rounded-[0.625rem] overflow-hidden gap-0.5" role="img" aria-label="Participación por categoría">
        {items.map((it) => (
          <span
            key={it.clave}
            className="transition-opacity"
            style={{ width: `${total ? (it.valor / total) * 100 : 0}%`, background: it.color, opacity: atenuado(it.clave) ? 0.25 : 1 }}
            title={`${it.nombre}: ${porcentaje(it.valor, total)} %`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 @[34rem]:grid-cols-3 @[48rem]:grid-cols-5 gap-2">
        {items.map((it) => (
          <li key={it.clave}>
            <button
              type="button"
              disabled={!onSeleccion}
              onClick={() => onSeleccion?.(it.clave)}
              aria-pressed={seleccion === it.clave}
              data-atenuado={atenuado(it.clave) || undefined}
              className={cn("rep-filtrable w-full flex flex-col gap-0.5 px-2.5 py-2 rounded-[0.625rem] text-left", onSeleccion && "cursor-pointer")}
            >
              <span className="inline-flex items-center gap-1.5 text-xs text-muted min-w-0">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: it.color }} />
                <span className="truncate">{it.nombre}</span>
              </span>
              <b className="rep-cifra text-lg font-extrabold text-text">
                {prefijo}
                {cifra(it.valor / divisor)}
                {unidad}
              </b>
              <span className="rep-cifra text-[0.6875rem] text-faint">
                {porcentaje(it.valor, total)} %{it.detalle ? ` · ${it.detalle}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
