"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Botón «Excel» para el encabezado de una tabla. Recibe la función que arma y descarga el
 * archivo (normalmente `descargarExcel` de lib/exportar/excel.ts con las filas visibles).
 */
export function BotonExcel({ onDescargar, className }: { onDescargar: () => Promise<void>; className?: string }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(false);

  async function descargar() {
    setGenerando(true);
    setError(false);
    try {
      await onDescargar();
    } catch (e) {
      console.error("[excel]", e);
      setError(true);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <button
      type="button"
      data-no-diapositiva
      onClick={descargar}
      disabled={generando}
      title={error ? "No se pudo generar el Excel. Intenta de nuevo." : "Descargar lo que se ve en Excel"}
      className={cn(
        "flex items-center gap-1.5 h-8 px-2.5 border border-border-strong rounded-flesan-sm font-label text-[0.6875rem] font-semibold tracking-[0.08em] uppercase text-muted hover:text-text hover:border-text transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait",
        error && "border-status-down text-status-down",
        className,
      )}
    >
      {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-status-ok" />}
      Excel
    </button>
  );
}
