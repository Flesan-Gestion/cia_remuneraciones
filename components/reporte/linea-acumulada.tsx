import { cifra } from "./formato";

/**
 * Acumulado del año contra la meta acumulada y el año anterior, mes a mes. El actual va con
 * área y puntos; la meta punteada; el año anterior en gris.
 */
export function LineaAcumulada({
  categorias,
  actual,
  meta,
  anterior,
  etiquetaActual = "2026",
  etiquetaAnterior = "2025",
  divisor = 1000,
  alto = 240,
}: {
  categorias: string[];
  /** Valores por período (no acumulados); null = sin datos aún. */
  actual: (number | null)[];
  meta?: (number | null)[];
  anterior?: number[];
  etiquetaActual?: string;
  etiquetaAnterior?: string;
  divisor?: number;
  alto?: number;
}) {
  const acumular = (vs: (number | null)[]) => {
    let s = 0;
    return vs.map((v) => (v === null ? null : (s += v)));
  };
  const a = acumular(actual);
  const m = meta ? acumular(meta) : [];
  const p = anterior ? acumular(anterior) : [];
  const max = Math.max(...[...a, ...m, ...p].map((v) => v ?? 0), 1) * 1.05;
  const W = 860;
  const X = (i: number) => 12 + (i / Math.max(categorias.length - 1, 1)) * (W - 24);
  const Y = (v: number) => alto - 4 - (v / max) * (alto - 12);
  const camino = (vs: (number | null)[]) =>
    vs
      .map((v, i) => (v === null ? null : `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`))
      .filter(Boolean)
      .map((pt, i) => `${i ? "L" : "M"}${pt}`)
      .join(" ");
  const ultimo = a.reduce<number>((u, v, i) => (v === null ? u : i), 0);
  const lineaActual = camino(a);

  return (
    <div className="flex flex-col gap-2 flex-1">
      <svg viewBox={`0 0 ${W} ${alto}`} preserveAspectRatio="none" className="w-full" style={{ height: alto }} role="img" aria-label={`Acumulado ${etiquetaActual}: ${cifra((a[ultimo] ?? 0) / divisor)}`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={alto * f} y2={alto * f} stroke="var(--color-border)" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={0} x2={W} y1={alto - 1} y2={alto - 1} stroke="var(--color-border-strong)" vectorEffect="non-scaling-stroke" />
        <path d={`${lineaActual} L${X(ultimo).toFixed(1)} ${alto} L${X(0).toFixed(1)} ${alto} Z`} fill="var(--color-serie-1)" fillOpacity={0.12} />
        {p.length > 0 && <path d={camino(p)} fill="none" stroke="var(--color-faint)" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        {m.length > 0 && <path d={camino(m)} fill="none" stroke="var(--color-text)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
        <path d={lineaActual} fill="none" stroke="var(--color-serie-1)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="grid text-xs text-muted" style={{ gridTemplateColumns: `repeat(${categorias.length}, minmax(0, 1fr))` }}>
        {categorias.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-[3px] rounded-full bg-serie-1" />
          {etiquetaActual} · {cifra((a[ultimo] ?? 0) / divisor)}
        </span>
        {m.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 border-t-[1.5px] border-dashed border-text/70" />
            Meta · {cifra((m[ultimo] ?? 0) / divisor)}
          </span>
        )}
        {p.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 rounded-full bg-faint" />
            {etiquetaAnterior} · {cifra((p[ultimo] ?? 0) / divisor)} a la misma fecha
          </span>
        )}
      </div>
    </div>
  );
}
