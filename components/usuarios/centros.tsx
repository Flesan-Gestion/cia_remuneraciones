"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Search, X } from "lucide-react";
import { Desplegable } from "@/components/desplegable";
import { enviarJson, fetcher, Nota, Paginacion } from "@/components/liquidaciones/ui";
import { coincide, MarcasPlanta } from "@/components/usuarios/ficha";

interface Centro {
  sociedad: string;
  centroCoto: string;
  encargado: string | null;
  visitador: string | null;
  ggo: string[];
  verPlanta: boolean;
  administrador: boolean;
  filas: number;
}

type Funcion = "encargado" | "visitador" | "ggo";

const POR_PAGINA = 50;
const SIN_FILTRO = "";

/**
 * Pestaña «Centros de costo»: la copia de tabla_encargados_cc vista por centro (como «Configurar
 * Centros de Costos» del PHP). Encargado y visitador se cambian en la fila (reemplazan al anterior);
 * los GGO se suman o quitan. Las marcas de planta se muestran en palabras y no se editan.
 */
export function CentrosCosto({ personas, onCambio }: { personas: { correo: string; nombre: string }[]; onCambio: () => void }) {
  const { data, error, isLoading, mutate } = useSWR<{ centros: Centro[] }>("/api/configuracion/encargados", fetcher, { revalidateOnFocus: false });
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState(SIN_FILTRO);
  const [pagina, setPagina] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  const nombre = useMemo(() => new Map(personas.map((p) => [p.correo, p.nombre])), [personas]);
  const nombreDe = (correo: string) => nombre.get(correo.trim().toLowerCase()) ?? correo;
  const opcionesPersona = useMemo(
    () => [...personas].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((p) => ({ valor: p.correo, texto: p.nombre, detalle: p.correo })),
    [personas],
  );

  const centros = useMemo(() => data?.centros ?? [], [data]);
  const filtrados = useMemo(
    () =>
      centros.filter((c) => {
        if (filtro === "sin_encargado" && c.encargado) return false;
        if (filtro === "sin_visitador" && c.visitador) return false;
        const personasDelCentro = [c.encargado, c.visitador, ...c.ggo].filter(Boolean) as string[];
        return coincide(busqueda, c.centroCoto, c.sociedad, ...personasDelCentro, ...personasDelCentro.map(nombreDe));
      }),
    // nombreDe depende de `nombre`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centros, busqueda, filtro, nombre],
  );
  useEffect(() => setPagina(0), [busqueda, filtro]);

  if (isLoading) return <div className="skeleton h-64 rounded-flesan" />;
  if (error || !data) return <Nota tono="alerta" titulo="No se pudo leer la tabla de encargados">{error?.message ?? "Intenta de nuevo."}</Nota>;

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  async function cambiar(c: Centro, funcion: Funcion, correo: string, asignar: boolean) {
    setOcupado(true);
    try {
      await enviarJson("/api/configuracion/encargados", { correo, sociedad: c.sociedad, centroCoto: c.centroCoto, funcion, asignar });
      await mutate();
      onCambio();
      const quien = nombreDe(correo);
      toast.success(asignar ? `${quien} es ${funcion === "ggo" ? "GGO" : funcion} de ${c.centroCoto}.` : `${quien} deja de ser ${funcion === "ggo" ? "GGO" : funcion} de ${c.centroCoto}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }

  /** Encargado o visitador: elegir a otra persona la reemplaza; «Nadie» deja la columna vacía. */
  function persona(c: Centro, funcion: "encargado" | "visitador") {
    const actual = c[funcion];
    const valor = actual?.toLowerCase() ?? "";
    const opciones = [
      { valor: "", texto: "Nadie" },
      ...(actual && !nombre.has(valor) ? [{ valor, texto: actual }] : []),
      ...opcionesPersona,
    ];
    return (
      <Desplegable
        etiqueta={`${funcion === "encargado" ? "Encargado" : "Visitador"} de ${c.centroCoto}`}
        valor={valor}
        deshabilitado={ocupado}
        buscarDesde={8}
        onCambio={(v) => {
          if (v === valor) return;
          if (v) cambiar(c, funcion, v, true);
          else if (actual) cambiar(c, funcion, actual, false);
        }}
        opciones={opciones}
        claseBoton="h-8! text-xs! w-52 justify-between"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-96">
          <span className="sr-only">Buscar centro de costo</span>
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Centro, empresa o persona…" className="field-input rounded-full! pl-10! w-full!" />
        </label>
        <Desplegable
          variante="filtro"
          etiqueta="Mostrar"
          valor={filtro}
          activo={filtro !== SIN_FILTRO}
          onCambio={setFiltro}
          opciones={[
            { valor: SIN_FILTRO, texto: "Todos", detalle: String(centros.length) },
            { valor: "sin_encargado", texto: "Sin encargado", detalle: String(centros.filter((c) => !c.encargado).length) },
            { valor: "sin_visitador", texto: "Sin visitador", detalle: String(centros.filter((c) => !c.visitador).length) },
          ]}
        />
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border bg-surface-2">
                {["Centro de costo", "Encargado", "Visitador", "GGO (costo empresa)"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-label text-[0.6875rem] tracking-[0.1em] uppercase text-muted font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((c) => (
                <tr key={`${c.sociedad}|${c.centroCoto}`} className="hover:bg-surface-2/60 align-top">
                  <td className="px-4 py-2.5 min-w-72">
                    <span className="block font-semibold text-text">{c.centroCoto}</span>
                    <span className="block text-xs text-muted">
                      {c.sociedad}
                      {c.filas > 1 && ` · ${c.filas} filas en la tabla (se editan juntas)`}
                    </span>
                    {(c.verPlanta || c.administrador) && (
                      <span className="flex flex-wrap gap-1.5 mt-1.5">
                        <MarcasPlanta verPlanta={c.verPlanta} administrador={c.administrador} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {persona(c, "encargado")}
                  </td>
                  <td className="px-4 py-2.5">
                    {persona(c, "visitador")}
                  </td>
                  <td className="px-4 py-2.5 min-w-64">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {c.ggo.map((g, i) => (
                        <span key={`${g}-${i}`} className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1 rounded-full bg-surface-2 text-xs text-text" title={g}>
                          {nombreDe(g)}
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => cambiar(c, "ggo", g, false)}
                            aria-label={`Quitar a ${nombreDe(g)} como GGO de ${c.centroCoto}`}
                            className="w-4 h-4 inline-flex items-center justify-center rounded-full text-faint hover:text-flesan-red cursor-pointer disabled:opacity-40"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <Desplegable
                        variante="libre"
                        etiqueta={`Agregar GGO a ${c.centroCoto}`}
                        valor=""
                        deshabilitado={ocupado}
                        buscarDesde={8}
                        onCambio={(v) => v && cambiar(c, "ggo", v, true)}
                        opciones={opcionesPersona.filter((o) => !c.ggo.some((g) => g.toLowerCase() === o.valor))}
                        claseBoton="h-6 w-6 inline-flex items-center justify-center rounded-full border border-dashed border-border text-faint hover:text-flesan-red hover:border-flesan-red cursor-pointer"
                      >
                        <Plus className="w-3 h-3" aria-hidden />
                      </Desplegable>
                    </span>
                  </td>
                </tr>
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Ningún centro coincide.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Paginacion pagina={pagina} paginas={paginas} onCambio={setPagina} total={filtrados.length} unidad="centros" />
      </div>
      <p className="text-xs text-faint">
        Para asignar a alguien que no aparece en las listas, agrégalo primero en la pestaña Personas. Encargado y visitador ven el centro en Liquidaciones, en el
        libro de remuneraciones y en finiquitos; GGO, solo en los libros: el de costo empresa y el prorrateado.
      </p>
    </div>
  );
}
