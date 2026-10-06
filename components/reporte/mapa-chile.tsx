"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { cifra } from "./formato";

export interface PuntoMapa {
  clave: string;
  nombre: string;
  lat: number;
  lon: number;
  valor: number;
  /** Borde y relleno de la burbuja (ej. semáforo de cumplimiento). Por defecto, serie 1. */
  color?: string;
  /** Segunda línea de la etiqueta («UF 598 mil · 101 %»). */
  detalle?: string;
}

type Anillo = [number, number][];
interface Coleccion {
  features: { geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Anillo[] | Anillo[][] } }[];
}

// GeoJSON de regiones (el mismo del laboratorio). Se pide una vez por sesión.
let pedido: Promise<Coleccion> | null = null;
function cargarRegiones() {
  pedido ??= fetch("/lab/chile-regiones.json")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Coleccion>;
    })
    .catch((e) => {
      pedido = null;
      throw e;
    });
  return pedido;
}

const LAT_NORTE = -17.3;
const LON_OESTE = -76;
const LON_ESTE = -66.2;
/** Corrección de la proyección equirectangular a la latitud media de Chile. */
const COS = Math.cos((33 * Math.PI) / 180);

function useRegiones(escala: number, latSur: number) {
  const [col, setCol] = useState<Coleccion | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    cargarRegiones()
      .then((c) => vivo && setCol(c))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, []);
  const caminos = useMemo(() => {
    if (!col) return [];
    const x = (lon: number) => (lon - LON_OESTE) * COS * escala;
    const y = (lat: number) => (LAT_NORTE - lat) * escala;
    return col.features.map((f) => {
      const poligonos = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Anillo[][];
      let d = "";
      for (const p of poligonos) {
        const exterior = p[0];
        // Fuera las islas oceánicas y lo que queda al sur del corte.
        if (exterior.every(([lon]) => lon < -77) || exterior.every(([, lat]) => lat < latSur - 1)) continue;
        let ax = Infinity;
        let ay = Infinity;
        exterior.forEach(([lon, lat], i) => {
          const px = x(lon);
          const py = y(lat);
          if (i && Math.abs(px - ax) + Math.abs(py - ay) < 0.9) return;
          d += `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`;
          ax = px;
          ay = py;
        });
        d += "Z";
      }
      return d;
    });
  }, [col, escala, latSur]);
  return { caminos, error };
}

/**
 * Mapa de Chile continental con burbujas por punto (ciudad, obra). El área de la burbuja sigue
 * al valor; las etiquetas van en una columna a la derecha, unidas por una guía, sin taparse.
 * `latSur` corta el mapa (por defecto en Aysén) para no gastar alto en lo que no tiene datos.
 */
