// Helpers puros de geometría SVG para las muestras «Plantilla actual» del laboratorio de diseño.
// Sin librería externa (recharts/d3): mantiene el stack minimalista y todo el
// color viene de tokens (--color-chart-*) para que los gráficos respondan a
// modo oscuro sin lógica adicional.

export interface Point {
  x: number;
  y: number;
}

/** Mapea un valor de dominio de datos a un rango de píxeles (ej. valor → coordenada Y, invertido). */
export function scaleLinear(value: number, domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): number {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
  const t = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + t * (rangeMax - rangeMin);
}

/** Path de línea recta entre puntos: "M x,y L x,y L x,y". */
export function buildLinePath(points: Point[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

/** Path de línea suavizada (Catmull-Rom → Bézier cúbica), misma API que buildLinePath. */
export function buildSmoothPath(points: Point[]): string {
  if (points.length < 3) return buildLinePath(points);
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Cierra un path de línea (recta o suave) hacia la línea base, para relleno de área. */
export function buildAreaPath(linePath: string, points: Point[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L${last.x},${baselineY} L${first.x},${baselineY} Z`;
}

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): Point {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Path de un arco/sector (torta si innerR=0, dona si innerR>0) entre dos ángulos en grados. */
export function arcSlicePath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const outerStart = polarToCartesian(cx, cy, outerR, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);

  if (innerR <= 0) {
    return `M${cx},${cy} L${outerStart.x},${outerStart.y} A${outerR},${outerR} 0 ${largeArc} 0 ${outerEnd.x},${outerEnd.y} Z`;
  }

  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  return [
    `M${outerStart.x},${outerStart.y}`,
    `A${outerR},${outerR} 0 ${largeArc} 0 ${outerEnd.x},${outerEnd.y}`,
    `L${innerStart.x},${innerStart.y}`,
    `A${innerR},${innerR} 0 ${largeArc} 1 ${innerEnd.x},${innerEnd.y}`,
    "Z",
  ].join(" ");
}

/** Convierte un arreglo de valores en slices {startAngle, endAngle} proporcionales a 360°. */
export function toSlices<T extends { valor: number }>(data: T[]): (T & { startAngle: number; endAngle: number; pct: number })[] {
  const total = data.reduce((acc, d) => acc + d.valor, 0);
  let acc = 0;
  return data.map((d) => {
    const startAngle = (acc / total) * 360;
    acc += d.valor;
    const endAngle = (acc / total) * 360;
    return { ...d, startAngle, endAngle, pct: total === 0 ? 0 : d.valor / total };
  });
}

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
] as const;
