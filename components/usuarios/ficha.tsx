"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Search, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Desplegable } from "@/components/desplegable";
import { normalizar } from "@/lib/liquidaciones/formato";
import type { Rol } from "@/lib/roles";
import type { RolLibro } from "@/lib/libro/tipos";
import type { UsuarioAsignado } from "@/lib/usuarios-db";
import { enviarJson, fetcher, Nota } from "@/components/liquidaciones/ui";
import {
  OPCIONES_LIBROS,
  OPCIONES_LIQUIDACIONES,
  accesoLiquidaciones,
  lineaLibros,
  lineaLiquidaciones,
  type AccesoLiquidaciones,
  type ConteoCentros,
  type Linea,
} from "@/components/usuarios/resumen";

export type Guardable = Pick<UsuarioAsignado, "correo" | "nombre" | "rol" | "perfil" | "empresas" | "rolRemuneraciones">;

type Funcion = "encargado" | "visitador" | "ggo";

const FUNCIONES: { valor: Funcion; texto: string; detalle: string }[] = [
  { valor: "encargado", texto: "Encargado", detalle: "Ve el centro; reemplaza al encargado actual" },
  { valor: "visitador", texto: "Visitador", detalle: "Ve el centro; reemplaza al visitador actual" },
  { valor: "ggo", texto: "GGO", detalle: "Solo en los libros (costo empresa y prorrateado); se suma a la lista" },
];
const TEXTO_FUNCION: Record<Funcion, string> = { encargado: "Encargado", visitador: "Visitador", ggo: "GGO" };

export function coincide(busqueda: string, ...campos: (string | null | undefined)[]) {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  const texto = normalizar(campos.filter(Boolean).join(" "));
  return palabras.every((p) => texto.includes(p));
}

/** Frase corta con color según cuánto ve (todo / parte / nada). */
export function Acceso({ icono, rotulo, linea }: { icono: ReactNode; rotulo: string; linea: Linea }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 text-xs">
      <span className="text-faint shrink-0" aria-hidden>
        {icono}
      </span>
      <span className="text-muted shrink-0">{rotulo}:</span>
      <span className={cn("truncate", linea.tono === "todo" ? "text-text font-semibold" : linea.tono === "nada" ? "text-faint" : "text-text")}>{linea.texto}</span>
    </span>
  );
}

/** Opción grande con título y explicación (una de varias). */
function Opcion({ elegida, titulo, detalle, onElegir, deshabilitada }: { elegida: boolean; titulo: string; detalle: string; onElegir: () => void; deshabilitada?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegida}
      disabled={deshabilitada}
      onClick={onElegir}
      className={cn(
        "text-left flex flex-col gap-0.5 rounded-xl border px-3 py-2 transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50",
        elegida ? "border-flesan-red bg-flesan-red/5" : "border-border hover:border-muted",
      )}
    >
      <span className={cn("text-sm font-semibold", elegida ? "text-flesan-red" : "text-text")}>{titulo}</span>
      <span className="text-xs text-muted">{detalle}</span>
    </button>
  );
}

