"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Lock } from "lucide-react";
import { Desplegable } from "@/components/desplegable";
import { periodoLegible } from "@/lib/liquidaciones/formato";
import { etiquetaRolLibro, exigeEmpresa, type EmpresaLibro, type FiltrosLibro, type RolLibro } from "@/lib/libro/tipos";
import { Campo, EncabezadoTarjeta, fetcher, Nota } from "@/components/liquidaciones/ui";

interface DatosFiltros {
  rol: RolLibro | null;
  sinBase: boolean;
  empresas: EmpresaLibro[];
  periodos: string[];
}

interface Descarga {
  archivo: string;
  filas: number;
  personas: number;
  filtros: FiltrosLibro;
}

/** Qué ve cada rol, en una línea (las reglas están en lib/libro/consultas.ts). */
const ALCANCE: Record<RolLibro, string> = {
  administrador: "Todas las empresas; la razón social es opcional.",
  rrhh: "Todas las empresas, eligiendo una razón social.",
  administrativo_rrhh: "Las personas de los centros de costo donde eres encargado o visitador.",
  administrador_obra: "Las personas de los centros de costo donde eres encargado o visitador.",
  ggo: "Los centros de costo donde figuras como GGO. El libro trae solo el costo empresa.",
};

/**
 * Libro de remuneraciones: los filtros del aplicativo antiguo (razón social, centro de costo,
 * mes desde y hasta) y el Excel con una fila por persona, CC y mes de pago.
 */
export function GeneradorLibro() {
  const { data, error, isLoading } = useSWR<DatosFiltros>("/api/libro/filtros", fetcher, { revalidateOnFocus: false });

  if (isLoading) return <div className="skeleton h-56 rounded-flesan" />;
  if (error || !data) return <Nota tono="alerta" titulo="No se pudieron cargar los filtros">{error?.message ?? "Intenta de nuevo en unos minutos."}</Nota>;
  if (!data.rol) {
    return (
      <div className="card dens-card flex items-start gap-3 max-w-2xl">
        <Lock className="w-5 h-5 text-muted shrink-0 mt-0.5" aria-hidden />
        <div className="text-sm text-muted">
          <p className="font-semibold text-text">No tienes acceso al libro de remuneraciones</p>
          {data.sinBase
            ? "No se pudo verificar tu acceso. Intenta de nuevo en unos minutos; si sigue, avisa al equipo CIA."
            : "Si lo necesitas para tu trabajo, pídelo a RR.HH."}
        </div>
      </div>
    );
  }
  return <Contenido datos={data} rol={data.rol} />;
}

function Contenido({ datos, rol }: { datos: DatosFiltros; rol: RolLibro }) {
  const ultimo = datos.periodos[0] ?? "";
  const [filtros, setFiltros] = useState<FiltrosLibro>({ empresa: null, cc: null, desde: ultimo, hasta: ultimo });
  const [generando, setGenerando] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [descarga, setDescarga] = useState<Descarga | null>(null);

  const nombreEmpresa = useMemo(() => new Map(datos.empresas.map((e) => [e.codigo, e.nombre])), [datos.empresas]);
  const centros = datos.empresas.find((e) => e.codigo === filtros.empresa)?.centros ?? [];
  const opcionesPeriodo = datos.periodos.map((p) => ({ valor: p, texto: periodoLegible(p) }));
  const requiereEmpresa = exigeEmpresa(rol);
  const faltaEmpresa = requiereEmpresa && !filtros.empresa;
  const periodoInvalido = !filtros.desde || !filtros.hasta || filtros.desde > filtros.hasta;
  const sinCentros = !datos.empresas.length;

  async function generar(f: FiltrosLibro) {
    setIntentado(true);
    if ((requiereEmpresa && !f.empresa) || !f.desde || !f.hasta || f.desde > f.hasta) return;
    setGenerando(true);
    const aviso = toast.loading("Generando el libro de remuneraciones…");
    try {
      const r = await fetch("/api/libro/excel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
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

  const rango = (f: FiltrosLibro) => (f.desde === f.hasta ? periodoLegible(f.desde) : `${periodoLegible(f.desde)} a ${periodoLegible(f.hasta)}`);

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
          Una fila por persona, centro de costo y mes de pago, con cada concepto de la liquidación en una columna (solo los que tienen algún valor).
        </EncabezadoTarjeta>

        {sinCentros ? (
          <Nota titulo="No tienes centros de costo asignados">
            Tu rol ({etiquetaRolLibro(rol)}) ve los centros de costo donde figuras como encargado, visitador o GGO, y hoy no apareces en ninguno. Pídelo a RR.HH.
          </Nota>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
            <Campo etiqueta="Razón social" requerido={requiereEmpresa} className="xl:col-span-2">
              <Desplegable
                variante="campo"
                etiqueta="Razón social"
                placeholder={requiereEmpresa ? "Selecciona" : "Todas"}
                valor={filtros.empresa ?? ""}
                invalido={intentado && faltaEmpresa}
                onCambio={(v) => setFiltros((f) => ({ ...f, empresa: v || null, cc: null }))}
                opciones={[...(requiereEmpresa ? [] : [{ valor: "", texto: "Todas" }]), ...datos.empresas.map((e) => ({ valor: e.codigo, texto: e.nombre, detalle: e.codigo }))]}
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
                onCambio={(v) => setFiltros((f) => ({ ...f, cc: v || null }))}
                opciones={[{ valor: "", texto: "Todos" }, ...centros.map((c) => ({ valor: c.codigo, texto: `${c.codigo} - ${c.nombre}` }))]}
              />
            </Campo>
            <Campo etiqueta="Mes desde" requerido>
              <Desplegable
                variante="campo"
                etiqueta="Mes desde"
                valor={filtros.desde}
                invalido={intentado && periodoInvalido}
                onCambio={(v) => setFiltros((f) => ({ ...f, desde: v }))}
                opciones={opcionesPeriodo}
              />
            </Campo>
            <Campo etiqueta="Mes hasta" requerido>
              <Desplegable
                variante="campo"
                etiqueta="Mes hasta"
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
            <span className="font-semibold text-muted">Rol {etiquetaRolLibro(rol)}:</span> {ALCANCE[rol]} El mes es el de pago de la liquidación.
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
          Consultando las liquidaciones de {rango(filtros)}. Un mes completo toma unos segundos.
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
              {descarga.filtros.empresa && ` · ${nombreEmpresa.get(descarga.filtros.empresa) ?? descarga.filtros.empresa}`}
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
