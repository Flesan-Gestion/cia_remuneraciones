"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, Ban, MailCheck, Pause, Play, RotateCcw, Search, Send, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { normalizar, periodoLegible } from "@/lib/liquidaciones/formato";
import type { DetalleEnvio, EstadoEnvio, Lote } from "@/lib/liquidaciones/tipos";
import { enviarJson, Estado, fechaHoraCorta, fetcher, Nota, Paginacion, Th, type Tono } from "@/components/liquidaciones/ui";
import { ESTADOS_LOTE } from "@/components/liquidaciones/envios";

const ESTADOS_ENVIO: Record<EstadoEnvio, { texto: string; tono: Tono }> = {
  pendiente: { texto: "Pendiente", tono: "neutro" },
  enviando: { texto: "Enviando", tono: "info" },
  enviado: { texto: "Enviado", tono: "ok" },
  error: { texto: "Error", tono: "malo" },
  sin_correo: { texto: "Sin correo", tono: "alerta" },
  excluido: { texto: "Excluido", tono: "neutro" },
};

const POR_PAGINA = 50;

interface DatosLote {
  lote: Lote;
  detalle: DetalleEnvio[];
  envioHabilitado: boolean;
}

export function LoteEnvio({ id }: { id: number }) {
  const { data, error, isLoading, mutate } = useSWR<DatosLote>(`/api/envios/${id}`, fetcher, {
    // Mientras envía, se actualiza solo.
    refreshInterval: (d) => (d?.lote.estado === "enviando" ? 5000 : 0),
  });
  const [filtro, setFiltro] = useState<EstadoEnvio | "">("");
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(0);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const detalle = useMemo(() => data?.detalle ?? [], [data]);
  const filtradas = useMemo(() => {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    return detalle.filter((d) => {
      if (filtro && d.estado !== filtro) return false;
      if (!palabras.length) return true;
      const t = normalizar(`${d.nombre} ${d.numero_de_personal} ${d.correo ?? ""}`);
      return palabras.every((p) => t.includes(p));
    });
  }, [detalle, filtro, texto]);
  useEffect(() => setPagina(0), [filtro, texto]);

  if (isLoading) return <div className="skeleton h-64 rounded-flesan" />;
  if (error || !data) return <Nota tono="alerta" titulo="No se pudo leer el envío">{error?.message ?? "Intenta de nuevo."}</Nota>;

  const { lote } = data;
  const conteo = (e: EstadoEnvio) => detalle.filter((d) => d.estado === e).length;
  const aEnviar = lote.total - lote.excluidos - lote.sin_correo;
  const avance = aEnviar > 0 ? Math.round((lote.enviados / aEnviar) * 100) : 0;
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visibles = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  async function accion(nombre: string, cuerpo: Record<string, unknown>, exito: (r: Record<string, unknown>) => string) {
    setOcupado(nombre);
    try {
      const r = await enviarJson<Record<string, unknown>>(`/api/envios/${id}`, cuerpo);
      toast.success(exito(r));
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setOcupado(null);
      setConfirmando(false);
    }
  }

  async function accionFila(d: DetalleEnvio, que: "excluir" | "incluir" | "reenviar") {
    setOcupado(`${que}-${d.id}`);
    try {
      await enviarJson(`/api/envios/${id}/detalle/${d.id}`, { accion: que });
      toast.success(que === "reenviar" ? `Reenviada a ${d.correo}.` : que === "excluir" ? `${d.nombre} no recibirá el correo.` : `${d.nombre} vuelve al envío.`);
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setOcupado(null);
    }
  }

  const prueba = (d?: DetalleEnvio) =>
    accion("prueba", { accion: "prueba", detalleId: d?.id }, (r) => `Prueba enviada a ${r.para} con la liquidación de ${r.nombre}.`);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/envios" className="btn-flesan btn-flesan-ghost btn-flesan-sm rounded-flesan">
          <ArrowLeft className="w-4 h-4" aria-hidden /> Envíos
        </Link>
        <Estado tono={ESTADOS_LOTE[lote.estado].tono}>{ESTADOS_LOTE[lote.estado].texto}</Estado>
        <span className="text-xs text-muted">
          Preparado {fechaHoraCorta(lote.creado_en)} por {lote.creado_por === "sistema" ? "el programador" : lote.creado_por}
          {lote.aprobado_por && ` · aprobado ${fechaHoraCorta(lote.aprobado_en)} por ${lote.aprobado_por}`}
          {lote.terminado_en && ` · terminado ${fechaHoraCorta(lote.terminado_en)}`}
        </span>
      </div>

      {!data.envioHabilitado && lote.estado === "enviando" && (
        <Nota>Este servidor no envía correos en masa: el servidor de producción toma el envío aprobado en los próximos minutos.</Nota>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <Indicador titulo="Personas" valor={lote.total} />
        <Indicador titulo="Con correo" valor={lote.personal} detalle="Personal, registrado en SAP" />
        <Indicador titulo="Sin correo" valor={lote.sin_correo} detalle="Sin correo personal: no lo recibirán" tono={lote.sin_correo ? "alerta" : undefined} />
        <Indicador titulo="Excluidos" valor={lote.excluidos} />
        <Indicador titulo="Enviados" valor={lote.enviados} detalle={aEnviar ? `${avance} % de ${aEnviar}` : undefined} />
        <Indicador titulo="Con error" valor={lote.errores} tono={lote.errores ? "malo" : undefined} />
      </div>

      {(lote.estado === "enviando" || lote.estado === "pausado") && (
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del envío">
          <div className="h-full bg-status-ok transition-all" style={{ width: `${avance}%` }} />
        </div>
      )}

      <div className="card dens-card flex flex-wrap items-center gap-2">
        {lote.estado === "por_aprobar" && (
          <>
            <p className="text-sm text-muted mr-auto max-w-xl">
              Revisa la lista y excluye a quien no corresponda. Con «Enviar prueba» te llega a ti la liquidación de la primera persona, con su
              clave, para ver cómo la recibirán.
            </p>
            <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" disabled={!!ocupado} onClick={() => prueba()}>
              <MailCheck className="w-4 h-4" aria-hidden /> {ocupado === "prueba" ? "Enviando…" : "Enviar prueba a mi correo"}
            </button>
            <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" disabled={!!ocupado} onClick={() => accion("cancelar", { accion: "cancelar" }, () => "Envío cancelado.")}>
              <Ban className="w-4 h-4" aria-hidden /> Cancelar envío
            </button>
            {confirmando ? (
              <span className="inline-flex flex-wrap items-center gap-2 text-sm text-text">
                Se enviarán {aEnviar} correos. ¿Aprobar?
                <button type="button" className="btn-flesan btn-flesan-primary rounded-flesan" disabled={!!ocupado} onClick={() => accion("aprobar", { accion: "aprobar" }, () => "Envío aprobado: los correos salen de a poco.")}>
                  {ocupado === "aprobar" ? "Aprobando…" : "Sí, aprobar y enviar"}
                </button>
                <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" onClick={() => setConfirmando(false)}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" className="btn-flesan btn-flesan-primary rounded-flesan" disabled={!!ocupado || aEnviar === 0} onClick={() => setConfirmando(true)}>
                <Send className="w-4 h-4" aria-hidden /> Aprobar y enviar
              </button>
            )}
          </>
        )}
        {lote.estado === "enviando" && (
          <>
            <p className="text-sm text-muted mr-auto">
              Enviando de a poco para respetar el tope diario de la cuenta de correo. Lo que no alcance hoy sale mañana.
            </p>
            <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" disabled={!!ocupado} onClick={() => accion("pausar", { accion: "pausar" }, () => "Envío pausado.")}>
              <Pause className="w-4 h-4" aria-hidden /> Pausar
            </button>
          </>
        )}
        {lote.estado === "pausado" && (
          <>
            <p className="text-sm text-muted mr-auto">Envío pausado. Lo pendiente sale al reanudar.</p>
            <button type="button" className="btn-flesan btn-flesan-primary rounded-flesan" disabled={!!ocupado} onClick={() => accion("reanudar", { accion: "reanudar" }, () => "Envío reanudado.")}>
              <Play className="w-4 h-4" aria-hidden /> Reanudar
            </button>
          </>
        )}
        {lote.estado === "enviado" && <p className="text-sm text-muted mr-auto">Envío terminado.</p>}
        {lote.estado === "cancelado" && <p className="text-sm text-muted mr-auto">Envío cancelado: no salió ningún correo.</p>}
        {lote.errores > 0 && ["enviando", "pausado", "enviado"].includes(lote.estado) && (
          <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" disabled={!!ocupado} onClick={() => accion("reintentar", { accion: "reintentar" }, (r) => `${r.reintentos} correos vuelven a la cola.`)}>
            <RotateCcw className="w-4 h-4" aria-hidden /> Reintentar errores ({lote.errores})
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["", "pendiente", "enviado", "error", "sin_correo", "excluido"] as const).map((e) => {
          const n = e ? conteo(e) : detalle.length;
          if (e && !n) return null;
          return (
            <button key={e || "todos"} type="button" onClick={() => setFiltro(e)} className={cn("chip-flesan", filtro === e && "is-active")}>
              {e ? ESTADOS_ENVIO[e].texto : "Todos"} · {n}
            </button>
          );
        })}
        <label className="relative w-full sm:w-80 sm:ml-auto">
          <span className="sr-only">Buscar persona</span>
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, N° personal o correo…" className="field-input rounded-full! pl-10! w-full!" />
        </label>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <Th>Nombre</Th>
                <Th>N° personal</Th>
                <Th>Empresa</Th>
                <Th>Correo</Th>
                <Th>Liquidaciones</Th>
                <Th>Estado</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((d) => (
                <tr key={d.id} className={cn("hover:bg-surface-2/60", d.estado === "excluido" && "opacity-60")}>
                  <td className="px-3 py-2 font-semibold text-text min-w-56">{d.nombre}</td>
                  <td className="px-3 py-2 text-muted tabular-nums">{d.numero_de_personal}</td>
                  <td className="px-3 py-2 text-muted">{d.sociedad ?? "—"}</td>
                  <td className="px-3 py-2">
                    {d.correo ? (
                      <span className="text-text">{d.correo}</span>
                    ) : (
                      <span className="text-faint">Sin correo personal en SAP</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                    {d.liquidaciones.map((l) => (l.periodo_para_nomina === "000000" ? "Fuera de ciclo" : "Normal")).join(" + ")}
                  </td>
                  <td className="px-3 py-2">
                    <Estado tono={ESTADOS_ENVIO[d.estado].tono}>{ESTADOS_ENVIO[d.estado].texto}</Estado>
                    {d.enviado_en && <span className="block text-xs text-faint mt-0.5">{fechaHoraCorta(d.enviado_en)}</span>}
                    {d.estado === "error" && d.ultimo_error && <span className="block text-xs text-flesan-red mt-0.5 max-w-72">{d.ultimo_error}</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {lote.estado === "por_aprobar" && d.estado === "pendiente" && (
                      <>
                        <BotonFila onClick={() => prueba(d)} disabled={!!ocupado} titulo={`Enviarme la liquidación de ${d.nombre} como prueba`}>
                          <MailCheck className="w-4 h-4" />
                        </BotonFila>
                        <BotonFila onClick={() => accionFila(d, "excluir")} disabled={!!ocupado} titulo={`Excluir a ${d.nombre}`}>
                          <Ban className="w-4 h-4" />
                        </BotonFila>
                      </>
                    )}
                    {lote.estado === "por_aprobar" && d.estado === "excluido" && (
                      <BotonFila onClick={() => accionFila(d, "incluir")} disabled={!!ocupado} titulo={`Volver a incluir a ${d.nombre}`}>
                        <Undo2 className="w-4 h-4" />
                      </BotonFila>
                    )}
                    {["enviando", "pausado", "enviado"].includes(lote.estado) && (d.estado === "enviado" || d.estado === "error") && (
                      <BotonFila onClick={() => accionFila(d, "reenviar")} disabled={!!ocupado} titulo={`Reenviar a ${d.correo}`}>
                        <RotateCcw className="w-4 h-4" />
                      </BotonFila>
                    )}
                  </td>
                </tr>
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Nadie coincide con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Paginacion pagina={pagina} paginas={paginas} onCambio={setPagina} total={filtradas.length} unidad="personas" />
      </div>
      <p className="text-xs text-faint">Envío de {periodoLegible(lote.periodo)}. Cada persona recibe un PDF con su RUT sin dígito verificador como clave.</p>
    </div>
  );
}

function Indicador({ titulo, valor, detalle, tono }: { titulo: string; valor: number; detalle?: string; tono?: "alerta" | "malo" }) {
  return (
    <div className="card dens-card flex flex-col gap-0.5">
      <span className="label-meta text-muted">{titulo}</span>
      <span className={cn("text-2xl font-bold tabular-nums", tono === "malo" ? "text-flesan-red" : tono === "alerta" ? "text-status-warn" : "text-text")}>{valor}</span>
      {detalle && <span className="text-xs text-faint">{detalle}</span>}
    </div>
  );
}

function BotonFila({ children, onClick, disabled, titulo }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; titulo: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      aria-label={titulo}
      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-faint hover:text-flesan-red hover:bg-bg cursor-pointer disabled:opacity-40"
    >
      {children}
    </button>
  );
}
