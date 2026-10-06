"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";

// SHELL · «Mis comentarios» (Configuración): lo que el usuario envió con el widget de comentarios
// de la CIA y en qué estado va. Lee /api/feedback/mios, que consulta el servicio central.

interface Comentario {
  id: number;
  tipo: "sugerencia" | "bug" | "otro";
  mensaje: string;
  estado: "nuevo" | "en_revision" | "resuelto" | "descartado";
  created_at: string;
}

const TIPO: Record<Comentario["tipo"], string> = { sugerencia: "Sugerencia", bug: "Error", otro: "Otro" };
// Texto siempre en el color de texto (contraste); el color de estado va en el punto.
const ESTADO: Record<Comentario["estado"], { texto: string; punto: string }> = {
  nuevo: { texto: "Recibido", punto: "bg-faint" },
  en_revision: { texto: "En revisión", punto: "bg-status-warn" },
  resuelto: { texto: "Resuelto", punto: "bg-status-ok" },
  descartado: { texto: "Descartado", punto: "bg-border-strong" },
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fecha(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export function MisComentarios() {
  const [estado, setEstado] = useState<"cargando" | "error" | Comentario[]>("cargando");

  useEffect(() => {
    fetch("/api/feedback/mios")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setEstado(Array.isArray(d) ? d : []))
      .catch(() => setEstado("error"));
  }, []);

  if (estado === "cargando") return <div className="skeleton h-40 rounded-flesan" />;

  if (estado === "error") {
    return (
      <div className="card dens-card text-sm text-muted">
        No se pudo consultar el servicio de comentarios en este momento. Intenta de nuevo más tarde.
      </div>
    );
  }

  if (!estado.length) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3 text-center">
        <MessageSquare className="w-8 h-8 text-faint" />
        <p className="text-sm text-muted max-w-md">
          Aún no has enviado comentarios. Usa el botón de comentarios, abajo a la derecha, para contarnos un error o
          una idea; aquí vas a ver en qué estado va.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <ul className="divide-y divide-border">
        {[...estado]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((c) => (
            <li key={c.id} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-5 px-5 py-4">
              <span className="text-xs text-muted w-28 shrink-0 pt-0.5">{fecha(c.created_at)}</span>
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="font-label text-[0.625rem] tracking-[0.12em] uppercase text-faint">{TIPO[c.tipo] ?? c.tipo}</span>
                <span className="text-sm text-text whitespace-pre-line break-words">{c.mensaje}</span>
              </span>
              <span className="badge self-start shrink-0 text-text">
                <span className={cn("w-1.5 h-1.5 rounded-full", ESTADO[c.estado]?.punto ?? "bg-faint")} aria-hidden />
                {ESTADO[c.estado]?.texto ?? c.estado}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
