"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { esAdmin } from "@/lib/roles";
import { useUsuarioActual } from "@/components/user-context";
import { CADA_HORAS, actualizarDatos, obtenerEstadoDatos } from "@/lib/estado-datos";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatearHora(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** «27 sep» */
function formatearDia(d: Date) {
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** «27 sep 2026, 06:00» */
function formatearCompleta(d: Date) {
  return `${formatearDia(d)} ${d.getFullYear()}, ${formatearHora(d)}`;
}

const HORA_MS = 3_600_000;
/** Cuánto dura el «recién» tras actualizar. */
const RECIEN_MS = 60_000;
/** Mínimo que se muestra «Actualizando…», para que el cambio se alcance a percibir. */
const MINIMO_MS = 900;

/**
 * Indicador de frescura de los datos (barra superior): un punto verde «Al día» o ámbar
 * «Atrasado» si pasó más de `CADA_HORAS` desde la última actualización, con el botón de
 * actualizar al costado. Atrasado, al pasar el mouse explica cuánto lleva y ofrece actualizar.
 */
// SHELL · indicador de la barra superior (igual en todas las plataformas). La fuente de la fecha
// y la frecuencia esperada son de cada plataforma: lib/estado-datos.ts.
/** Detalle de las cargas (solo administradores: la página vive en el grupo (admin)). */
const RUTA_DETALLE = "/configuracion/fuentes-datos";

export function EstadoDatos() {
  const router = useRouter();
  const verDetalle = esAdmin(useUsuarioActual()?.role);
  const [actualizadoEn, setActualizadoEn] = useState<Date | null>(null);
  // null: aún cargando; false: la plataforma no informa estado de datos (no se muestra nada).
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [recien, setRecien] = useState(false);
  const [, startTransition] = useTransition();
  // Re-render periódico para que «atrasado» y «hace N horas» se mantengan al día.
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    obtenerEstadoDatos().then((e) => {
      setDisponible(Boolean(e));
      if (e) setActualizadoEn(e.actualizadoEn);
    });
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!recien) return;
    const t = setTimeout(() => setRecien(false), RECIEN_MS);
    return () => clearTimeout(t);
  }, [recien]);

  async function actualizar() {
    if (actualizando) return;
    setActualizando(true);
    const inicio = Date.now();
    // La plataforma primero trae datos nuevos de su fuente (ej. descarta una caché); después se
    // vuelve a dibujar la vista con ellos.
    await actualizarDatos();
    startTransition(() => router.refresh());
    const estado = await obtenerEstadoDatos();
    await new Promise((r) => setTimeout(r, Math.max(0, MINIMO_MS - (Date.now() - inicio))));
    // En el mockup la fuente no cambia: se toma la hora de la actualización como nueva fecha.
    setActualizadoEn(new Date(Math.max(estado?.actualizadoEn.getTime() ?? 0, Date.now())));
    setAhora(Date.now());
    setRecien(true);
    setActualizando(false);
  }

  if (disponible === false) return null;
  // Antes de montar no hay fecha (depende del reloj del navegador): se reserva el espacio.
  if (!actualizadoEn) return <div className="skeleton h-[1.875rem] w-32 rounded-full" aria-hidden />;

  const horas = (ahora - actualizadoEn.getTime()) / HORA_MS;
  const atrasado = !actualizando && horas > CADA_HORAS;
  const esHoy = new Date(ahora).toDateString() === actualizadoEn.toDateString();
  const cuando = esHoy ? formatearHora(actualizadoEn) : formatearDia(actualizadoEn);

  return (
    <div data-tutorial="estado-datos" className={cn("estado-datos group relative", atrasado && "is-atrasado")}>
      <div
        className="estado-datos-pildora flex items-center h-[1.875rem] rounded-full border overflow-hidden"
        title={atrasado ? undefined : `Datos al ${formatearCompleta(actualizadoEn)}`}
      >
        <TextoEstado verDetalle={verDetalle}>
          <span
            className={cn("estado-datos-punto w-2 h-2 rounded-full shrink-0", actualizando && "is-actualizando")}
            aria-hidden
          />
          {actualizando ? (
            "Actualizando…"
          ) : atrasado ? (
            <>
              Atrasado <span className="opacity-80 font-normal">· {cuando}</span>
            </>
          ) : (
            <>
              Al día{" "}
              <span className="estado-datos-suave font-normal">
                · {recien ? `recién, ${formatearHora(actualizadoEn)}` : cuando}
              </span>
            </>
          )}
        </TextoEstado>
        <button
          type="button"
          onClick={actualizar}
          disabled={actualizando}
          aria-label={actualizando ? "Actualizando datos" : "Actualizar datos"}
          title={actualizando ? undefined : "Actualizar datos"}
          className="estado-datos-boton flex items-center justify-center self-stretch w-[1.875rem] border-l cursor-pointer disabled:cursor-default"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", actualizando && "animate-spin")} />
        </button>
      </div>

      {/* Detalle del atraso: al pasar el mouse o al llegar con el teclado */}
      {atrasado && (
        <div
          role="tooltip"
          className="absolute right-0 top-full pt-2 z-50 hidden group-hover:block group-focus-within:block"
        >
          <div className="w-64 rounded-flesan border border-border bg-surface shadow-lg px-3.5 py-3 flex flex-col gap-2 text-xs leading-relaxed text-muted">
            <span>
              Los datos son del <b className="font-semibold text-text">{formatearCompleta(actualizadoEn)}</b>, hace{" "}
              {Math.round(horas)} horas. Se esperan cada {CADA_HORAS} horas.
            </span>
            <button
              type="button"
              onClick={actualizar}
              className="self-start font-label text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-flesan-red dark:text-flesan-red-light hover:underline cursor-pointer"
            >
              Actualizar ahora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** El texto de la píldora: para un administrador, enlace al detalle de las cargas. */
function TextoEstado({ verDetalle, children }: { verDetalle: boolean; children: React.ReactNode }) {
  const clases = "flex items-center gap-2 pl-3 pr-2.5 text-xs font-medium whitespace-nowrap";
  return verDetalle ? (
    <Link href={RUTA_DETALLE} aria-live="polite" title="Ver el detalle en Fuentes de datos" className={cn(clases, "self-stretch hover:underline underline-offset-2")}>
      {children}
    </Link>
  ) : (
    <span aria-live="polite" className={clases}>
      {children}
    </span>
  );
}
