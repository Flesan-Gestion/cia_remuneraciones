import { useId } from "react";
import { cn } from "@/lib/cn";
import { cifra } from "./formato";
import { Rotulo } from "./tarjeta";

/**
 * Tarjeta principal del Reporte Tipo 1: una cifra muy grande, la cifra de contraste al lado
 * (ej. contratado / facturado), la barra de avance entre ambas, chips de conteo y la tendencia
 * de fondo. Lleva el brillo rojo de .rep-destacada.
 */
export function KpiPrincipal({
  rotulo,
  valor,
  prefijo = "$",
  unidad = "MM",
  contraste,
  chips = [],
  tendencia = [],
  className,
}: {
  rotulo: string;
  valor: number;
  prefijo?: string;
  unidad?: string;
  /** Segunda cifra y cuánto representa de la principal (0-100). */
  contraste?: { valor: number; etiqueta: string; avance: number; etiquetaAvance: string };
  chips?: { valor: number; etiqueta: string }[];
  /** Serie para la curva de fondo (cualquier escala: se normaliza). */
  tendencia?: number[];
  className?: string;
}) {
  const id = useId();
  const max = Math.max(...tendencia, 1);
  const min = Math.min(...tendencia, 0);
  const puntos = tendencia.map((v, i) => {
    const x = tendencia.length > 1 ? (i / (tendencia.length - 1)) * 760 : 0;
    const y = 116 - ((v - min) / (max - min || 1)) * 104;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const linea = puntos.length ? `M${puntos.join(" L")}` : "";

  return (
    <section
      data-bloque="kpi-principal"
      data-bloque-titulo={rotulo}
      className={cn("card rep-destacada @container relative overflow-hidden p-6 lg:p-7 min-w-0", className)}
    >
      {linea && (
        <svg viewBox="0 0 760 120" preserveAspectRatio="none" aria-hidden className="absolute inset-x-0 bottom-0 w-full h-28 pointer-events-none">
          <path d={`${linea} L760 120 L0 120 Z`} fill={`url(#${id})`} />
          <path d={linea} fill="none" stroke="var(--color-serie-1)" strokeWidth={2} strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-serie-1)" stopOpacity={0.16} />
              <stop offset="1" stopColor="var(--color-serie-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
      )}
      <div className="relative flex flex-col gap-4">
        <Rotulo punto>{rotulo}</Rotulo>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {prefijo && <span className="text-2xl font-semibold text-muted">{prefijo}</span>}
          <span className="rep-cifra text-[clamp(3rem,11cqw,5.25rem)] font-extrabold text-text">{cifra(valor)}</span>
          <span className="text-lg font-semibold text-faint">{unidad}</span>
          {contraste && (
            <>
              <span aria-hidden className="text-[clamp(2rem,6cqw,3rem)] font-light text-border-strong mx-1">/</span>
              <span className="rep-cifra text-[clamp(1.625rem,5cqw,2.5rem)] font-bold text-serie-1">{cifra(contraste.valor)}</span>
              <span className="text-sm text-muted whitespace-nowrap">{contraste.etiqueta}</span>
            </>
          )}
        </div>
        {contraste && (
          <div className="flex items-center gap-3 max-w-[46rem]">
            <div
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={contraste.avance}
              aria-label={contraste.etiquetaAvance}
              className="flex-1 h-2 rounded-full bg-border overflow-hidden"
            >
              <div className="h-full rounded-full bg-serie-1" style={{ width: `${Math.min(contraste.avance, 100)}%` }} />
            </div>
            <span className="rep-cifra text-base font-bold text-serie-1">{contraste.avance.toLocaleString("es-CL", { maximumFractionDigits: 1 })} %</span>
            <span className="text-xs text-muted -ml-1">{contraste.etiquetaAvance}</span>
          </div>
        )}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <span key={c.etiqueta} className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-[0.625rem] border border-border-strong bg-surface/70 backdrop-blur-sm">
                <b className="rep-cifra text-base font-extrabold text-text">{cifra(c.valor)}</b>
                <span className="text-xs text-muted">{c.etiqueta}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Panel de cifras de contexto («Universo en revisión»): tres o cuatro cifras apiladas con su
 * explicación. Borde punteado: es contexto fijo, no responde a los filtros.
 */
export function PanelCifras({
  rotulo,
  insignia,
  cifras,
  className,
}: {
  rotulo: string;
  insignia?: string;
  cifras: { valor: string; texto: string; detalle?: string }[];
  className?: string;
}) {
  return (
    <section className={cn("card p-6 flex flex-col min-w-0 border-dashed! shadow-none!", className)}>
      <div className="flex items-center gap-2.5 mb-2">
        <Rotulo>{rotulo}</Rotulo>
        {insignia && <span className="text-[0.625rem] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded-md bg-surface-2 text-muted">{insignia}</span>}
      </div>
      <dl className="flex flex-col divide-y divide-border">
        {cifras.map((c) => (
          <div key={c.texto} className="flex items-center gap-4 py-3">
            <dt className="rep-cifra text-[2.375rem] font-extrabold text-text min-w-[7rem]">{c.valor}</dt>
            <dd className="flex flex-col gap-0.5 m-0">
              <span className="text-sm text-text">{c.texto}</span>
              {c.detalle && <span className="text-xs text-faint">{c.detalle}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
