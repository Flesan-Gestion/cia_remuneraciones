import { cn } from "@/lib/cn";
import { cifra, fondoSerie, iniciales, porcentaje } from "./formato";

// Celdas de la tabla del Reporte Tipo 1. La tabla se arma con <table className="rep-tabla">
// (estilos en app/shell.css) y estas piezas.

/** Avatar cuadrado con iniciales, en el color de su serie. */
export function Iniciales({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span
      aria-hidden
      className="w-[1.875rem] h-[1.875rem] shrink-0 rounded-lg text-[0.6875rem] font-extrabold inline-flex items-center justify-center"
      style={{ background: fondoSerie(color, 22), color }}
    >
      {iniciales(nombre)}
    </span>
  );
}

/** Nombre en mayúsculas con detalle abajo y avatar a la izquierda. */
export function CeldaNombre({ nombre, detalle, color }: { nombre: string; detalle?: string; color: string }) {
  return (
    <span className="flex items-center gap-3 min-w-0">
      <Iniciales nombre={nombre} color={color} />
      <span className="flex flex-col min-w-0">
        <b className="text-[0.8125rem] font-bold uppercase tracking-[0.01em] text-text truncate">{nombre}</b>
        {detalle && <span className="text-[0.6875rem] text-faint truncate">{detalle}</span>}
      </span>
    </span>
  );
}

/** Insignia de categoría con punto, en el color de su serie. */
export function InsigniaSerie({ texto, color }: { texto: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold whitespace-nowrap" style={{ background: fondoSerie(color), color }}>
      <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {texto}
    </span>
  );
}

/** Valor con «+N» cuando la fila tiene más de uno (unidad principal +2). */
export function ValorConMas({ valor, mas }: { valor: string; mas?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="font-semibold">{valor}</span>
      {!!mas && <span className="text-[0.625rem] px-1.5 py-px rounded-md bg-surface-2 text-muted">+{mas}</span>}
    </span>
  );
}

/** Número en cuadrito (nivel, prioridad). */
export function NumeroCaja({ n }: { n: number }) {
  return <span className="w-6 h-6 rounded-md border border-border-strong inline-flex items-center justify-center font-bold text-xs">{n}</span>;
}

/** Monto con barra relativa al máximo de la tabla y su participación en el total. */
export function CeldaMonto({
  valor,
  max,
  total,
  color = "var(--color-serie-1)",
  prefijo = "$ ",
  unidad = " MM",
  className,
}: {
  valor: number;
  max: number;
  total?: number;
  color?: string;
  prefijo?: string;
  unidad?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center justify-end gap-2.5", className)}>
      <span className="w-20 h-[5px] rounded-full bg-surface-2 overflow-hidden max-xl:hidden" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${max ? (valor / max) * 100 : 0}%`, background: color }} />
      </span>
      <b className="rep-cifra text-[0.9375rem] font-extrabold text-right min-w-24 whitespace-nowrap">
        {prefijo}
        {cifra(valor)}
        {unidad}
      </b>
      {total !== undefined && <span className="rep-cifra text-[0.6875rem] text-faint w-10 text-right">{porcentaje(valor, total)} %</span>}
    </span>
  );
}
