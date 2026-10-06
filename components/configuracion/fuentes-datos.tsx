"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { AvisoMaqueta, duracion, fechaHora } from "@/components/configuracion/maqueta";
import { Desplegable } from "@/components/desplegable";

// MAQUETA · Configuración › Fuentes de datos (solo administradores). Datos de ejemplo.
// En una plataforma: tablas fuentes_datos + cargas_datos (plan en docs/SHELL.md); el indicador
// «Al día / Atrasado» de la barra toma la fuente más atrasada.

type Estado = "ok" | "error" | "en_curso";
interface Fuente {
  clave: string;
  nombre: string;
  detalle: string;
  origen: string;
  cadaHoras: number;
  ultima: Date;
  filas: number;
}
interface Carga {
  id: number;
  fuente: string;
  inicio: Date;
  ms: number;
  estado: Estado;
  filas: number | null;
  detalle: string;
  quien: string;
}

const H = 3_600_000;

function datosEjemplo(ahora: number) {
  const hace = (h: number) => new Date(ahora - h * H);
  const fuentes: Fuente[] = [
    { clave: "negocios", nombre: "HubSpot · negocios", detalle: "Pipeline comercial", origen: "API HubSpot", cadaHoras: 2, ultima: hace(0.6), filas: 1840 },
    { clave: "facturacion", nombre: "Facturación", detalle: "Documentos emitidos", origen: "DW Procesos (solo lectura)", cadaHoras: 2, ultima: hace(6.2), filas: 22310 },
    { clave: "colaboradores", nombre: "Maestro de colaboradores", detalle: "Nombres, cargos y áreas", origen: "Base transaccional (solo lectura)", cadaHoras: 24, ultima: hace(3.1), filas: 9120 },
    { clave: "centros", nombre: "Centros de gestión", detalle: "Obras y unidades de negocio", origen: "Base transaccional (solo lectura)", cadaHoras: 24, ultima: hace(3.1), filas: 1488 },
  ];
  const cargas: Carga[] = [
    { id: 9, fuente: "negocios", inicio: hace(0.6), ms: 42_000, estado: "ok", filas: 1840, detalle: "", quien: "Programada" },
    { id: 8, fuente: "facturacion", inicio: hace(2.2), ms: 70_000, estado: "error", filas: null, detalle: "Tiempo de espera agotado al leer el DW", quien: "Programada" },
    { id: 7, fuente: "negocios", inicio: hace(2.6), ms: 39_000, estado: "ok", filas: 1832, detalle: "", quien: "Programada" },
    { id: 6, fuente: "colaboradores", inicio: hace(3.1), ms: 18_000, estado: "ok", filas: 9120, detalle: "", quien: "Programada" },
    { id: 5, fuente: "centros", inicio: hace(3.1), ms: 6_000, estado: "ok", filas: 1488, detalle: "", quien: "Programada" },
    { id: 4, fuente: "facturacion", inicio: hace(4.2), ms: 81_000, estado: "error", filas: null, detalle: "Tiempo de espera agotado al leer el DW", quien: "Programada" },
    { id: 3, fuente: "facturacion", inicio: hace(6.2), ms: 55_000, estado: "ok", filas: 22310, detalle: "", quien: "administrador@flesan.cl" },
  ];
  return { fuentes, cargas };
}

function estadoFuente(f: Fuente, ahora: number, enCurso: boolean): { texto: string; clase: string } {
  if (enCurso) return { texto: "Cargando…", clase: "text-muted border-border-strong" };
  const horas = (ahora - f.ultima.getTime()) / H;
  if (horas > f.cadaHoras) return { texto: `Atrasada ${Math.round(horas - f.cadaHoras)} h`, clase: "fuente-atrasada" };
  return { texto: "Al día", clase: "fuente-al-dia" };
}

const ESTADO_CARGA: Record<Estado, { texto: string; punto: string }> = {
  ok: { texto: "OK", punto: "bg-status-ok" },
  error: { texto: "Falló", punto: "bg-flesan-red" },
  en_curso: { texto: "En curso", punto: "bg-faint" },
};

