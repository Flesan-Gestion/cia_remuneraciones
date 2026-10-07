"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Lock } from "lucide-react";
import { Desplegable } from "@/components/desplegable";
import { cn } from "@/lib/cn";
import { periodoLegible } from "@/lib/liquidaciones/formato";
import { etiquetaRolLibro, exigeEmpresa, type EmpresaLibro, type FiltrosLibro, type RolLibro } from "@/lib/libro/tipos";
import { ALCANCE_FINIQUITOS, rangoSemanas, semanaLegible } from "@/lib/finiquitos/tipos";
import { Campo, EncabezadoTarjeta, fetcher, Nota } from "@/components/liquidaciones/ui";

interface DatosFiltros {
  rol: RolLibro | null;
  sinBase: boolean;
  empresas: EmpresaLibro[];
  periodos: string[];
  /** Solo finiquitos: si se muestran los filtros (el antiguo los escondía a quien no tenía centros). */
  formulario?: boolean;
}

interface Descarga {
  archivo: string;
  filas: number;
  personas: number;
  filtros: FiltrosLibro;
}

interface Modulo {
  api: string;
  /** Para los mensajes: «libro de remuneraciones», «libro prorrateado», «libro de finiquitos». */
  nombre: string;
  ayuda: string;
  /** Qué ve cada rol, en una línea (las reglas están en las consultas de cada módulo: lib/libro, lib/libro-prorrateado y lib/finiquitos). */
  alcance: Partial<Record<RolLibro, string>>;
  /** Sin empresas en la lista: el libro no deja generar; el prorrateado deja generar con «Todas»
   * cuando la razón social es opcional, como el aplicativo antiguo (finiquitos lo dice el servidor). */
  generaSinCentros: boolean;
  /** Si la razón social es obligatoria para el rol. */
  exigeEmpresa: (rol: RolLibro) => boolean;
  /** Periodo legible y rango de periodos («Septiembre 2026», «Septiembre 2026 Semana 1»). */
  periodo: (p: string) => string;
  rango: (desde: string, hasta: string) => string;
  etiquetaDesde: string;
  etiquetaHasta: string;
  /** Qué periodo se elige, al final de la línea del rol. */
  notaPeriodo: string;
  /** Qué se está consultando, mientras se genera. */
  consultando: string;
  /** Periodos con texto largo («Septiembre 2026 Semana 3»): los cuatro filtros van del mismo ancho. */
  periodoLargo?: boolean;
}

const ENCARGADO = "Las personas de los centros de costo donde eres encargado o visitador.";
const MESES = {
  exigeEmpresa,
  periodo: periodoLegible,
  rango: (desde: string, hasta: string) => (desde === hasta ? periodoLegible(desde) : `${periodoLegible(desde)} a ${periodoLegible(hasta)}`),
  etiquetaDesde: "Mes desde",
  etiquetaHasta: "Mes hasta",
  notaPeriodo: "El mes es el de pago de la liquidación.",
  consultando: "las liquidaciones",
};

const MODULOS: Record<"libro" | "prorrateado" | "finiquitos", Modulo> = {
  libro: {
    ...MESES,
    api: "/api/libro",
    nombre: "libro de remuneraciones",
    ayuda: "Una fila por persona, centro de costo y mes de pago, con cada concepto de la liquidación en una columna (solo los que tienen algún valor).",
    alcance: {
      administrador: "Todas las empresas; la razón social es opcional.",
      rrhh: "Todas las empresas, eligiendo una razón social.",
      administrativo_rrhh: ENCARGADO,
      administrador_obra: ENCARGADO,
      ggo: "Los centros de costo donde figuras como GGO. El libro trae solo el costo empresa.",
    },
    generaSinCentros: false,
  },
  prorrateado: {
    ...MESES,
    api: "/api/libro-prorrateado",
    nombre: "libro prorrateado",
    ayuda:
      "Una fila por persona, mes de pago y centro de costo de su distribución en SAP, con el porcentaje y cada concepto prorrateado en una columna (solo los que tienen algún valor). La razón social es la de la persona; el centro de costo, el de la distribución.",
    alcance: {
      administrador: "Todas las empresas; la razón social es opcional.",
      rrhh: "Todas las empresas, eligiendo una razón social.",
      ggo: "Los centros de costo donde figuras como GGO, con todos los conceptos.",
    },
    generaSinCentros: true,
  },
  finiquitos: {
    api: "/api/finiquitos",
    nombre: "libro de finiquitos",
    ayuda:
      "Tres hojas: el detalle de cada finiquito, con cada concepto en una columna (solo los que tienen algún valor), el resumen por persona y el resumen por obra. La razón social y el centro de costo son los del finiquito; ambos son opcionales.",
    alcance: ALCANCE_FINIQUITOS,
    generaSinCentros: true,
    exigeEmpresa: () => false,
    periodo: semanaLegible,
    rango: rangoSemanas,
    etiquetaDesde: "Semana desde",
    etiquetaHasta: "Semana hasta",
    notaPeriodo: "La semana es la de pago del finiquito.",
    consultando: "los finiquitos",
    periodoLargo: true,
  },
};

