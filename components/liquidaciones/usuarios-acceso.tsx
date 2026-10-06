"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { ChevronRight, FileSpreadsheet, FileText, Search, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Desplegable } from "@/components/desplegable";
import type { Colaborador } from "@/lib/colaboradores-db";
import type { UsuarioAsignado } from "@/lib/usuarios-db";
import { enviarJson, fetcher, Nota } from "@/components/liquidaciones/ui";
import { Acceso, coincide, FichaPersona, type Guardable } from "@/components/usuarios/ficha";
import { CentrosCosto } from "@/components/usuarios/centros";
import { accesoLiquidaciones, lineaLibros, lineaLiquidaciones, type ConteoCentros } from "@/components/usuarios/resumen";

// Configuración › Usuarios y roles. Dos pestañas:
// - Personas: una fila por persona con lo que ve, en palabras; la ficha (panel lateral) pregunta qué
//   liquidaciones ve, qué libros ve, en qué centros está y si administra la plataforma.
// - Centros de costo: la copia de tabla_encargados_cc por centro (encargado, visitador, GGO).
// Los permisos son los mismos de siempre (perfil, rol de los libros, tabla de encargados); solo
// cambia cómo se presentan.

interface DatosUsuarios {
  usuarios: UsuarioAsignado[];
  /** false mientras no esté aplicado db/005_remuneraciones.sql. */
  libros: boolean;
  adminsFijos: string[];
  empresas: { codigo: string; nombre: string }[];
  /** Centros donde cada usuario es encargado o visitador, y GGO; null sin db/006_encargados_cc.sql. */
  centros: Record<string, ConteoCentros> | null;
}

type Pestana = "personas" | "centros";

const FILTROS_LIQ = [
  { valor: "", texto: "Todas" },
  { valor: "todas", texto: "Ve todas" },
  { valor: "centros", texto: "Sus centros" },
  { valor: "empresas", texto: "Empresas completas" },
  { valor: "ninguna", texto: "Sin acceso" },
];

function iniciales(nombre: string) {
  const p = nombre.split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 2 ? p[p.length - 2][0] : (p[1]?.[0] ?? ""))).toUpperCase();
}

