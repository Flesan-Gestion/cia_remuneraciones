"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronDown, Search } from "lucide-react";
import { BotonExcel } from "@/components/boton-excel";
import { descargarExcel } from "@/lib/exportar/excel";
import { Desplegable } from "@/components/desplegable";
import { normalizar, periodoLegible } from "@/lib/liquidaciones/formato";
import { etiquetaRolLibro, type RolLibro } from "@/lib/libro/tipos";
import { rangoSemanas } from "@/lib/finiquitos/tipos";
import type { EventoActividad } from "@/lib/actividad-db";
import { fetcher, Nota, Paginacion } from "@/components/liquidaciones/ui";

// Configuración › Registro de actividad (solo administradores), conectado a registro_actividad.
// La búsqueda también encuentra a las personas cuyas liquidaciones se descargaron o enviaron.

const RANGOS = [
  { id: "1", texto: "Últimas 24 h" },
  { id: "7", texto: "Últimos 7 días" },
  { id: "30", texto: "Últimos 30 días" },
  { id: "90", texto: "Últimos 90 días" },
];
const POR_PAGINA = 25;

interface Persona {
  np: string;
  nombre: string;
  periodo?: string;
}

function personasDe(e: EventoActividad): Persona[] {
  const p = e.detalle.personas;
  return Array.isArray(p) ? (p as Persona[]) : [];
}

/** Una línea legible del detalle de cada acción. */
function resumen(e: EventoActividad): string {
  const d = e.detalle as Record<string, unknown>;
  const periodo = typeof d.periodo === "string" ? periodoLegible(d.periodo) : null;
  switch (e.accion) {
    case "Descargó liquidaciones": {
      const personas = personasDe(e);
      const periodos = [...new Set(personas.map((p) => p.periodo).filter(Boolean) as string[])].map(periodoLegible);
      return `${d.cantidad ?? personas.length} liquidaciones · ${periodos.slice(0, 3).join(", ")}${periodos.length > 3 ? "…" : ""}`;
    }
    case "Preparó envío":
      return `${periodo}: ${d.personas} personas, ${d.sin_correo} sin correo`;
    case "Envió prueba":
    case "Reenvió liquidación":
      return `${periodo}: ${d.nombre} (${d.np}) → ${d.para}${d.ok === false ? " · falló" : ""}`;
    case "Excluyó del envío":
    case "Incluyó en el envío":
      return `${periodo}: ${d.nombre} (${d.np})`;
    case "Cambió acceso": {
      const libros = "rol_remuneraciones" in d ? `, libros ${d.rol_remuneraciones ? etiquetaRolLibro(d.rol_remuneraciones as RolLibro) : "sin acceso"}` : "";
      return `${e.entidad_id}: rol ${d.rol}, perfil ${d.perfil}${Array.isArray(d.empresas) && d.empresas.length ? `, empresas ${d.empresas.join(", ")}` : ""}${libros}`;
    }
    case "Descargó el libro de remuneraciones":
    case "Descargó el libro prorrateado":
    case "Descargó los finiquitos": {
      const f = (d.filtros ?? {}) as { empresa?: string | null; cc?: string | null; desde?: string; hasta?: string };
      const rango =
        e.accion === "Descargó los finiquitos"
          ? rangoSemanas
          : (desde: string, hasta: string) => (desde === hasta ? periodoLegible(desde) : `${periodoLegible(desde)} a ${periodoLegible(hasta)}`);
      const periodos = f.desde && f.hasta ? rango(f.desde, f.hasta) : "";
      return `${d.filas} filas, ${d.personas} personas · ${periodos}${f.empresa ? ` · ${f.empresa}` : " · todas las empresas"}${f.cc ? ` · CC ${f.cc}` : ""}`;
    }
    case "Cambió la programación":
      return `Día ${d.dia_mes}, ${d.activo ? "activo" : "inactivo"}`;
    default:
      return periodo ? `${periodo}` : JSON.stringify(d);
  }
}