function Pregunta({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
        <span className="w-5 h-5 shrink-0 rounded-full bg-surface-2 text-[0.6875rem] text-muted inline-flex items-center justify-center">{numero}</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

interface CentroDePersona {
  sociedad: string;
  centroCoto: string;
  funciones: Funcion[];
  verPlanta: boolean;
  administrador: boolean;
}

interface CentroCatalogo {
  sociedad: string;
  centroCoto: string;
  encargado: string | null;
  visitador: string | null;
}

/**
 * Ficha de una persona: tres preguntas (qué hace en la plataforma, qué liquidaciones ve, qué libros
 * ve) y sus centros de costo, con el resumen de lo que ve arriba. Cada cambio se guarda al momento.
 * Las opciones son los mismos perfiles y roles de siempre, dichos por su efecto.
 */
export function FichaPersona({
  u,
  nombre,
  cargo,
  conteo,
  empresas,
  libros,
  onGuardar,
  onCambioCentros,
  onCerrar,
}: {
  u: UsuarioAsignado;
  nombre: string;
  cargo: string | null;
  conteo: ConteoCentros | null;
  empresas: { codigo: string; nombre: string }[];
  /** false sin db/005 aplicado: el rol de los libros no se edita. */
  libros: boolean;
  onGuardar: (u: Guardable, mensaje: string) => Promise<void>;
  onCambioCentros: () => void;
  onCerrar: () => void;
}) {
  const [eligiendoEmpresas, setEligiendoEmpresas] = useState(false);
  const nombreEmpresa = (c: string) => empresas.find((e) => e.codigo === c)?.nombre ?? c;
  const liq = eligiendoEmpresas ? "empresas" : accesoLiquidaciones(u);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="listbox"]')) onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  function elegirLiquidaciones(v: AccesoLiquidaciones) {
    setEligiendoEmpresas(false);
    if (v === liq && v !== "empresas") return;
    if (v === "todas") onGuardar({ ...u, perfil: "rrhh", empresas: null }, `${nombre} ve todas las liquidaciones.`);
    else if (v === "ninguna") onGuardar({ ...u, perfil: "sin_acceso", empresas: null }, `${nombre} ya no entra a Liquidaciones.`);
    else if (v === "centros") onGuardar({ ...u, perfil: "jefatura", empresas: null }, `${nombre} ve las liquidaciones de sus centros.`);
    // Empresas completas se guarda al elegir al menos una empresa.
    else if (!u.empresas?.length) setEligiendoEmpresas(true);
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/30 cursor-default" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="ficha-titulo"
        className="relative w-full max-w-[38rem] h-full bg-surface border-l border-border shadow-2xl flex flex-col animate-fade-in"
      >
        <header className="flex items-start gap-2 px-5 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 id="ficha-titulo" className="text-base font-bold text-text truncate">
              {nombre}
            </h2>
            <p className="text-xs text-muted truncate">{[cargo, u.correo].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-bg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex flex-col gap-6 p-5 overflow-y-auto">
          <div className="rounded-xl bg-surface-2 px-4 py-3 flex flex-col gap-1.5" aria-label="Lo que ve hoy">
            <span className="label-meta text-muted">Lo que ve hoy</span>
            <Acceso icono={<FileText className="w-3.5 h-3.5" />} rotulo="Liquidaciones" linea={lineaLiquidaciones(u, conteo, nombreEmpresa)} />
            <Acceso icono={<FileSpreadsheet className="w-3.5 h-3.5" />} rotulo="Libros y finiquitos" linea={lineaLibros(u.rolRemuneraciones, conteo)} />
            {u.rol === "admin" && <Acceso icono={<ShieldCheck className="w-3.5 h-3.5" />} rotulo="Plataforma" linea={{ texto: "Administrador (configura usuarios)", tono: "todo" }} />}
          </div>

          <Pregunta numero={1} titulo="¿Qué liquidaciones ve?">
            <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OPCIONES_LIQUIDACIONES.map((o) => (
                <Opcion key={o.valor} elegida={liq === o.valor} titulo={o.titulo} detalle={o.detalle} onElegir={() => elegirLiquidaciones(o.valor)} />
              ))}
            </div>
            {liq === "empresas" && (
              <Desplegable
                multiple
                variante="campo"
                etiqueta="Empresas completas"
                textoTodos="Elige las empresas"
                valor={u.empresas ?? []}
                onCambio={(v) => {
                  if (!v.length) return toast("Deja al menos una empresa, o elige otra opción.");
                  setEligiendoEmpresas(false);
                  onGuardar({ ...u, perfil: "jefatura", empresas: v }, `${nombre} ve todas las liquidaciones de ${v.map(nombreEmpresa).join(", ")}.`);
                }}
                opciones={empresas.map((e) => ({ valor: e.codigo, texto: e.nombre, detalle: e.codigo }))}
              />
            )}
          </Pregunta>

          <Pregunta numero={2} titulo="¿Qué libros de remuneraciones y finiquitos ve?">
            {!libros && <Nota titulo="Sin base">Falta aplicar db/005_remuneraciones.sql: el acceso a los libros no se puede editar.</Nota>}
            <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OPCIONES_LIBROS.map((o) => (
                <Opcion
                  key={o.valor}
                  elegida={(u.rolRemuneraciones === "administrador_obra" ? "administrativo_rrhh" : (u.rolRemuneraciones ?? "")) === o.valor}
                  titulo={o.titulo}
                  detalle={o.detalle}
                  deshabilitada={!libros}
                  onElegir={() => {
                    const r = (o.valor || null) as RolLibro | null;
                    if (r !== u.rolRemuneraciones) onGuardar({ ...u, rolRemuneraciones: r }, `${nombre}: libros «${o.titulo}».`);
                  }}
                />
              ))}
            </div>
          </Pregunta>

          <Pregunta numero={3} titulo="¿En qué centros de costo está?">
            <CentrosDePersona u={u} nombre={nombre} onCambio={onCambioCentros} />
          </Pregunta>

          <Pregunta numero={4} titulo="¿Administra la plataforma?">
            <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(
                [
                  { valor: "member", titulo: "No", detalle: "Usa los módulos según lo de arriba." },
                  { valor: "admin", titulo: "Sí, es administrador", detalle: "Además entra a Configuración y edita usuarios y centros." },
                ] as { valor: Rol; titulo: string; detalle: string }[]
              ).map((o) => (
                <Opcion
                  key={o.valor}
                  elegida={u.rol === o.valor}
                  titulo={o.titulo}
                  detalle={o.detalle}
                  onElegir={() => o.valor !== u.rol && onGuardar({ ...u, rol: o.valor }, `${nombre} ${o.valor === "admin" ? "ahora es administrador" : "ya no es administrador"}.`)}
                />
              ))}
            </div>
          </Pregunta>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

