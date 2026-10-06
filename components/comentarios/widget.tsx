"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Minus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CiaLogo } from "@/components/cia-logo";
import { usePreferencias } from "@/components/preferencias";
import { PanelComentarios, useMisComentarios } from "@/components/comentarios/panel";

// SHELL · botón de comentarios para el equipo CIA, en la forma que el usuario eligió en
// Mi personalización (por defecto, la burbuja):
// - «burbuja»: círculo chico abajo a la derecha; se minimiza a una media luna en el borde.
// - «pestana»: pestaña oscura a media altura del borde derecho; se esconde en una línea roja.
// - «barra»: nada flotante; un ícono en la barra superior (BotonComentariosBarra).
// Reemplaza al <cia-feedback> central dentro del dashboard; usa las mismas APIs.

function useAbierto() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);
  return [abierto, setAbierto] as const;
}

/** Formas flotantes (burbuja y pestaña). Se monta una vez en el AppShell. */
export function WidgetCia() {
  const [pref, cambiar] = usePreferencias();
  const [abierto, setAbierto] = useAbierto();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  // Las preferencias viven en el navegador: antes de montar no se sabe qué forma dibujar.
  if (!montado || pref.widgetCia === "barra") return null;

  const minimizado = pref.widgetMinimizado && !abierto;
  const minimizar = () => {
    setAbierto(false);
    cambiar({ widgetMinimizado: true });
  };
  const restaurar = () => cambiar({ widgetMinimizado: false });

  if (pref.widgetCia === "pestana") {
    return (
      <>
        {minimizado ? (
          <button
            type="button"
            onClick={restaurar}
            aria-label="Mostrar comentarios CIA"
            title="Comentarios CIA"
            data-tutorial="buzon"
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 w-[5px] h-14 rounded-l-sm bg-flesan-red hover:w-2.5 transition-[width] cursor-pointer"
          />
        ) : (
          !abierto && (
            <div data-tutorial="buzon" className="group fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={minimizar}
                aria-label="Esconder comentarios CIA"
                title="Esconder"
                className="mr-1 w-5 h-5 rounded-full bg-surface border border-border-strong text-muted hover:text-text flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setAbierto(true)}
                aria-label="Comentarios para el equipo CIA"
                aria-expanded={false}
                className="w-[1.875rem] h-28 rounded-l-lg bg-flesan-black text-white flex flex-col items-center justify-center gap-2 shadow-md cursor-pointer dark:bg-surface-2 dark:border dark:border-r-0 dark:border-border-strong"
              >
                <CiaLogo className="w-3.5 h-3.5" />
                <span className="[writing-mode:vertical-rl] rotate-180 font-label text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
                  Comentarios
                </span>
              </button>
            </div>
          )
        )}
        {abierto && (
          <PanelComentarios
            onCerrar={() => setAbierto(false)}
            onMinimizar={minimizar}
            className="panel-comentarios-lateral fixed right-0 inset-y-0 z-50 w-[22rem] max-w-[100vw] border-y-0 border-r-0"
          />
        )}
      </>
    );
  }

  // Burbuja (por defecto)
  return (
    <>
      {minimizado ? (
        <button
          type="button"
          onClick={restaurar}
          aria-label="Mostrar comentarios CIA"
          title="Comentarios CIA"
          data-tutorial="buzon"
          className="fixed right-0 bottom-7 z-40 w-3.5 h-7 rounded-l-full bg-surface border border-r-0 border-border-strong flex items-center justify-end pr-0.5 shadow-sm cursor-pointer hover:w-4 transition-[width]"
        >
          <span className="w-2 h-2 rounded-full bg-flesan-red" aria-hidden />
        </button>
      ) : (
        <div data-tutorial="buzon" className="group fixed right-5 bottom-5 z-40">
          {!abierto && (
            <>
              <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-flesan-sm bg-flesan-black text-white text-xs px-2.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Comentarios para la CIA
              </span>
              <button
                type="button"
                onClick={minimizar}
                aria-label="Minimizar comentarios CIA"
                title="Minimizar"
                className="absolute -left-2 -top-2 w-5 h-5 rounded-full bg-surface border border-border-strong text-muted hover:text-text flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label={abierto ? "Cerrar comentarios" : "Comentarios para el equipo CIA"}
            aria-expanded={abierto}
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center shadow-md cursor-pointer transition-colors",
              abierto
                ? "bg-flesan-black border-flesan-black text-white dark:bg-surface-2 dark:border-border-strong"
                : "bg-surface border-border-strong text-flesan-red hover:border-flesan-red",
            )}
          >
            {abierto ? <X className="w-4 h-4" /> : <CiaLogo className="w-[1.125rem] h-[1.125rem]" />}
          </button>
        </div>
      )}
      {abierto && (
        <PanelComentarios
          onCerrar={() => setAbierto(false)}
          onMinimizar={minimizar}
          className="fixed right-5 bottom-[4.25rem] z-50 w-80 max-w-[calc(100vw-2.5rem)] max-h-[min(34rem,calc(100vh-6rem))] rounded-flesan animate-fade-in"
        />
      )}
    </>
  );
}

const CLAVE_VISTO = "cia-comentarios-visto";

/** Forma «barra»: ícono en la barra superior con un punto cuando cambió el estado de algún
 * mensaje propio desde la última vez que se abrió. */
export function BotonComentariosBarra() {
  const [pref] = usePreferencias();
  const [abierto, setAbierto] = useAbierto();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const activo = montado && pref.widgetCia === "barra";
  const { datos } = useMisComentarios(activo);
  const [visto, setVisto] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setVisto(localStorage.getItem(CLAVE_VISTO));
    } catch {}
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => raiz.current && !raiz.current.contains(e.target as Node) && setAbierto(false);
    document.addEventListener("mousedown", alClic);
    return () => document.removeEventListener("mousedown", alClic);
  }, [abierto, setAbierto]);

  const firma = Array.isArray(datos) ? datos.map((c) => `${c.id}:${c.estado}`).join(",") : null;
  // Primera vez (sin registro previo) no se marca nada: solo cambios posteriores.
  const hayNovedad = firma !== null && visto !== null && firma !== visto;

  // Primera vez (sin registro previo): se guarda la firma actual como vista.
  useEffect(() => {
    if (firma === null || visto !== null) return;
    try {
      localStorage.setItem(CLAVE_VISTO, firma);
    } catch {}
    setVisto(firma);
  }, [firma, visto]);

  if (!activo) return null;

  function alternar() {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente && firma !== null) {
      try {
        localStorage.setItem(CLAVE_VISTO, firma);
      } catch {}
      setVisto(firma);
    }
  }
  return (
    <div ref={raiz} data-tutorial="buzon" className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label={hayNovedad ? "Comentarios para el equipo CIA (hay novedades)" : "Comentarios para el equipo CIA"}
        title="Comentarios CIA"
        aria-expanded={abierto}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 shrink-0 rounded-flesan-sm text-muted hover:text-text hover:bg-bg cursor-pointer transition-colors",
          abierto && "text-text bg-bg",
        )}
      >
        <MessageSquare className="w-4 h-4" />
        {hayNovedad && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-flesan-red ring-2 ring-surface" aria-hidden />}
      </button>
      {abierto && (
        <PanelComentarios
          onCerrar={() => setAbierto(false)}
          className="absolute right-0 top-10 z-50 w-80 max-h-[min(34rem,calc(100vh-5rem))] rounded-flesan animate-fade-in"
        />
      )}
    </div>
  );
}
