"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CheckCheck, FlaskConical } from "lucide-react";
import { cn } from "@/lib/cn";
import { useUsuarioActual } from "@/components/user-context";
import { FilaNotificacion, hayNotificaciones, useNotificaciones } from "./comun";

/**
 * SHELL · campanita de la barra superior (opción A, lista simple): contador de no leídas y
 * panel con las últimas 10, primero las no leídas. El historial y los filtros están en la
 * bandeja (/notificaciones). Solo aparece con sesión y si la plataforma declara tipos en
 * lib/notificaciones-plataforma.ts: sin usuario no hay a quién notificar.
 */
export function Campanita() {
  const usuario = useUsuarioActual();
  if (!hayNotificaciones || !usuario?.email) return null;
  return <CampanitaActiva />;
}

function CampanitaActiva() {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const { notificaciones, noLeidas, ejemplo, marcar } = useNotificaciones(10);
  const ordenadas = [...notificaciones].sort((a, b) => Number(!!a.leidaEn) - Number(!!b.leidaEn));

  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClic);
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  return (
    <div ref={raiz} data-tutorial="campanita" className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Notificaciones"
        aria-label={noLeidas > 0 ? `Notificaciones (${noLeidas} sin leer)` : "Notificaciones"}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        className={cn(
          "relative flex items-center justify-center w-8 h-8 shrink-0 rounded-flesan-sm cursor-pointer transition-colors",
          abierto ? "bg-bg text-text" : "text-muted hover:text-text hover:bg-bg",
        )}
      >
        <Bell className="w-4 h-4" />
        {noLeidas > 0 && (
          <span className="absolute top-0 right-0 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-flesan-red text-white text-[0.625rem] font-bold leading-none ring-2 ring-surface">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 top-full mt-2 z-50 w-[min(24rem,calc(100vw-1.5rem))] max-h-[min(34rem,75vh)] flex flex-col rounded-2xl border border-border bg-surface shadow-xl animate-fade-in"
        >
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 shrink-0">
            <h2 className="text-sm font-bold text-text">Notificaciones</h2>
            {noLeidas > 0 && (
              <span className="text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full bg-flesan-red/10 text-flesan-red">
                {noLeidas} nueva{noLeidas === 1 ? "" : "s"}
              </span>
            )}
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={() => marcar({ todas: true })}
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-flesan-red cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden />
                Marcar todo leído
              </button>
            )}
          </div>

          <div className="overflow-y-auto px-1.5 pb-1.5 flex flex-col gap-0.5">
            {ordenadas.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell className="w-6 h-6 text-faint" aria-hidden />
                <p className="text-[0.8125rem] text-muted">No tienes notificaciones.</p>
              </div>
            ) : (
              ordenadas.map((n) => <FilaNotificacion key={n.id} n={n} onMarcar={() => marcar({ ids: [n.id] })} onAbrir={() => setAbierto(false)} />)
            )}
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border shrink-0">
            {ejemplo && (
              <span className="inline-flex items-center gap-1 text-[0.6875rem] text-faint" title="La plataforma aún no tiene la tabla de notificaciones (db/003_notificaciones.sql).">
                <FlaskConical className="w-3 h-3" aria-hidden />
                Datos de ejemplo
              </span>
            )}
            <Link
              href="/notificaciones"
              onClick={() => setAbierto(false)}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-flesan-red"
            >
              Ver todas en la bandeja
              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
