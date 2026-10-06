"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, Megaphone, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Desplegable } from "@/components/desplegable";

// SHELL · avisos para toda la plataforma (tabla `avisos`, db/002_configuracion.sql):
// - FranjaAvisos: se monta sobre la barra superior y muestra los vigentes; cada usuario puede
//   cerrar uno (se recuerda en la sesión del navegador).
// - GestionAvisos: Configuración › Avisos (solo administradores), para crearlos y terminarlos.

type Nivel = "info" | "atencion" | "critico";
interface Aviso {
  id: number;
  mensaje: string;
  nivel: Nivel;
  desde: string;
  hasta: string | null;
  creado_por: string;
  creado_en: string;
}

const ESTILO: Record<Nivel, { clase: string; Icono: typeof Info; texto: string }> = {
  info: { clase: "bg-surface-2 border-border text-text", Icono: Info, texto: "Información" },
  atencion: { clase: "aviso-atencion", Icono: Megaphone, texto: "Atención" },
  critico: { clase: "aviso-critico", Icono: AlertTriangle, texto: "Crítico" },
};
const CLAVE_CERRADOS = "cia-avisos-cerrados";

function leerCerrados(): number[] {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_CERRADOS) ?? "[]");
  } catch {
    return [];
  }
}

export function FranjaAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cerrados, setCerrados] = useState<number[]>([]);

  useEffect(() => {
    setCerrados(leerCerrados());
    fetch("/api/avisos")
      .then((r) => (r.ok ? r.json() : { avisos: [] }))
      .then((d) => setAvisos(Array.isArray(d.avisos) ? d.avisos : []))
      .catch(() => {});
  }, []);

  const visibles = avisos.filter((a) => !cerrados.includes(a.id));
  if (!visibles.length) return null;

  function cerrar(id: number) {
    const siguiente = [...cerrados, id];
    setCerrados(siguiente);
    try {
      sessionStorage.setItem(CLAVE_CERRADOS, JSON.stringify(siguiente));
    } catch {}
  }

  return (
    <div className="flex flex-col" role="region" aria-label="Avisos de la plataforma">
      {visibles.map((a) => {
        const { clase, Icono, texto } = ESTILO[a.nivel] ?? ESTILO.info;
        return (
          <div key={a.id} className={cn("flex items-center gap-3 px-4 lg:px-6 py-2 border-b text-sm", clase)} role={a.nivel === "critico" ? "alert" : "status"}>
            <Icono className="w-4 h-4 shrink-0" aria-hidden />
            <span className="sr-only">{texto}:</span>
            <span className="flex-1 min-w-0">{a.mensaje}</span>
            <button type="button" onClick={() => cerrar(a.id)} aria-label="Cerrar aviso" className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- administración

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fechaHora(iso: string | null) {
  if (!iso) return "Sin término";
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function estadoDe(a: Aviso, ahora: number) {
  if (Date.parse(a.desde) > ahora) return "Programado";
  if (a.hasta && Date.parse(a.hasta) <= ahora) return "Terminado";
  return "Vigente";
}

export function GestionAvisos() {
  const [lista, setLista] = useState<Aviso[] | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [nivel, setNivel] = useState<Nivel>("info");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [guardando, setGuardando] = useState(false);

  function cargar() {
    fetch("/api/configuracion/avisos")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setDisponible(Boolean(d.disponible));
        setLista(d.avisos ?? []);
      })
      .catch(() => setError("No se pudo cargar la lista de avisos."));
  }
  useEffect(cargar, []);

  async function crear() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/configuracion/avisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje, nivel, desde: desde || null, hasta: hasta || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No se pudo crear el aviso.");
      setMensaje("");
      setDesde("");
      setHasta("");
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el aviso.");
    } finally {
      setGuardando(false);
    }
  }

  async function terminar(id: number) {
    setError(null);
    const r = await fetch(`/api/configuracion/avisos/${id}`, { method: "PATCH" });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "No se pudo terminar el aviso.");
    cargar();
  }

  if (lista === null && !error) return <div className="skeleton h-48 rounded-flesan" />;

  if (!disponible) {
    return (
      <div className="card dens-card text-sm text-muted max-w-2xl">
        Esta plataforma aún no tiene la tabla de avisos. Se crea con <code className="text-text">db/002_configuracion.sql</code> en su
        esquema de QA; hasta entonces no se muestran avisos.
      </div>
    );
  }

  const ahora = Date.now();
  return (
    <div className="flex flex-col gap-5">
      <div className="card dens-card flex flex-col gap-3 max-w-3xl">
        <span className="text-sm font-semibold">Nuevo aviso</span>
        <label className="flex flex-col gap-1">
          <span className="label-meta text-[0.625rem] text-faint">Mensaje (lo ven todos los usuarios)</span>
          <textarea value={mensaje} maxLength={500} rows={2} onChange={(e) => setMensaje(e.target.value)} className="field-input h-auto py-2 resize-none" placeholder="Ej.: El viernes 18:00 la plataforma estará en mantención por 30 minutos." />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <span className="label-meta text-[0.625rem] text-faint">Nivel</span>
            <Desplegable
              variante="campo"
              etiqueta="Nivel"
              valor={nivel}
              onCambio={(v) => setNivel(v as Nivel)}
              opciones={[
                { valor: "info", texto: "Información" },
                { valor: "atencion", texto: "Atención" },
                { valor: "critico", texto: "Crítico" },
              ]}
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className="label-meta text-[0.625rem] text-faint">Desde (vacío = ahora)</span>
            <input type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)} className="field-input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-meta text-[0.625rem] text-faint">Hasta (vacío = sin término)</span>
            <input type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)} className="field-input" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-flesan-red">{error}</span>}
          <button type="button" onClick={crear} disabled={!mensaje.trim() || guardando} className="btn-flesan btn-flesan-primary btn-flesan-sm ml-auto disabled:opacity-50">
            {guardando ? "Publicando…" : "Publicar aviso"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {!lista?.length ? (
          <p className="px-5 py-6 text-sm text-muted">Aún no hay avisos.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border bg-surface-2">
                {["Mensaje", "Nivel", "Desde", "Hasta", "Estado", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-label text-[0.6875rem] tracking-[0.1em] uppercase text-muted font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((a) => {
                const estado = estadoDe(a, ahora);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 max-w-md">{a.mensaje}</td>
                    <td className="px-4 py-3 text-muted">{ESTILO[a.nivel]?.texto ?? a.nivel}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{fechaHora(a.desde)}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{fechaHora(a.hasta)}</td>
                    <td className="px-4 py-3">{estado}</td>
                    <td className="px-4 py-3 text-right">
                      {estado !== "Terminado" && (
                        <button type="button" onClick={() => terminar(a.id)} className="btn-flesan btn-flesan-ghost btn-flesan-sm">
                          Terminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