/**
 * Libro de remuneraciones, libro prorrateado y finiquitos: los filtros de los aplicativos antiguos
 * (razón social, centro de costo, periodo desde y hasta) y el Excel.
 */
export function GeneradorLibro({ modulo = "libro" }: { modulo?: keyof typeof MODULOS }) {
  const m = MODULOS[modulo];
  const { data, error, isLoading } = useSWR<DatosFiltros>(`${m.api}/filtros`, fetcher, { revalidateOnFocus: false });

  if (isLoading) return <div className="skeleton h-56 rounded-flesan" />;
  if (error || !data) return <Nota tono="alerta" titulo="No se pudieron cargar los filtros">{error?.message ?? "Intenta de nuevo en unos minutos."}</Nota>;
  if (!data.rol) {
    return (
      <div className="card dens-card flex items-start gap-3 max-w-2xl">
        <Lock className="w-5 h-5 text-muted shrink-0 mt-0.5" aria-hidden />
        <div className="text-sm text-muted">
          <p className="font-semibold text-text">No tienes acceso al {m.nombre}</p>
          {data.sinBase
            ? "No se pudo verificar tu acceso. Intenta de nuevo en unos minutos; si sigue, avisa al equipo CIA."
            : "Si lo necesitas para tu trabajo, pídelo a RR.HH."}
        </div>
      </div>
    );
  }
  return <Contenido datos={data} rol={data.rol} modulo={m} />;
}

