import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Rotulo } from "./tarjeta";

/**
 * KPI chico para una franja de 3 a 5 cifras junto a la tarjeta principal: rótulo, cifra,
 * detalle y, si se pasa `avance`, una barra con la marca de la meta.
 */
export function KpiTarjeta({
  rotulo,
  valor,
  prefijo,
  unidad,
  detalle,
  color,
  avance,
  className,
}: {
  rotulo: string;
  valor: ReactNode;
  prefijo?: string;
  unidad?: string;
  detalle?: ReactNode;
  /** Color de la cifra (ej. el semáforo de cumplimiento). */
  color?: string;
  /** Avance 0-125 con la meta en 100: la barra llega al 80 % del ancho en la meta. */
  avance?: number;
  className?: string;
}) {
  return (
    <section className={cn("card @container p-5 flex flex-col gap-1.5 min-w-0", className)}>
      <Rotulo>{rotulo}</Rotulo>
      <span className="flex items-baseline gap-1.5 min-w-0">
        {prefijo && <span className="text-base font-semibold text-muted">{prefijo}</span>}
        <span className="rep-cifra text-[clamp(1.75rem,16cqw,2.5rem)] font-extrabold truncate" style={{ color: color ?? "var(--color-text)" }}>
          {valor}
        </span>
        {unidad && <span className="text-sm font-semibold text-faint">{unidad}</span>}
      </span>
      {detalle && <span className="text-xs text-muted">{detalle}</span>}
      {avance !== undefined && (
        <span className="relative mt-auto h-1.5 rounded-full bg-surface-2" aria-hidden>
          <span className="block h-full rounded-full" style={{ width: `${Math.min(avance / 1.25, 100)}%`, background: color ?? "var(--color-serie-1)" }} />
          <span className="absolute -top-1 left-[80%] w-0.5 h-3.5 rounded-full bg-text" />
        </span>
      )}
    </section>
  );
}
