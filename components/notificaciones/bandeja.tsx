"use client";

import { useState } from "react";
import { Bell, CheckCheck, FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Desplegable } from "@/components/desplegable";
import { Pildoras } from "@/components/reporte/tarjeta";
import { TIPOS_NOTIFICACION } from "@/lib/notificaciones-plataforma";
import { fechaHora, type Notificacion } from "@/lib/notificaciones-tipos";
import { FilaNotificacion, useNotificaciones } from "./comun";

/** SHELL · bandeja de notificaciones (/notificaciones): el historial con filtros por tipo y estado. */

type Estado = "todas" | "no-leidas";

function grupoFecha(iso: string, ahora: Date): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) return "Esta semana";
  return d.toLocaleDateString("es-CL", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
}

export function BandejaNotificaciones() {
  const { notificaciones, noLeidas, ejemplo, cargando, marcar } = useNotificaciones(200);
  const [tipos, setTipos] = useState<string[]>([]);
  const [estado, setEstado] = useState<Estado>("todas");

  const visibles = notificaciones.filter((n) => (!tipos.length || tipos.includes(n.tipo)) && (estado === "todas" || !n.leidaEn));
  const ahora = new Date();
  const grupos: { titulo: string; filas: Notificacion[] }[] = [];
  for (const n of visibles) {
    const titulo = grupoFecha(n.creadaEn, ahora);
    const g = grupos.find((x) => x.titulo === titulo);
    if (g) g.filas.push(n);
    else grupos.push({ titulo, filas: [n] });
  }

  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8">
      <div className="max-w-[60rem]">
      <PageHeader
        title="Notificaciones"
        description="Todo lo que la plataforma te avisó: entregas, rechazos, recordatorios, comentarios y cargas de datos. La campanita de la barra superior muestra las últimas; aquí está el historial completo."
        actions={
          ejemplo ? (
            <span
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-border-strong text-xs text-muted"
              title="La plataforma aún no tiene la tabla de notificaciones (db/003_notificaciones.sql)."
            >
              <FlaskConical className="w-3.5 h-3.5" aria-hidden />
              Datos de ejemplo
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Pildoras
          etiqueta="Estado"
          opciones={[
            { id: "todas", texto: "Todas" },
            { id: "no-leidas", texto: noLeidas ? `No leídas (${noLeidas})` : "No leídas" },
          ]}
          valor={estado}
          onCambio={setEstado}
        />
        <Desplegable
          multiple
          variante="filtro"
          etiqueta="Tipo"
          textoTodos="Todos"
          valor={tipos}
          activo={tipos.length > 0}
          onCambio={setTipos}
          opciones={Object.entries(TIPOS_NOTIFICACION).map(([clave, t]) => ({ valor: clave, texto: t.etiqueta, detalle: String(notificaciones.filter((n) => n.tipo === clave).length) }))}
        />
        {noLeidas > 0 && (
          <button type="button" onClick={() => marcar({ todas: true })} className="btn-flesan btn-flesan-ghost btn-flesan-sm ml-auto">
            <CheckCheck className="w-4 h-4" aria-hidden />
            Marcar todo leído
          </button>
        )}
      </div>

      <div className="card p-2">
        {cargando ? (
          <div className="flex flex-col gap-2 p-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-14 w-full" />
            ))}
          </div>
        ) : grupos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <Bell className="w-7 h-7 text-faint" aria-hidden />
            <p className="text-sm text-muted">{notificaciones.length ? "No hay notificaciones con esos filtros." : "No tienes notificaciones."}</p>
          </div>
        ) : (
          grupos.map((g) => (
            <section key={g.titulo} className="flex flex-col gap-0.5 pb-1">
              <h2 className="px-3 pt-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">{g.titulo}</h2>
              {g.filas.map((n) => (
                <FilaNotificacion key={n.id} n={n} fecha={fechaHora(n.creadaEn)} onMarcar={() => marcar({ ids: [n.id] })} />
              ))}
            </section>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