export function FuentesDatos() {
  const [ahora, setAhora] = useState<number | null>(null);
  const [fuentes, setFuentes] = useState<Fuente[]>([]);
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [cargando, setCargando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("todas");

  useEffect(() => {
    const t = Date.now();
    const d = datosEjemplo(t);
    setAhora(t);
    setFuentes(d.fuentes);
    setCargas(d.cargas);
  }, []);

  if (ahora === null) return <div className="skeleton h-64 rounded-flesan" />;

  function cargarAhora(f: Fuente) {
    setCargando(f.clave);
    const inicio = new Date();
    const id = Math.max(...cargas.map((c) => c.id)) + 1;
    setCargas((cs) => [{ id, fuente: f.clave, inicio, ms: 0, estado: "en_curso", filas: null, detalle: "", quien: "tú" }, ...cs]);
    // Maqueta: simula una carga de 2 segundos que termina bien.
    setTimeout(() => {
      const fin = Date.now();
      setCargas((cs) => cs.map((c) => (c.id === id ? { ...c, estado: "ok", ms: fin - inicio.getTime(), filas: f.filas + 7 } : c)));
      setFuentes((fs) => fs.map((x) => (x.clave === f.clave ? { ...x, ultima: new Date(fin), filas: f.filas + 7 } : x)));
      setAhora(fin);
      setCargando(null);
      toast.success(`${f.nombre}: carga terminada`);
    }, 2000);
  }

  const nombre = (clave: string) => fuentes.find((f) => f.clave === clave)?.nombre ?? clave;
  const visibles = filtro === "todas" ? cargas : cargas.filter((c) => c.fuente === filtro);

  return (
    <div className="flex flex-col gap-5">
      <AvisoMaqueta tablas="fuentes_datos y cargas_datos" />

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border bg-surface-2">
              {["Fuente", "Origen", "Se espera cada", "Última carga", "Estado", "Filas", ""].map((h) => (
                <th key={h} className={cn("px-4 py-2.5 font-label text-[0.6875rem] tracking-[0.1em] uppercase text-muted font-semibold", h === "Filas" && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fuentes.map((f) => {
              const e = estadoFuente(f, ahora, cargando === f.clave);
              return (
                <tr key={f.clave}>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{f.nombre}</span>
                    <span className="block text-xs text-muted">{f.detalle}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{f.origen}</td>
                  <td className="px-4 py-3 text-muted">{f.cadaHoras} h</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fechaHora(f.ultima)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("badge", e.clase)}>{e.texto}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{f.filas.toLocaleString("es-CL")}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" disabled={!!cargando} onClick={() => cargarAhora(f)} className="btn-flesan btn-flesan-ghost btn-flesan-sm disabled:opacity-50">
                      {cargando === f.clave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Cargar ahora
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <h2 className="font-label text-xs font-semibold tracking-[0.12em] uppercase text-muted">Últimas cargas</h2>
        <Desplegable
          variante="filtro"
          etiqueta="Fuente"
          className="ml-auto"
          valor={filtro}
          activo={filtro !== "todas"}
          onCambio={setFiltro}
          opciones={[{ valor: "todas", texto: "Todas" }, ...fuentes.map((f) => ({ valor: f.clave, texto: f.nombre }))]}
        />
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border bg-surface-2">
              {["Inicio", "Fuente", "Duración", "Resultado", "Detalle", "Quién"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-label text-[0.6875rem] tracking-[0.1em] uppercase text-muted font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibles.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 whitespace-nowrap">{fechaHora(c.inicio)}</td>
                <td className="px-4 py-2.5">{nombre(c.fuente)}</td>
                <td className="px-4 py-2.5 text-muted">{c.estado === "en_curso" ? "—" : duracion(c.ms)}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn("w-1.5 h-1.5 rounded-full", ESTADO_CARGA[c.estado].punto)} aria-hidden />
                    {ESTADO_CARGA[c.estado].texto}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted">{c.detalle || (c.filas !== null ? `${c.filas.toLocaleString("es-CL")} filas` : "")}</td>
                <td className="px-4 py-2.5 text-muted">{c.quien}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
