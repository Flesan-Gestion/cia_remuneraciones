"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Minus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CiaLogo } from "@/components/cia-logo";

// SHELL · panel de comentarios para el equipo CIA (Centro de Inteligencia Analítica). Lo usan
// las tres formas del widget (components/comentarios/widget.tsx). Envía por /api/feedback y lee
// el historial propio por /api/feedback/mios: los dos BFF que ya consultan el servicio central.

export interface Comentario {
  id: number;
  tipo: "sugerencia" | "bug" | "otro";
  mensaje: string;
  estado: "nuevo" | "en_revision" | "resuelto" | "descartado";
  created_at: string;
}

const MAX = 2000;
const TIPOS: { valor: Comentario["tipo"]; texto: string }[] = [
  { valor: "sugerencia", texto: "Idea" },
  { valor: "bug", texto: "Algo no funciona" },
  { valor: "otro", texto: "Otro" },
];
export const ESTADO_COMENTARIO: Record<Comentario["estado"], { texto: string; punto: string }> = {
  nuevo: { texto: "Recibido", punto: "bg-faint" },
  en_revision: { texto: "En revisión", punto: "bg-status-warn" },
  resuelto: { texto: "Resuelto", punto: "bg-status-ok" },
  descartado: { texto: "Descartado", punto: "bg-border-strong" },
};
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fechaCorta(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Historial propio: null mientras carga, "error" si el servicio no responde. */
export function useMisComentarios(activo = true) {
  const [datos, setDatos] = useState<Comentario[] | "error" | null>(null);
  const recargar = useCallback(() => {
    fetch("/api/feedback/mios")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setDatos(Array.isArray(d) ? [...d].sort((a, b) => b.created_at.localeCompare(a.created_at)) : []))
      .catch(() => setDatos("error"));
  }, []);
  useEffect(() => {
    if (activo) recargar();
  }, [activo, recargar]);
  return { datos, recargar };
}

export function PanelComentarios({
  onCerrar,
  onMinimizar,
  className,
}: {
  onCerrar: () => void;
  onMinimizar?: () => void;
  className?: string;
}) {
  const [pestana, setPestana] = useState<"enviar" | "mios">("enviar");
  const [tipo, setTipo] = useState<Comentario["tipo"]>("sugerencia");
  const [mensaje, setMensaje] = useState("");
  const [envio, setEnvio] = useState<"listo" | "enviando" | "enviado" | "error">("listo");
  const { datos, recargar } = useMisComentarios();

  async function enviar() {
    if (!mensaje.trim() || envio === "enviando") return;
    setEnvio("enviando");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: mensaje.trim(), tipo, url_origen: window.location.href }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setMensaje("");
      setEnvio("enviado");
      recargar();
    } catch {
      setEnvio("error");
    }
  }

  const cantidad = Array.isArray(datos) ? datos.length : 0;

  return (
    <section
      role="dialog"
      aria-label="Comentarios para el equipo CIA"
      className={cn("bg-surface border border-border shadow-lg flex flex-col text-text overflow-hidden", className)}
    >
      <header className="flex items-center gap-2.5 px-4 py-3">
        <span className="w-8 h-8 shrink-0 rounded-flesan-sm bg-flesan-black text-white flex items-center justify-center dark:bg-surface-2">
          <CiaLogo className="w-4 h-4" />
        </span>
        <span className="flex flex-col leading-tight min-w-0">
          <span className="text-sm font-semibold">Comentarios</span>
          <span className="text-[0.6875rem] text-muted truncate">Centro de Inteligencia Analítica · CIA</span>
        </span>
        <span className="ml-auto flex items-center">
          {onMinimizar && (
            <button type="button" onClick={onMinimizar} aria-label="Minimizar" title="Minimizar" className="w-7 h-7 flex items-center justify-center rounded-flesan-sm text-muted hover:text-text hover:bg-bg cursor-pointer">
              <Minus className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="w-7 h-7 flex items-center justify-center rounded-flesan-sm text-muted hover:text-text hover:bg-bg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </span>
      </header>

      <div className="flex gap-4 px-4 border-b border-border" role="tablist">
        {(
          [
            ["enviar", "Enviar"],
            ["mios", `Mis mensajes${cantidad ? ` · ${cantidad}` : ""}`],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={cn(
              "py-2.5 text-[0.8125rem] border-b-2 -mb-px cursor-pointer",
              pestana === id ? "border-flesan-red text-text font-semibold" : "border-transparent text-muted hover:text-text",
            )}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === "enviar" ? (
        <div className="flex flex-col gap-3 p-4 flex-1 min-h-0">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de mensaje">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={tipo === t.valor}
                onClick={() => setTipo(t.valor)}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs cursor-pointer transition-colors",
                  tipo === t.valor ? "border-text bg-bg text-text" : "border-border-strong text-muted hover:text-text",
                )}
              >
                {t.texto}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">Mensaje</span>
            <textarea
              value={mensaje}
              maxLength={MAX}
              rows={5}
              onChange={(e) => {
                setMensaje(e.target.value);
                if (envio !== "enviando") setEnvio("listo");
              }}
              placeholder="Cuéntanos qué mejorarías o qué viste raro…"
              className="field-input resize-none h-auto py-2"
            />
          </label>
          <div className="flex items-center gap-3">
            <span className="text-[0.6875rem] text-muted" aria-live="polite">
              {envio === "enviado"
                ? "Enviado. Gracias: lo verás en «Mis mensajes»."
                : envio === "error"
                  ? "No se pudo enviar. Intenta de nuevo."
                  : `${mensaje.length} / ${MAX}`}
            </span>
            <button
              type="button"
              onClick={enviar}
              disabled={!mensaje.trim() || envio === "enviando"}
              className="btn-flesan btn-flesan-primary btn-flesan-sm ml-auto disabled:opacity-50"
            >
              {envio === "enviando" ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {datos === null ? (
            <div className="p-4">
              <div className="skeleton h-24 rounded-flesan" />
            </div>
          ) : datos === "error" ? (
            <p className="p-4 text-sm text-muted">No se pudo consultar tus mensajes en este momento.</p>
          ) : !datos.length ? (
            <p className="p-4 text-sm text-muted">Aún no has enviado mensajes.</p>
          ) : (
            <ul className="divide-y divide-border">
              {datos.slice(0, 20).map((c) => (
                <li key={c.id} className="px-4 py-3 flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-[0.6875rem] text-muted">
                    {fechaCorta(c.created_at)}
                    <span className="ml-auto flex items-center gap-1.5 text-text">
                      <span className={cn("w-1.5 h-1.5 rounded-full", ESTADO_COMENTARIO[c.estado]?.punto)} aria-hidden />
                      {ESTADO_COMENTARIO[c.estado]?.texto ?? c.estado}
                    </span>
                  </span>
                  <span className="text-[0.8125rem] line-clamp-3 break-words">{c.mensaje}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <footer className="px-4 py-2.5 border-t border-border text-[0.6875rem] text-muted flex items-center">
        Llega al equipo CIA · Grupo Flesan
        <Link href="/configuracion/comentarios" onClick={onCerrar} className="ml-auto text-flesan-red dark:text-flesan-red-light hover:underline">
          Ver todos
        </Link>
      </footer>
    </section>
  );
}
