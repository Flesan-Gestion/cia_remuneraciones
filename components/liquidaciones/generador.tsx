"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Download, FileText, Loader2, Lock, Search } from "lucide-react";
import { Desplegable } from "@/components/desplegable";
import { formatearRut, normalizar, periodoLegible, pesos } from "@/lib/liquidaciones/formato";
import { etiquetaPerfil, type Empresa, type FilaVista, type Filtros, type Perfil } from "@/lib/liquidaciones/tipos";
import { Campo, Casilla, EncabezadoTarjeta, enviarJson, Estado, fetcher, Nota, Paginacion, Th } from "@/components/liquidaciones/ui";

interface DatosFiltros {
  perfil: Perfil;
  sinBase: boolean;
  empresas: Empresa[];
  periodos: string[];
}

const POR_PAGINA = 50;

/**
 * Liquidaciones: los filtros del aplicativo antiguo (razón social, centro de costo, periodo,
 * persona, planta), una vista previa con lo que se va a descargar y el PDF de lo elegido.
 */
export function GeneradorLiquidaciones() {
  const { data, error, isLoading } = useSWR<DatosFiltros>("/api/liquidaciones/filtros", fetcher, { revalidateOnFocus: false });

  if (isLoading) return <div className="skeleton h-48 rounded-flesan" />;
  if (error || !data)
    return (
      <Nota tono="alerta" titulo="No se pudieron cargar los filtros">
        {error?.message ?? "Intenta de nuevo en unos minutos."}
      </Nota>
    );
  if (data.perfil === "sin_acceso") {
    return (
      <div className="card dens-card flex items-start gap-3 max-w-2xl">
        <Lock className="w-5 h-5 text-muted shrink-0 mt-0.5" aria-hidden />
        <div className="text-sm text-muted">
          <p className="font-semibold text-text">No tienes acceso a liquidaciones</p>
          {data.sinBase
            ? "No se pudo verificar tu acceso. Intenta de nuevo en unos minutos; si sigue, avisa al equipo CIA."
            : "Si lo necesitas para tu trabajo, pídelo al área de Personas."}
        </div>
      </div>
    );
  }
  return <Contenido datos={data} />;
}

