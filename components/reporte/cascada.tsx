"use client";

import { cifra } from "./formato";

export interface PasoCascada {
  clave: string;
  nombre: string;
  /** Positivo suma, negativo resta. */
  valor: number;
  color: string;
}

/**
 * Cascada (puente) de un saldo: el inicial, cada movimiento flotando desde donde quedó el
 * anterior y el final. El eje no parte de cero para que los movimientos se vean al lado de
 * saldos mucho mayores; lo dice la nota al pie.
 */
export function Cascada({
  inicio,
  pasos,
  cierre,
  alto = 200,
  colorSaldo = "var(--color-serie-1)",
}: {
  inicio: { nombre: string; valor: number };
  pasos: PasoCascada[];
  cierre: { nombre: string; valor: number };
  alto?: number;
  colorSaldo?: string;
}) {
  let nivel = inicio.valor;
  const flotantes = pasos.map((p) => {
    const desde = nivel;
    nivel += p.valor;
    return { ...p, desde, hasta: nivel };
  });
  const niveles = [inicio.valor, cierre.valor, ...flotantes.flatMap((p) => [p.desde, p.hasta])];
  const min = Math.min(...niveles);
  const max = Math.max(...niveles);
  const margen = Math.max((max - min) * 0.35, 1);
  const piso = Math.max(0, min - margen);
  const techo = max + margen * 0.25;
  const y = (v: number) => ((v - piso) / (techo - piso)) * alto;

  const columnas = [
    { clave: "inicio", nombre: inicio.nombre, abajo: piso, arriba: inicio.valor, color: colorSaldo, rotulo: cifra(inicio.valor), saldo: true },
    ...flotantes.map((p) => ({
      clave: p.clave,
      nombre: p.nombre,
      abajo: Math.min(p.desde, p.hasta),
      arriba: Math.max(p.desde, p.hasta),
      color: p.color,
      rotulo: `${p.valor > 0 ? "+" : p.valor < 0 ? "−" : ""}${cifra(Math.abs(p.valor))}`,
      saldo: false,
    })),
    { clave: "cierre", nombre: cierre.nombre, abajo: piso, arriba: cierre.valor, color: colorSaldo, rotulo: cifra(cierre.valor), saldo: true },
  ];
  const plantilla = { gridTemplateColumns: `repeat(${columnas.length}, minmax(0, 1fr))` };

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="rep-grilla relative grid gap-2 border-b border-border-strong" style={{ ...plantilla, height: alto + 20 }}>
        {columnas.map((c, i) => {
          const siguiente = columnas[i + 1];
          // Línea que une el nivel en que termina esta columna con la siguiente.
          const nivelFin = c.clave === "inicio" ? c.arriba : c.saldo ? null : flotantes[i - 1].hasta;
          return (
            <div key={c.clave} className="relative h-full" role="img" aria-label={`${c.nombre}: ${c.rotulo}`}>
              <span
                className="absolute inset-x-[10%] rounded-[4px]"
                style={{ bottom: y(c.abajo), height: Math.max(y(c.arriba) - y(c.abajo), 2), background: c.color, opacity: c.saldo ? 1 : 0.9 }}
              />
              <span className="absolute inset-x-0 text-center rep-cifra text-[0.6875rem] font-bold text-text" style={{ bottom: y(c.arriba) + 4 }}>
                {c.rotulo}
              </span>
              {nivelFin !== null && siguiente && (
                <span
                  aria-hidden
                  className="absolute border-t border-dashed border-text/40 pointer-events-none"
                  style={{ bottom: y(nivelFin), left: "90%", width: "calc(20% + 0.5rem)" }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="grid gap-2" style={plantilla}>
        {columnas.map((c) => (
          <span key={c.clave} className="text-center text-[0.6875rem] leading-tight text-muted line-clamp-2" title={c.nombre}>
            {c.nombre}
          </span>
        ))}
      </div>
      <span className="text-xs text-faint">El eje parte en {cifra(Math.round(piso))}, no en cero.</span>
    </div>
  );
}