function Contenido({ datos, rol, modulo }: { datos: DatosFiltros; rol: RolLibro; modulo: Modulo }) {
  const ultimo = datos.periodos[0] ?? "";
  // La empresa elegida es la opción (su clave, o el código); al servidor va el código.
  const [filtros, setFiltros] = useState<FiltrosLibro>({ empresa: null, cc: null, desde: ultimo, hasta: ultimo });
  const [generando, setGenerando] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [descarga, setDescarga] = useState<Descarga | null>(null);

  const porOpcion = useMemo(() => new Map(datos.empresas.map((e) => [e.clave ?? e.codigo, e])), [datos.empresas]);
  const centros = (filtros.empresa && porOpcion.get(filtros.empresa)?.centros) || [];
  const opcionesPeriodo = datos.periodos.map((p) => ({ valor: p, texto: modulo.periodo(p) }));
  const requiereEmpresa = modulo.exigeEmpresa(rol);
  const faltaEmpresa = requiereEmpresa && !filtros.empresa;
  const periodoInvalido = !filtros.desde || !filtros.hasta || filtros.desde > filtros.hasta;
  // Sin empresas en la lista no hay razón social que elegir; el prorrateado y finiquitos igual dejan
  // generar si es opcional (finiquitos, según lo que diga el servidor).
  const sinCentros = datos.formulario === undefined ? !datos.empresas.length && (requiereEmpresa || !modulo.generaSinCentros) : !datos.formulario;

  async function generar(f: FiltrosLibro) {
    setIntentado(true);
    if ((requiereEmpresa && !f.empresa) || !f.desde || !f.hasta || f.desde > f.hasta) return;
    setGenerando(true);
    const aviso = toast.loading(`Generando el ${modulo.nombre}…`);
    try {
      const cuerpo = { ...f, empresa: f.empresa ? (porOpcion.get(f.empresa)?.codigo ?? f.empresa) : null };
      const r = await fetch(`${modulo.api}/excel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      if (!r.ok) {
        const mensaje = (await r.json().catch(() => ({}))).error ?? "No se pudo generar el libro.";
        if (r.status === 404) {
          toast(mensaje, { id: aviso });
          setDescarga(null);
          return;
        }
        throw new Error(mensaje);
      }
      const archivo = r.headers.get("X-Archivo") ?? "Libro_remuneraciones.xlsx";
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = archivo;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDescarga({ archivo, filas: Number(r.headers.get("X-Filas") ?? 0), personas: Number(r.headers.get("X-Personas") ?? 0), filtros: f });
      toast.success("Libro descargado", { id: aviso });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el libro.", { id: aviso });
    } finally {
      setGenerando(false);
    }
  }

  const rango = (f: FiltrosLibro) => modulo.rango(f.desde, f.hasta);

  return (
    <div className="flex flex-col gap-5">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          generar(filtros);
        }}
        className="card dens-card flex flex-col gap-5"
      >
        <EncabezadoTarjeta icono={<FileSpreadsheet className="w-5 h-5" aria-hidden />} titulo="Generar libro">
          {modulo.ayuda}
        </EncabezadoTarjeta>

        {sinCentros ? (
          <Nota titulo="No tienes centros de costo asignados">
            Tu rol ({etiquetaRolLibro(rol)}) ve los centros de costo donde figuras como encargado, visitador o GGO, y hoy no apareces en ninguno. Pídelo a RR.HH.
          </Nota>
        ) : (
          <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", modulo.periodoLargo ? "xl:grid-cols-4" : "xl:grid-cols-6")}>
            <Campo etiqueta="Razón social" requerido={requiereEmpresa} className={modulo.periodoLargo ? undefined : "xl:col-span-2"}>
              <Desplegable
                variante="campo"
                etiqueta="Razón social"
                placeholder={requiereEmpresa ? "Selecciona" : "Todas"}
                valor={filtros.empresa ?? ""}
                invalido={intentado && faltaEmpresa}
                onCambio={(v) => setFiltros((f) => ({ ...f, empresa: v || null, cc: null }))}
                opciones={[
                  ...(requiereEmpresa ? [] : [{ valor: "", texto: "Todas" }]),
                  ...datos.empresas.map((e) => ({ valor: e.clave ?? e.codigo, texto: e.nombre, detalle: e.codigo })),
                ]}
              />
              {intentado && faltaEmpresa && <span className="text-xs text-flesan-red">Elige la razón social.</span>}
            </Campo>
            <Campo etiqueta="Centro de costo" className={modulo.periodoLargo ? undefined : "xl:col-span-2"}>
              <Desplegable
                variante="campo"
                etiqueta="Centro de costo"
                placeholder="Todos"
                deshabilitado={!filtros.empresa}
                valor={filtros.cc ?? ""}
                onCambio={(v) => setFiltros((f) => ({ ...f, cc: v || null }))}
                opciones={[{ valor: "", texto: "Todos" }, ...centros.map((c) => ({ valor: c.codigo, texto: `${c.codigo} - ${c.nombre}` }))]}
              />
            </Campo>
            <Campo etiqueta={modulo.etiquetaDesde} requerido>
              <Desplegable
                variante="campo"
                etiqueta={modulo.etiquetaDesde}
                valor={filtros.desde}
                invalido={intentado && periodoInvalido}
                onCambio={(v) => setFiltros((f) => ({ ...f, desde: v }))}
                opciones={opcionesPeriodo}
              />
            </Campo>
            <Campo etiqueta={modulo.etiquetaHasta} requerido>
              <Desplegable
                variante="campo"
                etiqueta={modulo.etiquetaHasta}
                valor={filtros.hasta}
                invalido={intentado && periodoInvalido}
                onCambio={(v) => setFiltros((f) => ({ ...f, hasta: v }))}
                opciones={opcionesPeriodo}
              />
              {intentado && periodoInvalido && <span className="text-xs text-flesan-red">«Desde» no puede ser posterior a «hasta».</span>}
            </Campo>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border">
          <p className="text-xs text-faint mr-auto pt-3">
            <span className="font-semibold text-muted">Rol {etiquetaRolLibro(rol)}:</span> {modulo.alcance[rol]} {modulo.notaPeriodo}
          </p>
          <button type="submit" className="btn-flesan btn-flesan-primary rounded-flesan mt-3" disabled={generando || sinCentros}>
            {generando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />}
            {generando ? "Generando…" : "Generar Excel"}
          </button>
        </div>
      </form>

      {generando && (
        <p className="text-sm text-muted flex items-center gap-2 animate-fade-in" role="status">
          <Loader2 className="w-4 h-4 animate-spin text-flesan-red" aria-hidden />
          Consultando {modulo.consultando} de {rango(filtros)}. Un mes completo toma unos segundos.
        </p>
      )}

      {descarga && !generando && (
        <section className="card dens-card flex flex-wrap items-center gap-4 animate-slide-up" aria-label="Última descarga">
          <CheckCircle2 className="w-6 h-6 text-status-ok shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text truncate">{descarga.archivo}</p>
            <p className="text-sm text-muted">
              {descarga.filas.toLocaleString("es-CL")} {descarga.filas === 1 ? "fila" : "filas"} · {descarga.personas.toLocaleString("es-CL")}{" "}
              {descarga.personas === 1 ? "persona" : "personas"} · {rango(descarga.filtros)}
              {descarga.filtros.empresa && ` · ${porOpcion.get(descarga.filtros.empresa)?.nombre ?? descarga.filtros.empresa}`}
              {descarga.filtros.cc && ` · CC ${descarga.filtros.cc}`}
            </p>
          </div>
          <button type="button" className="btn-flesan btn-flesan-ghost btn-flesan-sm rounded-flesan" onClick={() => generar(descarga.filtros)}>
            <Download className="w-4 h-4" aria-hidden />
            Descargar de nuevo
          </button>
        </section>
      )}
    </div>
  );
}