export function UsuariosAcceso() {
  const { data, error, isLoading, mutate } = useSWR<DatosUsuarios>("/api/configuracion/usuarios", fetcher);
  const { data: maestro } = useSWR<{ colaboradores: Colaborador[] }>("/api/configuracion/colaboradores", fetcher, { revalidateOnFocus: false });
  const [pestana, setPestana] = useState<Pestana>("personas");
  const [busqueda, setBusqueda] = useState("");
  const [filtroLiq, setFiltroLiq] = useState("");
  const [filtroLibros, setFiltroLibros] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const porCorreo = useMemo(() => new Map((maestro?.colaboradores ?? []).map((c) => [c.correo, c])), [maestro]);
  const usuarios = useMemo(() => data?.usuarios ?? [], [data]);
  const nombreDe = (u: Pick<UsuarioAsignado, "correo" | "nombre">) => u.nombre ?? porCorreo.get(u.correo)?.nombre ?? u.correo;
  const visibles = useMemo(
    () =>
      usuarios
        .filter((u) => {
          const p = porCorreo.get(u.correo);
          const rol = u.rolRemuneraciones === "administrador_obra" ? "administrativo_rrhh" : u.rolRemuneraciones;
          const libros = filtroLibros === "" || (filtroLibros === "sin" ? !rol : rol === filtroLibros);
          return (!filtroLiq || accesoLiquidaciones(u) === filtroLiq) && libros && coincide(busqueda, u.nombre, p?.nombre, u.correo, p?.cargo, p?.empresa);
        })
        .sort((a, b) => (a.nombre ?? porCorreo.get(a.correo)?.nombre ?? a.correo).localeCompare(b.nombre ?? porCorreo.get(b.correo)?.nombre ?? b.correo, "es")),
    [usuarios, porCorreo, filtroLiq, filtroLibros, busqueda],
  );

  if (isLoading) return <div className="skeleton h-64 rounded-flesan" />;
  if (error || !data) return <Nota tono="alerta" titulo="No se pudo leer la tabla de usuarios">{error?.message ?? "Revisa que esté aplicado db/004_liquidaciones.sql."}</Nota>;

  async function guardar({ rolRemuneraciones, ...u }: Guardable, mensaje: string) {
    try {
      // Sin db/005 aplicado no se manda el rol de libros (la API no lo toca).
      await enviarJson("/api/configuracion/usuarios", data?.libros ? { ...u, rolRemuneraciones } : u);
      await mutate();
      toast.success(mensaje);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  async function quitar(u: UsuarioAsignado) {
    try {
      const r = await fetch(`/api/configuracion/usuarios/${encodeURIComponent(u.correo)}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      await mutate();
      toast.success(`${nombreDe(u)} vuelve al acceso por defecto (liquidaciones de sus centros, sin libros, no administra).`);
    } catch {
      toast.error("No se pudo quitar. Intenta de nuevo.");
    } finally {
      setQuitando(null);
    }
  }

  const nombreEmpresa = (c: string) => data.empresas.find((e) => e.codigo === c)?.nombre ?? c;
  const conteoDe = (correo: string) => (data.centros ? (data.centros[correo] ?? { centros: 0, ggo: 0 }) : null);
  const personaAbierta = abierta ? usuarios.find((x) => x.correo === abierta) : undefined;
  const cuantosLiq = (v: string) => usuarios.filter((u) => accesoLiquidaciones(u) === v).length;
  const cuantosLibros = (v: string | null) => usuarios.filter((u) => u.rolRemuneraciones === v).length;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Vista" className="inline-flex self-start rounded-full border border-border p-1 bg-surface">
        {(
          [
            { valor: "personas", texto: `Personas (${usuarios.length})` },
            { valor: "centros", texto: "Centros de costo" },
          ] as { valor: Pestana; texto: string }[]
        ).map((t) => (
          <button
            key={t.valor}
            type="button"
            role="tab"
            aria-selected={pestana === t.valor}
            onClick={() => setPestana(t.valor)}
            className={cn(
              "h-8 px-4 rounded-full text-sm font-semibold cursor-pointer transition-colors",
              pestana === t.valor ? "bg-flesan-red text-white" : "text-muted hover:text-text",
            )}
          >
            {t.texto}
          </button>
        ))}
      </div>

      {data.centros === null && (
        <Nota titulo="Encargados de centros de costo aún sin base">
          Falta aplicar db/006_encargados_cc.sql en cia_liquidaciones: hasta entonces nadie figura como encargado, visitador ni GGO.
        </Nota>
      )}

      {pestana === "centros" ? (
        <CentrosCosto personas={usuarios.map((u) => ({ correo: u.correo, nombre: nombreDe(u) }))} onCambio={() => mutate()} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative w-full sm:w-96">
              <span className="sr-only">Buscar persona</span>
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, correo, cargo o empresa…" className="field-input rounded-full! pl-10! w-full!" />
            </label>
            <Desplegable
              variante="filtro"
              etiqueta="Liquidaciones"
              valor={filtroLiq}
              activo={filtroLiq !== ""}
              onCambio={setFiltroLiq}
              opciones={FILTROS_LIQ.map((f) => ({ ...f, detalle: f.valor ? String(cuantosLiq(f.valor)) : undefined }))}
            />
            {data.libros && (
              <Desplegable
                variante="filtro"
                etiqueta="Libros"
                valor={filtroLibros}
                activo={filtroLibros !== ""}
                onCambio={setFiltroLibros}
                opciones={[
                  { valor: "", texto: "Todos" },
                  { valor: "administrador", texto: "Todo", detalle: String(cuantosLibros("administrador")) },
                  { valor: "rrhh", texto: "Todo, por razón social", detalle: String(cuantosLibros("rrhh")) },
                  { valor: "administrativo_rrhh", texto: "Sus centros", detalle: String(cuantosLibros("administrativo_rrhh") + cuantosLibros("administrador_obra")) },
                  { valor: "ggo", texto: "Costo empresa", detalle: String(cuantosLibros("ggo")) },
                  { valor: "sin", texto: "Sin acceso", detalle: String(cuantosLibros(null)) },
                ]}
              />
            )}
            <button type="button" onClick={() => setAgregando(true)} className="btn-flesan btn-flesan-primary btn-flesan-sm rounded-flesan ml-auto">
              <UserPlus className="w-4 h-4" aria-hidden />
              Agregar persona
            </button>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border bg-surface-2">
                    {["Persona", "Cargo", "Lo que ve", ""].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 font-label text-[0.6875rem] tracking-[0.1em] uppercase text-muted font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibles.map((u) => {
                    const p = porCorreo.get(u.correo);
                    const nombre = nombreDe(u);
                    const conteo = conteoDe(u.correo);
                    return (
                      <tr key={u.correo} className="hover:bg-surface-2/60 cursor-pointer" onClick={() => setAbierta(u.correo)}>
                        <td className="px-4 py-2.5 min-w-64">
                          <span className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className={cn(
                                "w-8 h-8 shrink-0 rounded-full inline-flex items-center justify-center text-[0.6875rem] font-bold",
                                u.rol === "admin" ? "bg-flesan-red/10 text-flesan-red" : "bg-surface-2 text-muted",
                              )}
                            >
                              {iniciales(nombre)}
                            </span>
                            <span className="flex flex-col min-w-0">
                              <span className="font-semibold text-text truncate">{nombre}</span>
                              <span className="text-xs text-muted truncate">{u.correo}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="block text-text">{p?.cargo ?? <span className="text-faint">{p ? "—" : "No está activo en el maestro"}</span>}</span>
                          {p?.empresa && <span className="block text-xs text-muted">{p.empresa}</span>}
                        </td>
                        <td className="px-4 py-2.5 min-w-80">
                          <span className="flex flex-col gap-1">
                            <Acceso icono={<FileText className="w-3.5 h-3.5" />} rotulo="Liquidaciones" linea={lineaLiquidaciones(u, conteo, nombreEmpresa)} />
                            <Acceso icono={<FileSpreadsheet className="w-3.5 h-3.5" />} rotulo="Libros" linea={lineaLibros(u.rolRemuneraciones, conteo)} />
                            {u.rol === "admin" && <Acceso icono={<ShieldCheck className="w-3.5 h-3.5" />} rotulo="Plataforma" linea={{ texto: "Administrador", tono: "todo" }} />}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {quitando === u.correo ? (
                            <span className="inline-flex items-center gap-2 text-xs text-muted">
                              ¿Volver al acceso por defecto?
                              <button type="button" onClick={() => quitar(u)} className="btn-flesan btn-flesan-primary btn-flesan-sm rounded-flesan">
                                Quitar
                              </button>
                              <button type="button" onClick={() => setQuitando(null)} className="btn-flesan btn-flesan-ghost btn-flesan-sm rounded-flesan">
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setQuitando(u.correo)}
                                title="Quitar de la lista: vuelve al acceso por defecto (liquidaciones de sus centros, sin libros). No lo saca de sus centros."
                                aria-label={`Quitar a ${nombre} de la lista`}
                                className="w-8 h-8 inline-flex items-center justify-center rounded-md text-faint hover:text-flesan-red hover:bg-bg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setAbierta(u.correo)}
                                aria-label={`Editar el acceso de ${nombre}`}
                                className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-bg cursor-pointer"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!visibles.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted">
                        {usuarios.length ? "Nadie coincide con la búsqueda." : "Nadie tiene un acceso administrado todavía."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-t border-border text-xs text-muted">
              <span>
                {usuarios.length} personas · {cuantosLiq("todas")} ven todas las liquidaciones · {usuarios.filter((u) => u.rol === "admin").length} administradores
              </span>
              <span className="text-faint">
                Quien no está en la lista ve las liquidaciones de los centros donde es encargado o visitador, no entra a los libros ni administra.
              </span>
            </div>
          </div>
        </>
      )}

      {!data.libros && (
        <Nota titulo="Acceso a los libros aún sin base">
          Falta aplicar db/005_remuneraciones.sql en cia_liquidaciones: hasta entonces nadie entra al libro de remuneraciones y no se puede editar.
        </Nota>
      )}

      {data.adminsFijos.length > 0 && (
        <p className="text-xs text-faint">Administradores fijos de la plataforma (CIA_ADMIN_EMAILS): {data.adminsFijos.join(", ")}.</p>
      )}

      {personaAbierta && (
        <FichaPersona
          u={personaAbierta}
          nombre={nombreDe(personaAbierta)}
          cargo={porCorreo.get(personaAbierta.correo)?.cargo ?? null}
          conteo={conteoDe(personaAbierta.correo)}
          empresas={data.empresas}
          libros={data.libros}
          onGuardar={guardar}
          onCambioCentros={() => mutate()}
          onCerrar={() => setAbierta(null)}
        />
      )}

      {agregando && (
        <PanelAgregar
          maestro={maestro?.colaboradores ?? null}
          existentes={new Set(usuarios.map((u) => u.correo))}
          onAgregar={async (c) => {
            await guardar({ correo: c.correo, nombre: c.nombre, rol: "member", perfil: "jefatura", empresas: null, rolRemuneraciones: null }, `${c.nombre} se agregó.`);
            setAbierta(c.correo);
          }}
          onCerrar={() => setAgregando(false)}
        />
      )}
    </div>
  );
}

/** Panel lateral: busca en el maestro de colaboradores y agrega a la persona con el acceso por
 * defecto (el mismo que tiene sin estar en la lista); después se abre su ficha para configurarla. */
function PanelAgregar({
  maestro,
  existentes,
  onAgregar,
  onCerrar,
}: {
  maestro: Colaborador[] | null;
  existentes: Set<string>;
  onAgregar: (c: Colaborador) => Promise<void>;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [elegida, setElegida] = useState<Colaborador | null>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const resultados = busqueda.trim() && maestro ? maestro.filter((p) => coincide(busqueda, p.nombre, p.correo, p.cargo, p.empresa, p.departamento)).slice(0, 8) : [];

  useEffect(() => {
    buscador.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/30 cursor-default" />
      <aside role="dialog" aria-modal="true" aria-labelledby="agregar-usuario-titulo" className="relative w-full max-w-[26rem] h-full bg-surface border-l border-border shadow-2xl flex flex-col animate-fade-in">
        <header className="flex items-center gap-2 px-5 h-14 border-b border-border shrink-0">
          <h2 id="agregar-usuario-titulo" className="text-base font-bold text-text">
            Agregar persona
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-bg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 p-5 overflow-y-auto">
          <label className="relative block">
            <span className="sr-only">Buscar en el maestro de colaboradores</span>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
            <input
              ref={buscador}
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setElegida(null);
              }}
              placeholder="Nombre, apellido, cargo o empresa…"
              className="field-input rounded-full! pl-10! w-full!"
            />
          </label>

          {!maestro ? (
            <p className="text-sm text-muted">Cargando el maestro de colaboradores…</p>
          ) : !busqueda.trim() ? (
            <p className="text-xs text-muted">Busca en el maestro de colaboradores activos. Puedes escribir cualquiera de los nombres y apellidos, en cualquier orden.</p>
          ) : resultados.length === 0 ? (
            <p className="text-sm text-muted">Nadie en el maestro coincide con «{busqueda}».</p>
          ) : (
            <ul className="flex flex-col gap-1" aria-label="Resultados">
              {resultados.map((p) => {
                const tiene = existentes.has(p.correo);
                const activa = elegida?.correo === p.correo;
                return (
                  <li key={p.correo}>
                    <button
                      type="button"
                      disabled={tiene}
                      onClick={() => setElegida(p)}
                      aria-pressed={activa}
                      className={cn(
                        "w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors cursor-pointer disabled:cursor-default",
                        activa ? "border-flesan-red bg-flesan-red/5" : "border-transparent hover:bg-bg",
                        tiene && "opacity-55",
                      )}
                    >
                      <span aria-hidden className="w-8 h-8 shrink-0 rounded-full inline-flex items-center justify-center text-[0.6875rem] font-bold bg-surface-2 text-muted">
                        {iniciales(p.nombre)}
                      </span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-text truncate">{p.nombre}</span>
                        <span className="text-xs text-muted truncate">{[p.cargo, p.empresa].filter(Boolean).join(" · ")}</span>
                      </span>
                      {tiene && <span className="text-[0.6875rem] text-faint shrink-0">Ya está</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="mt-auto flex flex-col gap-3 p-5 border-t border-border shrink-0">
          <p className="text-xs text-muted">
            Entra con el acceso por defecto: liquidaciones de sus centros, sin libros. Después se abre su ficha para darle lo que necesite.
          </p>
          <button
            type="button"
            disabled={!elegida}
            onClick={async () => {
              if (!elegida) return;
              onCerrar();
              await onAgregar(elegida);
            }}
            className="btn-flesan btn-flesan-primary rounded-flesan disabled:opacity-40"
          >
            {elegida ? `Agregar a ${elegida.nombre}` : "Elige a una persona"}
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
