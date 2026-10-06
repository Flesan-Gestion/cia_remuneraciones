"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Antes de montar no se conoce el tema: se reserva el mismo alto/ancho de la
  // pastilla para que no haya salto de layout.
  if (!mounted) {
    return (
      <span className="toggle-pill" aria-hidden>
        <span className="toggle-pill-option" />
        <span className="toggle-pill-option" />
      </span>
    );
  }

  // Cualquiera de los dos íconos alterna el tema, no solo el inactivo.
  const alternar = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <div className="toggle-pill">
      <button
        type="button"
        onClick={alternar}
        title="Tema claro"
        aria-label="Tema claro"
        aria-pressed={resolvedTheme === "light"}
        className={`toggle-pill-option ${resolvedTheme === "light" ? "is-active" : ""}`}
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={alternar}
        title="Tema oscuro"
        aria-label="Tema oscuro"
        aria-pressed={resolvedTheme === "dark"}
        className={`toggle-pill-option ${resolvedTheme === "dark" ? "is-active" : ""}`}
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Botón de solo ícono para la barra superior (mismo estilo que pantalla completa): muestra la
 * luna en claro y el sol en oscuro, y alterna el tema. */
export function BotonTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const oscuro = mounted && resolvedTheme === "dark";
  const texto = oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  const Icono = oscuro ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(oscuro ? "light" : "dark")}
      title={mounted ? texto : undefined}
      aria-label={mounted ? texto : "Cambiar tema"}
      className="flex items-center justify-center w-8 h-8 shrink-0 rounded-flesan-sm text-muted hover:text-text hover:bg-bg cursor-pointer transition-colors"
    >
      {mounted ? <Icono className="w-4 h-4" /> : <span className="w-4 h-4" aria-hidden />}
    </button>
  );
}