/**
 * Centros de una persona sobre la copia de tabla_encargados_cc: asignarla como encargado,
 * visitador o GGO de un centro de la tabla, o quitarla (como «Configurar Centros de Costos» del
 * PHP). Las marcas de planta del centro se muestran en palabras y no se editan.
 */
function CentrosDePersona({ u, nombre, onCambio }: { u: UsuarioAsignado; nombre: string; onCambio: () => void }) {
  const url = `/api/configuracion/encargados?correo=${encodeURIComponent(u.correo)}`;
  const { data, error, mutate } = useSWR<{ centros: CentroDePersona[]; catalogo: CentroCatalogo[] }>(url, fetcher, { revalidateOnFocus: false });
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<CentroCatalogo | null>(null);
  const [funcion, setFuncion] = useState<Funcion>("encargado");
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState("");
  const buscador = useRef<HTMLInputElement>(null);

  const resultados = busqueda.trim() && data ? data.catalogo.filter((c) => coincide(busqueda, c.centroCoto, c.sociedad)).slice(0, 40) : [];
  const actual = elegido ? (funcion === "encargado" ? elegido.encargado : funcion === "visitador" ? elegido.visitador : null) : null;
  const reemplaza = actual && actual.trim().toLowerCase() !== u.correo ? actual.trim() : null;
  const visibles = (data?.centros ?? []).filter((c) => coincide(filtro, c.centroCoto, c.sociedad));

  async function cambiar(c: { sociedad: string; centroCoto: string }, f: Funcion, asignar: boolean) {
    setOcupado(true);
    try {
      const r = await enviarJson<{ anterior: string | null }>("/api/configuracion/encargados", { correo: u.correo, ...c, funcion: f, asignar });
      await mutate();
      onCambio();
      const reemplazado = r.anterior && r.anterior.trim().toLowerCase() !== u.correo ? ` (reemplaza a ${r.anterior.trim()})` : "";
      toast.success(`${nombre} ${asignar ? "es" : "deja de ser"} ${TEXTO_FUNCION[f].toLowerCase()} de ${c.centroCoto}${reemplazado}.`);
      if (asignar) {
        setElegido(null);
        setBusqueda("");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Encargado y visitador ven el centro en Liquidaciones (perfil «Las de sus centros») y en el libro de remuneraciones y finiquitos «Sus centros»; GGO, en
        el libro de costo empresa y en el prorrateado.
      </p>

      <label className="relative block">
        <span className="sr-only">Buscar centro de costo para asignar</span>
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
        <input
          ref={buscador}
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setElegido(null);
          }}
          placeholder="Asignar a un centro: código, nombre o empresa…"
          className="field-input rounded-full! pl-10! w-full!"
        />
      </label>
      {busqueda.trim() && !elegido && (
        <ul className="flex flex-col max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
          {!data ? (
            <li className="px-3 py-2 text-sm text-muted">Cargando…</li>
          ) : resultados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">Ningún centro de la tabla coincide con «{busqueda}».</li>
          ) : (
            resultados.map((c) => (
              <li key={`${c.sociedad}|${c.centroCoto}`}>
                <button type="button" onClick={() => setElegido(c)} className="w-full text-left flex flex-col px-3 py-2 hover:bg-bg cursor-pointer">
                  <span className="text-sm text-text">{c.centroCoto}</span>
                  <span className="text-xs text-muted">{c.sociedad}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {elegido && (
        <div className="flex flex-col gap-2 rounded-xl border border-flesan-red/40 bg-flesan-red/5 p-3">
          <p className="text-sm text-text">
            {elegido.centroCoto} <span className="text-muted">· {elegido.sociedad}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Desplegable etiqueta="Como" conRotulo valor={funcion} onCambio={(v) => setFuncion(v as Funcion)} opciones={FUNCIONES} />
            <button type="button" disabled={ocupado} onClick={() => cambiar(elegido, funcion, true)} className="btn-flesan btn-flesan-primary btn-flesan-sm rounded-flesan ml-auto disabled:opacity-40">
              Asignar
            </button>
            <button type="button" onClick={() => setElegido(null)} className="btn-flesan btn-flesan-ghost btn-flesan-sm rounded-flesan">
              Cancelar
            </button>
          </div>
          {reemplaza && <p className="text-xs text-flesan-red">Hoy el {funcion} es {reemplaza}: dejará de serlo.</p>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="label-meta text-muted mr-auto">Sus centros ({data?.centros.length ?? "…"})</span>
        {(data?.centros.length ?? 0) > 8 && (
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar…" aria-label="Filtrar sus centros" className="field-input h-8! text-xs! w-40!" />
        )}
      </div>
      {error ? (
        <Nota tono="alerta" titulo="No se pudieron leer los centros">
          {error.message}
        </Nota>
      ) : !data ? (
        <div className="skeleton h-24 rounded-flesan" />
      ) : data.centros.length === 0 ? (
        <p className="text-sm text-muted">No es encargado, visitador ni GGO de ningún centro.</p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-border divide-y divide-border">
          {visibles.map((c) => (
            <li key={`${c.sociedad}|${c.centroCoto}`} className="flex flex-col gap-1.5 px-3 py-2">
              <span className="flex flex-col min-w-0">
                <span className="text-sm text-text truncate">{c.centroCoto}</span>
                <span className="text-xs text-muted truncate">{c.sociedad}</span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {c.funciones.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1 rounded-full bg-surface-2 text-xs text-text">
                    {TEXTO_FUNCION[f]}
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => cambiar(c, f, false)}
                      aria-label={`Quitar ${TEXTO_FUNCION[f].toLowerCase()} de ${c.centroCoto}`}
                      className="w-4 h-4 inline-flex items-center justify-center rounded-full text-faint hover:text-flesan-red cursor-pointer disabled:opacity-40"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {/* Las marcas de planta solo restringen a encargado y visitador; al GGO no lo afectan. */}
                {(c.funciones.includes("encargado") || c.funciones.includes("visitador")) && (
                  <MarcasPlanta verPlanta={c.verPlanta} administrador={c.administrador} />
                )}
              </span>
            </li>
          ))}
          {!visibles.length && <li className="px-3 py-3 text-sm text-muted">Ninguno coincide con el filtro.</li>}
        </ul>
      )}
    </div>
  );
}

/** Las marcas ver_planta y administrador del centro, en palabras. */
export function MarcasPlanta({ verPlanta, administrador }: { verPlanta: boolean; administrador: boolean }) {
  return (
    <>
      {verPlanta && (
        <span
          className="inline-flex items-center h-6 px-2.5 rounded-full border border-border text-xs text-muted"
          title="Marca ver_planta del centro: en Liquidaciones, encargado y visitador ven solo al personal no planta."
        >
          Liquidaciones: solo no planta
        </span>
      )}
      {administrador && (
        <span
          className="inline-flex items-center h-6 px-2.5 rounded-full border border-border text-xs text-muted"
          title="Marca administrador del centro: en el libro, el encargado que no es visitador ve solo al personal no planta de esta empresa."
        >
          Libro: solo no planta
        </span>
      )}
    </>
  );
}