function Contenido({ datos }: { datos: DatosFiltros }) {
  const rrhh = datos.perfil === "rrhh";
  const ultimo = datos.periodos[0] ?? "";
  const [filtros, setFiltros] = useState<Filtros>({
    empresa: null,
    cc: null,
    desde: ultimo,
    hasta: ultimo,
    persona: null,
    planta: null,
  });
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<{
    filtros: Filtros;
    filas: FilaVista[];
  } | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(0);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);

  const nombreEmpresa = useMemo(() => new Map(datos.empresas.map((e) => [e.codigo, e.nombre])), [datos.empresas]);
  const centros = datos.empresas.find((e) => e.codigo === filtros.empresa)?.centros ?? [];
  const opcionesPeriodo = datos.periodos.map((p) => ({
    valor: p,
    texto: periodoLegible(p),
  }));
  // El original exigía la empresa a las jefaturas.
  const faltaEmpresa = !rrhh && !filtros.empresa;
  const periodoInvalido = !filtros.desde || !filtros.hasta || filtros.desde > filtros.hasta;
  const sinCentros = !datos.empresas.length;

  const cambiar = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setFiltros((f) => ({ ...f, [k]: v }));

  async function buscar() {
    setIntentado(true);
    if (faltaEmpresa || periodoInvalido) return;
    setBuscando(true);
    try {
      const { filas } = await enviarJson<{ filas: FilaVista[] }>("/api/liquidaciones/buscar", filtros);
      setResultado({ filtros, filas });
      setSeleccion(new Set(filas.map((f) => f.clave)));
      setTexto("");
      setPagina(0);
      if (!filas.length) toast("Sin resultados para esos filtros.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo buscar.");
    } finally {
      setBuscando(false);
    }
  }

  async function descargar(claves: string[], id: string) {
    if (!resultado || !claves.length) return;
    setDescargando(id);
    const aviso = toast.loading(claves.length === 1 ? "Generando la liquidación…" : `Generando ${claves.length} liquidaciones…`);
    try {
      const r = await fetch("/api/liquidaciones/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filtros: resultado.filtros, claves }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo generar el PDF.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "liquidacion.pdf";
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado", { id: aviso });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF.", { id: aviso });
    } finally {
      setDescargando(null);
    }
  }

  const filtradas = useMemo(() => {
    const filas = resultado?.filas ?? [];
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    if (!palabras.length) return filas;
    return filas.filter((f) => {
      const t = normalizar(`${f.nombre} ${f.numero_de_personal} ${f.rut ?? ""} ${formatearRut(f.rut)} ${f.centro_costo ?? ""} ${f.nombre_cc ?? ""}`);
      return palabras.every((p) => t.includes(p));
    });
  }, [resultado, texto]);
  useEffect(() => setPagina(0), [texto]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visibles = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const marcadasVisibles = filtradas.filter((f) => seleccion.has(f.clave)).length;
  const todas = filtradas.length > 0 && marcadasVisibles === filtradas.length;
  const personas = new Set((resultado?.filas ?? []).map((f) => f.numero_de_personal)).size;
  const elegidas = (resultado?.filas ?? []).filter((f) => seleccion.has(f.clave)).map((f) => f.clave);

  function alternar(clave: string, marcar: boolean) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (marcar) n.add(clave);
      else n.delete(clave);
      return n;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
        className="card dens-card flex flex-col gap-5"
      >
        <EncabezadoTarjeta icono={<FileText className="w-5 h-5" aria-hidden />} titulo="Buscar liquidaciones">
          Revisa la lista de lo que calza con los filtros y descarga en un PDF las liquidaciones que elijas.
        </EncabezadoTarjeta>

        {sinCentros ? (
          <Nota titulo="No tienes centros de costo asignados">
            El perfil Jefatura ve las liquidaciones de los centros de costo donde figuras como encargado o visitador, y hoy no apareces en ninguno. Pídelo a RR.HH.
          </Nota>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
            <Campo etiqueta="Razón social" requerido={!rrhh} className="xl:col-span-2">
              <Desplegable
                variante="campo"
                etiqueta="Razón social"
                placeholder={rrhh ? "Todas" : "Selecciona"}
                valor={filtros.empresa ?? ""}
                invalido={intentado && faltaEmpresa}
                onCambio={(v) => setFiltros((f) => ({ ...f, empresa: v || null, cc: null }))}
                opciones={[
                  ...(rrhh ? [{ valor: "", texto: "Todas" }] : []),
                  ...datos.empresas.map((e) => ({
                    valor: e.codigo,
                    texto: e.nombre,
                    detalle: e.codigo,
                  })),
                ]}
              />
              {intentado && faltaEmpresa && <span className="text-xs text-flesan-red">Elige la razón social.</span>}
            </Campo>
            <Campo etiqueta="Centro de costo" className="xl:col-span-2">
              <Desplegable
                variante="campo"
                etiqueta="Centro de costo"
                placeholder="Todos"
                deshabilitado={!filtros.empresa}
                valor={filtros.cc ?? ""}
                onCambio={(v) => cambiar("cc", v || null)}
                opciones={[
                  { valor: "", texto: "Todos" },
                  ...centros.map((c) => ({
                    valor: c.codigo,
                    texto: `${c.codigo} - ${c.nombre}`,
                  })),
                ]}
              />
            </Campo>
            <Campo etiqueta="Periodo desde" requerido>
              <Desplegable
                variante="campo"
                etiqueta="Periodo desde"
                valor={filtros.desde}
                invalido={intentado && periodoInvalido}
                onCambio={(v) => cambiar("desde", v)}
                opciones={opcionesPeriodo}
              />
            </Campo>
            <Campo etiqueta="Periodo hasta" requerido>
              <Desplegable
                variante="campo"
                etiqueta="Periodo hasta"
                valor={filtros.hasta}
                invalido={intentado && periodoInvalido}
                onCambio={(v) => cambiar("hasta", v)}
                opciones={opcionesPeriodo}
              />
              {intentado && periodoInvalido && <span className="text-xs text-flesan-red">«Desde» no puede ser posterior a «hasta».</span>}
            </Campo>
            <Campo etiqueta="Persona" className="xl:col-span-4">
              <input
                className="field-input"
                placeholder="N° de personal, RUT o nombre"
                value={filtros.persona ?? ""}
                maxLength={80}
                onChange={(e) => cambiar("persona", e.target.value || null)}
              />
            </Campo>
            <Campo etiqueta="Planta o no planta" className="xl:col-span-2">
              <Desplegable
                variante="campo"
                etiqueta="Planta o no planta"
                valor={filtros.planta ?? ""}
                onCambio={(v) => cambiar("planta", (v || null) as Filtros["planta"])}
                opciones={[
                  { valor: "", texto: "Todos" },
                  { valor: "PL", texto: "Planta" },
                  { valor: "NP", texto: "No planta" },
                ]}
              />
            </Campo>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border">
          <p className="text-xs text-faint mr-auto pt-3">
            <span className="font-semibold text-muted">Perfil {etiquetaPerfil(datos.perfil)}:</span>{" "}
            {rrhh ? "Todas las empresas." : "Las liquidaciones de los centros de costo donde eres encargado o visitador."}
          </p>
          <button type="submit" className="btn-flesan btn-flesan-primary rounded-flesan mt-3" disabled={buscando || sinCentros}>
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Search className="w-4 h-4" aria-hidden />}
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </form>

      {resultado && (
        <section className="flex flex-col gap-3" aria-label="Liquidaciones encontradas">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">
              <b className="text-text">{resultado.filas.length}</b> {resultado.filas.length === 1 ? "liquidación" : "liquidaciones"} de{" "}
              <b className="text-text">{personas}</b> {personas === 1 ? "persona" : "personas"}
            </p>
            <label className="relative w-full sm:w-80 sm:ml-auto">
              <span className="sr-only">Filtrar la lista</span>
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Filtrar por nombre, RUT o CC…"
                className="field-input rounded-full! pl-10! w-full!"
              />
            </label>
            <button
              type="button"
              className="btn-flesan btn-flesan-primary rounded-flesan"
              disabled={!elegidas.length || descargando !== null}
              onClick={() => descargar(elegidas, "todas")}
            >
              <Download className="w-4 h-4" aria-hidden />
              Descargar PDF ({elegidas.length})
            </button>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    <th scope="col" className="pl-4 pr-1 py-2.5 w-8">
                      <Casilla
                        etiqueta={todas ? "Quitar todas" : "Elegir todas"}
                        marcada={todas}
                        indeterminada={marcadasVisibles > 0 && !todas}
                        onCambio={(m) =>
                          setSeleccion((s) => {
                            const n = new Set(s);
                            for (const f of filtradas) {
                              if (m) n.add(f.clave);
                              else n.delete(f.clave);
                            }
                            return n;
                          })
                        }
                      />
                    </th>
                    <Th>Nombre</Th>
                    <Th>N° personal</Th>
                    <Th>RUT</Th>
                    <Th>Empresa</Th>
                    <Th>Centro de costo</Th>
                    <Th>Periodo</Th>
                    <Th derecha>Líquido</Th>
                    <Th>
                      <span className="sr-only">Descargar</span>
                    </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibles.map((f) => (
                    <tr key={f.clave} className="hover:bg-surface-2/60">
                      <td className="pl-4 pr-1 py-2">
                        <Casilla etiqueta={`Elegir a ${f.nombre}`} marcada={seleccion.has(f.clave)} onCambio={(m) => alternar(f.clave, m)} />
                      </td>
                      <td className="px-3 py-2 font-semibold text-text min-w-56">{f.nombre}</td>
                      <td className="px-3 py-2 text-muted tabular-nums">{f.numero_de_personal}</td>
                      <td className="px-3 py-2 text-muted tabular-nums whitespace-nowrap">{formatearRut(f.rut)}</td>
                      <td className="px-3 py-2 text-muted" title={nombreEmpresa.get(f.sociedad)}>
                        {f.sociedad}
                      </td>
                      <td className="px-3 py-2 text-muted min-w-48">
                        <span className="block">{f.centro_costo ?? "—"}</span>
                        {f.nombre_cc && <span className="block text-xs text-faint">{f.nombre_cc}</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {periodoLegible(f.periodo_efectivo)}
                        {f.fuera_de_ciclo && (
                          <span className="ml-2">
                            <Estado tono="info">Fuera de ciclo</Estado>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{pesos(f.liquido)}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => descargar([f.clave], f.clave)}
                          disabled={descargando !== null}
                          aria-label={`Descargar la liquidación de ${f.nombre}`}
                          title="Descargar esta liquidación"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-faint hover:text-flesan-red hover:bg-bg cursor-pointer disabled:opacity-40"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!visibles.length && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted">
                        {resultado.filas.length ? "Nadie coincide con el filtro." : "Sin resultados para esos filtros."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Paginacion pagina={pagina} paginas={paginas} onCambio={setPagina} total={filtradas.length} unidad="liquidaciones" />
          </div>
        </section>
      )}
    </div>
  );
}
