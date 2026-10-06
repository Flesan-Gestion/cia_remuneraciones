"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Encabezado estándar de cada vista: título en una línea, la descripción detrás de un
 * ícono (i) y las acciones de la vista a la derecha. Mantiene la descripción disponible
 * sin empujar el contenido hacia abajo. La descripción se abre al pasar el mouse, con
 * foco de teclado o con un clic (táctil); Esc la cierra.
 */
interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div data-page-header className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 mb-6", className)}>
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="display-title text-2xl sm:text-3xl text-text">{title}</h1>
        {description && <InfoPopover label={`Acerca de ${title}`}>{description}</InfoPopover>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function InfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  // Cierra al hacer clic fuera o con Esc cuando quedó abierto por clic.
  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTecla);
    };
  }, [abierto]);

  return (
    <div ref={ref} className="relative group">
      <button
        type="button"
        aria-label={label}
        aria-expanded={abierto}
        aria-describedby={id}
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center justify-center w-7 h-7 rounded-full text-faint hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <Info className="w-4 h-4" />
      </button>
      <div
        id={id}
        role="tooltip"
        className={cn(
          "absolute left-0 top-full mt-2 z-30 w-[22rem] max-w-[calc(100vw-2rem)] card p-4 shadow-lg",
          "font-body text-sm text-muted leading-relaxed",
          // hidden (no invisible): invisible igual ocupa espacio y, en móvil, el globo de 22rem
          // desbordaba la página hacia la derecha (scroll horizontal).
          "hidden animate-fade-in",
          "group-hover:block group-has-[:focus-visible]:block",
          abierto && "block",
        )}
      >
        {children}
      </div>
    </div>
  );
}