export function MapaChile({
  puntos,
  seleccion,
  onSeleccion,
  alto = 520,
  latSur = -44.5,
  radioMax = 26,
  anchoEtiquetas = 170,
  divisor = 1000,
}: {
  puntos: PuntoMapa[];
  seleccion?: string | null;
  onSeleccion?: (clave: string) => void;
  alto?: number;
  latSur?: number;
  radioMax?: number;
  anchoEtiquetas?: number;
  divisor?: number;
}) {
  const escala = alto / (LAT_NORTE - latSur);
  const anchoMapa = (LON_ESTE - LON_OESTE) * COS * escala;
  const { caminos, error } = useRegiones(escala, latSur);
  const x = (lon: number) => (lon - LON_OESTE) * COS * escala;
  const y = (lat: number) => (LAT_NORTE - lat) * escala;
  const max = Math.max(...puntos.map((p) => p.valor), 1);

  // Etiquetas en columna: se ordenan por latitud y se separan lo que ocupa una etiqueta.
  const separacion = puntos.some((p) => p.detalle) ? 36 : 26;
  const etiquetas = [...puntos]
    .filter((p) => p.valor > 0)
    .sort((a, b) => b.lat - a.lat)
    .reduce<{ p: PuntoMapa; ey: number }[]>((acc, p) => {
      const previa = acc[acc.length - 1];
      acc.push({ p, ey: Math.max(y(p.lat), previa ? previa.ey + separacion : 10) });
      return acc;
    }, []);
  const ancho = anchoMapa + anchoEtiquetas + 16;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full h-auto max-h-full" role="img" aria-label="Mapa de Chile con la venta por ciudad">
        <g>
          {caminos.map((d, i) => (
            <path key={i} d={d} fill="var(--color-surface-2)" stroke="var(--color-border-strong)" strokeWidth={0.8} />
          ))}
        </g>
        {etiquetas.map(({ p, ey }) => {
          const cx = x(p.lon);
          const cy = y(p.lat);
          const r = 4 + Math.sqrt(p.valor / max) * radioMax;
          const color = p.color ?? "var(--color-serie-1)";
          const apagado = !!seleccion && seleccion !== p.clave;
          const lx = anchoMapa + 16;
          return (
            <g key={p.clave} opacity={apagado ? 0.28 : 1} className="transition-opacity">
              <path d={`M${cx + r} ${cy} C${lx - 20} ${cy}, ${lx - 30} ${ey}, ${lx - 4} ${ey}`} fill="none" stroke="var(--color-border-strong)" strokeWidth={1} />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                fillOpacity={seleccion === p.clave ? 0.45 : 0.18}
                stroke={color}
                strokeWidth={1.8}
                className={cn(onSeleccion && "cursor-pointer")}
                onClick={onSeleccion ? () => onSeleccion(p.clave) : undefined}
              >
                <title>{`${p.nombre}: ${cifra(p.valor / divisor)}`}</title>
              </circle>
              <circle cx={cx} cy={cy} r={2.2} fill="var(--color-text)" pointerEvents="none" />
              <text x={lx} y={ey - 1} fill="var(--color-text)" fontSize={12.5} fontWeight={700}>
                {p.nombre}
              </text>
              {p.detalle && (
                <text x={lx} y={ey + 13} fill="var(--color-muted)" fontSize={11}>
                  {p.detalle}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {error && <p className="absolute top-2 left-2 text-xs text-faint">No se pudo cargar el contorno del mapa.</p>}
    </div>
  );
}

/**
 * Variante «de norte a sur»: Chile angosto a la izquierda y una barra por ciudad a la derecha,
 * cada una unida a su latitud. Útil cuando importa comparar montos más que ubicar.
 */
export function MapaLatitud({
  puntos,
  seleccion,
  onSeleccion,
  alto = 470,
  latSur = -43,
  divisor = 1000,
}: {
  puntos: PuntoMapa[];
  seleccion?: string | null;
  onSeleccion?: (clave: string) => void;
  alto?: number;
  latSur?: number;
  divisor?: number;
}) {
  const escala = alto / (LAT_NORTE - latSur);
  const anchoMapa = (LON_ESTE - LON_OESTE) * COS * escala;
  const { caminos } = useRegiones(escala, latSur);
  const x = (lon: number) => (lon - LON_OESTE) * COS * escala;
  const y = (lat: number) => (LAT_NORTE - lat) * escala;
  const orden = [...puntos].sort((a, b) => b.lat - a.lat);
  const max = Math.max(...orden.map((p) => p.valor), 1);
  const paso = (alto - 20) / Math.max(orden.length, 1);
  const xNombre = anchoMapa + 40;
  const xBarra = xNombre + 110;
  const anchoBarra = 300;

  return (
    <svg viewBox={`0 0 ${xBarra + anchoBarra + 70} ${alto}`} className="w-full h-auto" role="img" aria-label="Venta por ciudad de norte a sur">
      {caminos.map((d, i) => (
        <path key={i} d={d} fill="var(--color-surface-2)" stroke="var(--color-border-strong)" strokeWidth={0.8} />
      ))}
      {orden.map((p, i) => {
        const fy = 18 + i * paso + paso / 2 - 9;
        const apagado = !!seleccion && seleccion !== p.clave;
        const ancho = Math.max((p.valor / max) * anchoBarra, 3);
        return (
          <g
            key={p.clave}
            opacity={apagado ? 0.3 : 1}
            className={cn("transition-opacity", onSeleccion && "cursor-pointer")}
            onClick={onSeleccion ? () => onSeleccion(p.clave) : undefined}
          >
            <line x1={x(p.lon)} y1={y(p.lat)} x2={xNombre - 8} y2={fy} stroke="var(--color-border-strong)" strokeWidth={1} />
            <circle cx={x(p.lon)} cy={y(p.lat)} r={3.2} fill="var(--color-text)" />
            <text x={xNombre} y={fy + 4} fill="var(--color-text)" fontSize={12.5} fontWeight={600}>
              {p.nombre}
            </text>
            <rect x={xBarra} y={fy - 9} width={ancho} height={18} rx={5} fill={p.color ?? "var(--color-serie-1)"} />
            <text x={xBarra + ancho + 8} y={fy + 4} fill="var(--color-text)" fontSize={12.5} fontWeight={800}>
              {cifra(p.valor / divisor)}
            </text>
            <title>{`${p.nombre}: ${cifra(p.valor / divisor)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
