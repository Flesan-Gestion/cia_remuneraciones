"use client";

import { cn } from "@/lib/cn";
import { cifra, colorCumplimiento, fondoSerie, iniciales } from "./formato";

export interface FilaMatriz {
  clave: string;
  nombre: string;
  detalle?: string;
  /** Un valor por columna. */
  valores: number[];
  /** Cumplimiento del período (0-∞) o null si no hay meta. */
  cumplimiento?: number | null;
}

/**
 * Matriz de calor filas × columnas (vendedor × mes): la intensidad sigue al valor. Las columnas
 * fuera del período se atenúan; un clic en la cabecera elige la columna, en el nombre elige la
 * fila y en la celda, ambas.
 */
export function MatrizCalor({
  filas,
  columnas,
  activas,
  columnaElegida,
  filaElegida,
  onColumna,
  onFila,
  divisor = 1000,
  color = "var(--color-serie-1)",
}: {
  filas: FilaMatriz[];
  columnas: string[];
  /** Qué columnas entran en el total (el período). */
  activas: boolean[];
  columnaElegida?: number | null;
  filaElegida?: string | null;
  onColumna?: (i: number) => void;
  onFila?: (clave: string) => void;
  divisor?: number;
  color?: string;
}) {
  const max = Math.max(...filas.flatMap((f) => f.valores), 1);
  const totalFila = (f: FilaMatriz) => f.valores.reduce((s, v, i) => s + (activas[i] ? v : 0), 0);
  const totalesColumna = columnas.map((_, i) => filas.reduce((s, f) => s + (f.valores[i] ?? 0), 0));
  const plantilla = `minmax(9rem,11rem) repeat(${columnas.length}, minmax(2.75rem, 1fr)) 5rem 4.5rem`;

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-[5px] items-center min-w-[44rem]" style={{ gridTemplateColumns: plantilla }} role="group" aria-label="Matriz de venta">
        <span />
        {columnas.map((c, i) => (
          <button
            key={c}
            type="button"
           
            onClick={() => onColumna?.(i)}
            aria-pressed={columnaElegida === i}
            className={cn("text-[0.6875rem] font-semibold py-1 rounded-md cursor-pointer hover:text-text", activas[i] ? "text-text" : "text-faint")}
          >
            {c}
          </button>
        ))}
        <span className="text-right text-[0.625rem] font-semibold tracking-[0.12em] uppercase text-faint">
          Total
        </span>
        <span className="text-right text-[0.625rem] font-semibold tracking-[0.12em] uppercase text-faint">
          Meta
        </span>

        {filas.map((f) => {
          const apagada = !!filaElegida && filaElegida !== f.clave;
          const cumpl = f.cumplimiento ?? null;
          const colorC = colorCumplimiento(cumpl);
          return (
            <div key={f.clave} className="contents">
              <button
                type="button"
               
                onClick={() => onFila?.(f.clave)}
                aria-pressed={filaElegida === f.clave}
                className={cn("flex items-center gap-2.5 text-left min-w-0 cursor-pointer transition-opacity", apagada && "opacity-35")}
              >
                <span
                  aria-hidden
                  className="w-7 h-7 shrink-0 rounded-lg text-[0.625rem] font-extrabold inline-flex items-center justify-center"
                  style={{ background: fondoSerie(color, 16), color }}
                >
                  {iniciales(f.nombre)}
                </span>
                <span className="flex flex-col min-w-0">
                  <b className="text-xs font-bold text-text truncate">{f.nombre}</b>
                  {f.detalle && <span className="text-[0.625rem] text-faint truncate">{f.detalle}</span>}
                </span>
              </button>
              {f.valores.map((v, i) => {
                const peso = v / max;
                const fuera = !activas[i] || apagada;
                return (
                  <button
                    key={i}
                    type="button"
                   
                    onClick={() => {
                      onColumna?.(i);
                      if (filaElegida !== f.clave) onFila?.(f.clave);
                    }}
                    aria-label={`${f.nombre}, ${columnas[i]}: ${cifra(v / divisor)}`}
                    className={cn(
                      "h-11 rounded-lg text-xs font-bold rep-cifra cursor-pointer transition-opacity",
                      fuera && "opacity-25",
                      columnaElegida === i && !apagada && "outline-[1.5px] outline outline-text",
                    )}
                    style={{ background: fondoSerie(color, Math.round(8 + 80 * peso)), color: peso > 0.55 ? "#fff" : "var(--color-text)" }}
                  >
                    {cifra(v / divisor)}
                  </button>
                );
              })}
              <b className={cn("rep-cifra text-right text-sm font-extrabold", apagada && "opacity-35")}>
                {cifra(totalFila(f) / divisor)}
              </b>
              <span className={cn("justify-self-end", apagada && "opacity-35")}>
                <span className="rep-cifra text-[0.6875rem] font-bold px-2 py-0.5 rounded-full" style={{ background: fondoSerie(colorC, 15), color: colorC }}>
                  {cumpl === null ? "—" : `${Math.round(cumpl)} %`}
                </span>
              </span>
            </div>
          );
        })}

        <span className="text-[0.625rem] font-semibold tracking-[0.12em] uppercase text-faint pt-2">Total mes</span>
        {totalesColumna.map((t, i) => (
          <b key={i} className={cn("rep-cifra text-center text-xs pt-2", activas[i] ? "text-text" : "text-faint")}>
            {cifra(t / divisor)}
          </b>
        ))}
        <b className="rep-cifra text-right text-sm font-extrabold pt-2">{cifra(totalesColumna.reduce((s, t, i) => s + (activas[i] ? t : 0), 0) / divisor)}</b>
        <span />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted mt-4">
        Menos
        {[10, 30, 55, 85].map((p) => (
          <span key={p} className="w-5 h-3 rounded-[3px]" style={{ background: fondoSerie(color, p) }} />
        ))}
        Más
      </div>
    </div>
  );
}
