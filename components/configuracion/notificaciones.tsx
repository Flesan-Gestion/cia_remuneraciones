"use client";

import { useState } from "react";
import { Mail, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { AvisoMaqueta } from "@/components/configuracion/maqueta";

// MAQUETA · Configuración › Notificaciones y correos (solo administradores). Datos de ejemplo.
// En una plataforma: tabla notificaciones (un evento por fila) y una función común
// enviarCorreo(evento, datos) que respeta lo que cada usuario eligió en Mi personalización.

interface Evento {
  clave: string;
  nombre: string;
  cuando: string;
  activo: boolean;
  aQuien: string;
  destinatarios: string[];
  asunto: string;
  plantilla: string;
}

const VARIABLES = ["{nombre}", "{plataforma}", "{detalle}", "{enlace}", "{fecha}"];
const EJEMPLO: Record<string, string> = {
  "{nombre}": "Usuario de prueba",
  "{plataforma}": "Nombre Plataforma",
  "{detalle}": "Auditoría #1042 · CG 2311",
  "{enlace}": "https://plataforma.flesan.cl/auditorias/1042",
  "{fecha}": "29 sep 2026",
};

const INICIALES: Evento[] = [
  {
    clave: "asignacion",
    nombre: "Te asignaron algo",
    cuando: "Al asignar una tarea, revisión o ítem a alguien",
    activo: true,
    aQuien: "La persona asignada",
    destinatarios: [],
    asunto: "{plataforma}: te asignaron {detalle}",
    plantilla: "Hola {nombre}:\n\nTe asignaron {detalle}.\n\nPuedes revisarlo aquí: {enlace}\n\nEquipo CIA · Grupo Flesan",
  },
  {
    clave: "datos-atrasados",
    nombre: "Datos atrasados",
    cuando: "Cuando una fuente de datos pasa su plazo de carga",
    activo: true,
    aQuien: "Administradores + destinatarios fijos",
    destinatarios: ["control.gestion@flesan.cl"],
    asunto: "{plataforma}: datos atrasados ({detalle})",
    plantilla: "Hola:\n\nLa fuente {detalle} no se actualiza desde el {fecha}.\n\nEstado de las fuentes: {enlace}",
  },
  {
    clave: "resumen-semanal",
    nombre: "Resumen semanal",
    cuando: "Lunes a las 08:00",
    activo: false,
    aQuien: "Usuarios que lo activan en Mi personalización",
    destinatarios: [],
    asunto: "{plataforma}: tu resumen de la semana",
    plantilla: "Hola {nombre}:\n\nEsto quedó pendiente esta semana:\n{detalle}\n\nVer en la plataforma: {enlace}",
  },
  {
    clave: "comentario-respondido",
    nombre: "Respuesta a tu comentario",
    cuando: "Cuando el equipo CIA cambia el estado de tu comentario",
    activo: true,
    aQuien: "Quien envió el comentario",
    destinatarios: [],
    asunto: "Tu comentario sobre {plataforma} cambió de estado",
    plantilla: "Hola {nombre}:\n\nTu comentario «{detalle}» ahora está en revisión.\n\nVer tus mensajes: {enlace}",
  },
];

function reemplazar(texto: string) {
  return VARIABLES.reduce((t, v) => t.split(v).join(EJEMPLO[v]), texto);
}

export function Notificaciones() {
  const [eventos, setEventos] = useState(INICIALES);
  const [sel, setSel] = useState(INICIALES[0].clave);
  const [nuevo, setNuevo] = useState("");
  const ev = eventos.find((e) => e.clave === sel)!;

  const cambiar = (c: Partial<Evento>) => setEventos((es) => es.map((e) => (e.clave === sel ? { ...e, ...c } : e)));

  function agregarDestinatario() {
    const correo = nuevo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || ev.destinatarios.includes(correo)) return;
    cambiar({ destinatarios: [...ev.destinatarios, correo] });
    setNuevo("");
  }

  return (
    <div className="flex flex-col gap-4">
      <AvisoMaqueta tablas="notificaciones" />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4 items-start">
        <ul className="card overflow-hidden p-0 divide-y divide-border" aria-label="Eventos que envían correo">
          {eventos.map((e) => (
            <li key={e.clave} className={cn("flex items-start gap-3 px-4 py-3", e.clave === sel && "bg-bg")}>
              <button type="button" onClick={() => setSel(e.clave)} className="flex-1 min-w-0 text-left cursor-pointer" aria-current={e.clave === sel}>
                <span className={cn("block text-sm font-semibold", e.clave === sel && "text-flesan-red dark:text-flesan-red-light")}>{e.nombre}</span>
                <span className="block text-xs text-muted">{e.cuando}</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={e.activo}
                aria-label={`${e.nombre}: ${e.activo ? "activo" : "inactivo"}`}
                onClick={() => setEventos((es) => es.map((x) => (x.clave === e.clave ? { ...x, activo: !x.activo } : x)))}
                className={cn("relative w-9 h-5 shrink-0 rounded-full transition-colors cursor-pointer mt-0.5", e.activo ? "bg-flesan-red" : "bg-border-strong")}
              >
                <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", e.activo && "translate-x-4")} />
              </button>
            </li>
          ))}
        </ul>

        <div className="card dens-card flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted" aria-hidden />
            <span className="text-sm font-semibold">{ev.nombre}</span>
            <span className="badge ml-auto">{ev.activo ? "Activo" : "Inactivo"}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="label-meta text-[0.625rem] text-faint">Destinatarios</span>
            <p className="text-sm text-muted">{ev.aQuien}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {ev.destinatarios.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-0.5 text-xs">
                  {d}
                  <button type="button" aria-label={`Quitar ${d}`} onClick={() => cambiar({ destinatarios: ev.destinatarios.filter((x) => x !== d) })} className="text-muted hover:text-text cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <input
                  value={nuevo}
                  onChange={(e) => setNuevo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && agregarDestinatario()}
                  placeholder="Agregar correo fijo…"
                  aria-label="Agregar destinatario fijo"
                  className="field-input h-7 w-56! text-xs"
                />
                <button type="button" onClick={agregarDestinatario} aria-label="Agregar" className="w-7 h-7 flex items-center justify-center rounded-flesan-sm border border-border-strong text-muted hover:text-text cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="label-meta text-[0.625rem] text-faint">Asunto</span>
            <input value={ev.asunto} onChange={(e) => cambiar({ asunto: e.target.value })} className="field-input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-meta text-[0.625rem] text-faint">Mensaje</span>
            <textarea value={ev.plantilla} onChange={(e) => cambiar({ plantilla: e.target.value })} rows={8} className="field-input h-auto py-2 resize-y font-mono text-xs leading-relaxed" />
          </label>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            Variables:
            {VARIABLES.map((v) => (
              <button key={v} type="button" onClick={() => cambiar({ plantilla: `${ev.plantilla}${v}` })} className="rounded-flesan-sm border border-border px-1.5 py-0.5 font-mono hover:border-border-strong hover:text-text cursor-pointer">
                {v}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="label-meta text-[0.625rem] text-faint">Vista previa</span>
            <div className="rounded-flesan border border-border bg-surface-2 p-4 text-sm flex flex-col gap-2">
              <span className="font-semibold">{reemplazar(ev.asunto)}</span>
              <span className="whitespace-pre-line text-muted">{reemplazar(ev.plantilla)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => toast.success("Maqueta: se enviaría una prueba a tu correo.")} className="btn-flesan btn-flesan-ghost btn-flesan-sm">
              <Send className="w-3.5 h-3.5" />
              Enviar prueba
            </button>
            <button type="button" onClick={() => toast.success("Maqueta: cambios guardados solo en esta pantalla.")} className="btn-flesan btn-flesan-primary btn-flesan-sm">
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
