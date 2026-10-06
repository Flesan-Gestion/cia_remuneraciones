"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CiaLogo } from "@/components/cia-logo";
import { PORTAL_CIA_URL, SAP_WORKZONE_URL } from "@/lib/nav-base";

/** Hay al menos un portal configurado. */
export const HAY_PORTALES = Boolean(PORTAL_CIA_URL || SAP_WORKZONE_URL);

/** Cierra el desplegable con clic fuera de `raiz` o con Esc. */
export function useCierreFuera(abierto: boolean, raiz: RefObject<HTMLElement | null>, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => raiz.current && !raiz.current.contains(e.target as Node) && cerrar();
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto, raiz, cerrar]);
}

/**
 * Desplegable de portales, común a todos los estilos del acceso (lengüeta, burbuja, etc.): panel
 * negro del ecosistema del Portal CIA con las tarjetas de Portal CIA y SAP Work Zone. Cada estilo
 * lo posiciona con `className` / `style`.
 */
export function PanelPortales({
  onCerrar,
  className,
  style,
  panelRef,
}: {
  onCerrar: () => void;
  className?: string;
  style?: React.CSSProperties;
  panelRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Abrir portales"
      className={cn("panel-portales absolute w-80 rounded-2xl overflow-hidden text-white", className)}
      style={style}
    >
      <div className="flex items-center px-4 pt-3.5 pb-2">
        <span className="font-label text-[0.6875rem] font-semibold tracking-[0.14em] uppercase text-white/60">Abrir portales</span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto text-white/60 hover:text-white cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="relative px-3 pb-3 flex flex-col gap-2.5">
        {PORTAL_CIA_URL && (
          <Portal href={PORTAL_CIA_URL} nombre="Portal CIA" detalle="Aplicativos y desafíos de la CIA" color="#ff3a3a">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[rgba(227,6,19,0.15)] ring-1 ring-inset ring-[rgba(227,6,19,0.5)]">
              <CiaLogo className="w-6 h-6 text-[#ff3a3a]" />
            </span>
          </Portal>
        )}
        {/* Línea punteada que une los dos mundos, como en el mapa del ecosistema: va de un ícono al
            otro sin importar el alto de las tarjetas (ocupa el espacio entre ellas y lo compensa). */}
        {PORTAL_CIA_URL && SAP_WORKZONE_URL && (
          <span className="relative z-10 ml-[2.125rem] -my-[1.4375rem] h-9 border-l-2 border-dashed border-white/25" aria-hidden />
        )}
        {SAP_WORKZONE_URL && (
          <Portal href={SAP_WORKZONE_URL} nombre="SAP Work Zone" detalle="Noticias, comunicaciones y trámites" color="#00aeef">
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(180deg, #00aeef, #007cc5 52%, #0066b3)" }}
            >
              <span className="text-[0.75rem] font-bold text-white" style={{ fontFamily: "Arial, sans-serif" }}>
                SAP
              </span>
            </span>
          </Portal>
        )}
      </div>
    </div>
  );
}

function Portal({
  href,
  nombre,
  detalle,
  color,
  children,
}: {
  href: string;
  nombre: string;
  detalle: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      role="menuitem"
      className="relative flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:translate-x-0.5 transition-all"
    >
      {children}
      <span className="flex flex-col min-w-0">
        <span className="text-[0.9375rem] font-semibold">{nombre}</span>
        <span className="text-xs text-white/60">{detalle}</span>
      </span>
      <ArrowUpRight className="w-4 h-4 ml-auto shrink-0" style={{ color }} />
    </a>
  );
}

/** Logo SAP (trapecio con la sigla). Colores por clase de relleno para adaptarlo a cada estilo. */
export function LogoSap({ className, fondo, texto }: { className?: string; fondo: string; texto: string }) {
  return (
    <svg viewBox="0 0 400 198" aria-hidden className={className}>
      <path d="M0 198V0h400L202 198z" className={fondo} />
      <text x="32" y="142" className={texto} fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="128" letterSpacing="-4">
        SAP
      </text>
    </svg>
  );
}
