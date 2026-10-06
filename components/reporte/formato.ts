// Formatos de cifras del Reporte Tipo 1 (es-CL). Los montos se muestran en millones (MM).

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const unDecimal = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 30495 → «30.495». */
export function cifra(n: number) {
  return entero.format(n);
}

/** Participación de `n` en `total` con un decimal: «22,2». Total cero → «0,0». */
export function porcentaje(n: number, total: number) {
  return unDecimal.format(total ? (n / total) * 100 : 0);
}

/** Iniciales para el avatar de una fila: «Constructora Los Andes SpA» → «CL». */
export function iniciales(nombre: string) {
  const palabras = nombre
    .replace(/\b(SpA|Ltda\.?|S\.A\.?|y|de|del|la|las|los)\b/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((palabras[0]?.[0] ?? "") + (palabras[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Colores de serie (tokens --color-serie-N de app/shell.css), en orden. Escritos completos a
 * propósito: Tailwind v4 solo emite las variables del @theme que encuentra escritas en el
 * código, y un nombre armado con plantilla (`--color-serie-${i}`) no lo detecta.
 */
export const SERIES = [
  "var(--color-serie-1)",
  "var(--color-serie-2)",
  "var(--color-serie-3)",
  "var(--color-serie-4)",
  "var(--color-serie-5)",
  "var(--color-serie-6)",
  "var(--color-serie-7)",
  "var(--color-serie-8)",
];

/**
 * Semáforo de cumplimiento de meta: sobre 100 % verde, 90-99 % ámbar, bajo 90 % rojo de datos.
 * Sin meta (null), gris.
 */
export function colorCumplimiento(pct: number | null) {
  if (pct === null) return "var(--color-serie-8)";
  // Se evalúa sobre el entero que se muestra: un 99,6 % rotulado «100 %» va en verde.
  pct = Math.round(pct);
  return pct >= 100 ? "var(--color-serie-5)" : pct >= 90 ? "var(--color-serie-2)" : "var(--color-serie-3)";
}

/** Número con un decimal: «14,2». */
export function decimal(n: number) {
  return unDecimal.format(n);
}

/**
 * Semáforo contra un tope (rotación, ausentismo: menos es mejor): hasta el 90 % del tope verde,
 * hasta el tope ámbar, sobre el tope rojo de datos.
 */
export function colorTope(valor: number, tope: number) {
  return valor <= tope * 0.9 ? "var(--color-serie-5)" : valor <= tope ? "var(--color-serie-2)" : "var(--color-serie-3)";
}

/** Variación con signo y un decimal: «+11,2 %», «−3,1 %». */
export function conSigno(pct: number) {
  const texto = unDecimal.format(Math.abs(pct));
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${texto} %`;
}

/** Fondo suave de una serie para insignias y avatares. */
export function fondoSerie(color: string, pctMezcla = 15) {
  return `color-mix(in srgb, ${color} ${pctMezcla}%, transparent)`;
}
