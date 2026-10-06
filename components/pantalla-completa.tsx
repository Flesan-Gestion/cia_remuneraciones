"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

interface ValorPantallaCompleta {
  activa: boolean;
  alternar: () => void;
}

const Contexto = createContext<ValorPantallaCompleta | null>(null);

/**
 * Modo pantalla completa para reportería: pide al navegador pantalla completa (se van sus
 * barras) y el AppShell oculta el sidebar. Esc, o salir desde el navegador, lo desactiva
 * (se escucha `fullscreenchange`). Si el navegador no soporta la API (ej. iPhone), igual se
 * oculta el sidebar para ganar espacio.
 */
export function PantallaCompletaProvider({ children }: { children: ReactNode }) {
  const [activa, setActiva] = useState(false);

  useEffect(() => {
    const alCambiar = () => setActiva(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

  // Sin pantalla completa del navegador, Esc también devuelve el sidebar (con ella, el propio
  // navegador sale y avisa por fullscreenchange).
  useEffect(() => {
    if (!activa) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setActiva(false);
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [activa]);

  const alternar = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => setActiva(false));
      return;
    }
    // Activo sin pantalla completa del navegador (no la soporta o la rechazó): solo se
    // vuelve a mostrar el sidebar.
    if (activa) {
      setActiva(false);
      return;
    }
    if (typeof document.documentElement.requestFullscreen !== "function") {
      setActiva(true);
      return;
    }
    // Si el navegador lo rechaza, al menos se oculta el sidebar.
    document.documentElement.requestFullscreen().catch(() => setActiva(true));
  }, [activa]);

  return <Contexto.Provider value={{ activa, alternar }}>{children}</Contexto.Provider>;
}

export function usePantallaCompleta(): ValorPantallaCompleta {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("usePantallaCompleta debe usarse dentro de PantallaCompletaProvider");
  return ctx;
}

/** Botón de la barra superior para entrar y salir de pantalla completa. */
export function BotonPantallaCompleta() {
  const { activa, alternar } = usePantallaCompleta();
  const texto = activa ? "Salir de pantalla completa (Esc)" : "Pantalla completa";
  const Icono = activa ? Minimize2 : Maximize2;
  return (
    <button
      data-tutorial="pantalla-completa"
      type="button"
      onClick={alternar}
      title={texto}
      aria-label={texto}
      aria-pressed={activa}
      className="flex items-center justify-center w-8 h-8 shrink-0 rounded-flesan-sm text-muted hover:text-text hover:bg-bg cursor-pointer transition-colors"
    >
      <Icono className="w-4 h-4" />
    </button>
  );
}