export function RegistroActividadConectado() {
  const [rango, setRango] = useState("7");
  const { data, error, isLoading } = useSWR<{ eventos: EventoActividad[] }>(`/api/configuracion/actividad?dias=${rango}`, fetcher);
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [acciones, setAcciones] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(0);
  const [abierto, setAbierto] = useState<number | null>(null);

  const eventos = useMemo(() => data?.eventos ?? [], [data]);
  const filtrados = useMemo(() => {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    return eventos.filter((e) => {
      if (usuarios.length && !usuarios.includes(e.correo)) return false;
      if (acciones.length && !acciones.includes(e.accion)) return false;
      if (!palabras.length) return true;
      const t = normalizar(`${e.correo} ${e.accion} ${e.entidad} ${e.entidad_id ?? ""} ${JSON.stringify(e.detalle)}`);
      return palabras.every((p) => t.includes(p));
    });
  }, [eventos, usuarios, acciones, texto]);
  useEffect(() => setPagina(0), [rango, usuarios, acciones, texto]);

  if (isLoading) return <div className="skeleton h-64 rounded-flesan" />;
  if (error) return <Nota tono="alerta" titulo="No se pudo leer el registro">{error.message}</Nota>;

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const todosUsuarios = [...new Set(eventos.map((e) => e.correo))].sort();
  const todasAcciones = [...new Set(eventos.map((e) => e.accion))].sort();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Desplegable variante="filtro" etiqueta="Rango" valor={rango} activo={rango !== "7"} onCambio={setRango} opciones={RANGOS.map((r) => ({ valor: r.id, texto: r.texto }))} />
        <Desplegable multiple variante="filtro" etiqueta="Usuario" textoTodos="Todos" valor={usuarios} activo={usuarios.length > 0} onCambio={setUsuarios} opciones={todosUsuarios.map((u) => ({ valor: u, texto: u }))} />
        <Desplegable multiple variante="filtro" etiqueta="Acción" textoTodos="Todas" valor={acciones} activo={acciones.length > 0} onCambio={setAcciones} opciones={todasAcciones.map((a) => ({ valor: a, texto: a }))} />
        <label className="relative flex-1 min-w-52">
          <span className="sr-only">Buscar en el detalle</span>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar: usuario, persona, N° de personal…" className="field-input pl-9! w-full!" />
        </label>
        <BotonExcel
          onDescargar={() =>
            descargarExcel(
              [
                {
                  nombre: "Actividad",
                  filas: filtrados.flatMap((e) => {
                    const personas = personasDe(e);
                    return personas.length ? personas.map((p) => ({ e, p })) : [{ e, p: null as Persona | null }];
                  }),
                  columnas: [
                    { titulo: "Fecha", valor: ({ e }) => new Date(e.ocurrido_en), tipo: "fecha" },
                    { titulo: "Usuario", valor: ({ e }) => e.correo },
                    { titulo: "Acción", valor: ({ e }) => e.accion },
                    { titulo: "Detalle", valor: ({ e }) => resumen(e), ancho: 50 },
                    { titulo: "N° personal", valor: ({ p }) => p?.np ?? "" },
                    { titulo: "Persona", valor: ({ p }) => p?.nombre ?? "", ancho: 34 },
                    { titulo: "Periodo", valor: ({ p }) => (p?.periodo ? periodoLegible(p.periodo) : "") },
                  ],
                },
              ],
              { archivo: "registro-actividad", filtros: { Rango: RANGOS.find((r) => r.id === rango)?.texto ?? "", Usuario: usuarios.join(", ") || "Todos", Acción: acciones.join(", ") || "Todas" } },
            )
          }
        />
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border bg-surface-2">
                {["Fecha", "Usuario", "Acción", "Detalle"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-label text-[0.6875rem] tracking-[0.1em] uppercase text-muted font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((e) => {
                const personas = personasDe(e);
                const expandido = abierto === e.id;
                return (
                  <tr key={e.id} className="align-top">
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                      {new Date(e.ocurrido_en).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5">{e.correo}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{e.accion}</td>
                    <td className="px-4 py-2.5">
                      {resumen(e)}
                      {personas.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAbierto(expandido ? null : e.id)}
                            aria-expanded={expandido}
                            className="ml-2 inline-flex items-center gap-1 text-xs text-flesan-red hover:underline cursor-pointer"
                          >
                            {expandido ? "Ocultar" : `Ver ${personas.length === 1 ? "la persona" : `las ${personas.length} personas`}`}
                            <ChevronDown className={`w-3 h-3 transition-transform ${expandido ? "rotate-180" : ""}`} aria-hidden />
                          </button>
                          {expandido && (
                            <ul className="mt-2 max-h-56 overflow-y-auto text-xs text-muted columns-1 md:columns-2 gap-6">
                              {personas.map((p, i) => (
                                <li key={i} className="break-inside-avoid">
                                  {p.nombre} · {p.np}
                                  {p.periodo ? ` · ${periodoLegible(p.periodo)}` : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!visibles.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    No hay actividad con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Paginacion pagina={pagina} paginas={paginas} onCambio={setPagina} total={filtrados.length} unidad="registros" />
      </div>
    </div>
  );
}
