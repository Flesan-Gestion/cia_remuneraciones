import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

function slug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Bloque del Reporte Tipo 1: número de bloque, título y detalle en una línea, acciones a la
 * derecha. `data-bloque` permite agregar solo este bloque a una presentación.
 */
export function TarjetaReporte({
  numero,
  titulo,
  detalle,
  acciones,
  className,
  children,
}: {
  numero?: number;
  titulo: string;
  /** Texto chico al lado del título: qué mide, unidad o corte. */
  detalle?: ReactNode;
  acciones?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-bloque={slug(titulo)}
      data-bloque-titulo={titulo}
      className={cn("card flex flex-col gap-3 p-5 min-w-0", className)}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
        {numero !== undefined && (
          <span
            aria-hidden
            className="self-center w-6 h-6 shrink-0 rounded-md border border-border-strong text-xs text-muted inline-flex items-center justify-center"
          >
            {numero}
          </span>
        )}
        <h2 className="text-xl font-bold tracking-tight text-text">{titulo}</h2>
        {detalle && <span className="text-xs text-faint">{detalle}</span>}
        {acciones && <div className="ml-auto flex flex-wrap items-center gap-2">{acciones}</div>}
      </header>
      <div className="min-w-0 flex-1 flex flex-col">{children}</div>
    </section>
  );
}

/** Rótulo en mayúsculas espaciadas con punto opcional («● MONTO CONTRATADO»). */
export function Rotulo({ children, punto = false, className }: { children: ReactNode; punto?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted", className)}>
      {punto && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-flesan-red" />}
      {children}
    </span>
  );
}

/** Selector de vista en píldora (En ejecución / Histórico). La opción activa lleva punto rojo. */
export function Pildoras<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: { id: T; texto: string }[];
  valor: T;
  onCambio: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex gap-1 p-1 rounded-full border border-border bg-surface">
      {opciones.map((o) => {
        const activa = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => onCambio(o.id)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[0.8125rem] font-semibold cursor-pointer transition-colors",
              activa ? "bg-surface-2 text-text dark:bg-border-strong" : "text-muted hover:text-text",
            )}
          >
            {activa && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-flesan-red" />}
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}
