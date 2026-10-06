"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { CalendarClock, ChevronRight, Send } from "lucide-react";
import { Desplegable } from "@/components/desplegable";
import { periodoAnterior, periodoLegible } from "@/lib/liquidaciones/formato";
import type { ConfiguracionEnvio, EstadoLote, Lote } from "@/lib/liquidaciones/tipos";
import { Campo, enviarJson, Estado, fechaHoraCorta, fetcher, Nota, Th, type Tono } from "@/components/liquidaciones/ui";

export const ESTADOS_LOTE: Record<EstadoLote, { texto: string; tono: Tono }> = {
  por_aprobar: { texto: "Por aprobar", tono: "alerta" },
  enviando: { texto: "Enviando", tono: "info" },
  pausado: { texto: "Pausado", tono: "alerta" },
  enviado: { texto: "Enviado", tono: "ok" },
  cancelado: { texto: "Cancelado", tono: "neutro" },
};

interface DatosEnvios {
  configuracion: ConfiguracionEnvio;
  lotes: Lote[];
  envioHabilitado: boolean;
}

/** Envío por correo: programación mensual, preparar un envío a mano y los envíos de cada periodo. */
export function Envios() {
  const { data, error, isLoading, mutate } = useSWR<DatosEnvios>("/api/envios", fetcher);
  const { data: filtros } = useSWR<{ periodos: string[] }>("/api/liquidaciones/filtros", fetcher, { revalidateOnFocus: false });

  if (isLoading) return <div className="skeleton h-64 rounded-flesan" />;
  if (error || !data) return <Nota tono="alerta" titulo="No se pudieron leer los envíos">{error?.message ?? "Intenta de nuevo en unos minutos."}</Nota>;

  return (
    <div className="flex flex-col gap-5">
      {!data.envioHabilitado && (
        <Nota titulo="Este servidor no envía correos en masa">
          Aquí puedes preparar, revisar, probar y aprobar. Los correos aprobados los envía el servidor de producción.
        </Nota>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Programacion config={data.configuracion} onGuardado={() => mutate()} />
        <PrepararAhora periodos={filtros?.periodos ?? []} />
      </div>
      <TablaLotes lotes={data.lotes} />
    </div>
  );
}

function Programacion({ config, onGuardado }: { config: ConfiguracionEnvio; onGuardado: () => void }) {
  const [dia, setDia] = useState(String(config.dia_mes));
  const [activo, setActivo] = useState(config.activo);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    setDia(String(config.dia_mes));
    setActivo(config.activo);
  }, [config.dia_mes, config.activo]);
  const cambio = Number(dia) !== config.dia_mes || activo !== config.activo;

  async function guardar() {
    const n = Number(dia);
    if (!Number.isInteger(n) || n < 1 || n > 28) {
      toast.error("El día debe ser un número entre 1 y 28.");
      return;
    }
    setGuardando(true);
    try {
      await enviarJson("/api/envios/configuracion", { diaMes: n, activo }, "PUT");
      toast.success("Programación guardada.");
      onGuardado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="card dens-card flex flex-col gap-4">
      <h2 className="flex items-center gap-2 font-semibold text-text">
        <CalendarClock className="w-4 h-4 text-flesan-red" aria-hidden /> Programación mensual
      </h2>
      <p className="text-sm text-muted">
        Ese día se prepara el envío de las liquidaciones del mes anterior y se avisa por correo a RR.HH. No sale ningún correo hasta que
        alguien lo apruebe.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <Campo etiqueta="Día del mes">
          <input type="number" min={1} max={28} value={dia} onChange={(e) => setDia(e.target.value)} className="field-input w-24!" />
        </Campo>
        <label className="flex items-center gap-2 text-sm text-text cursor-pointer pb-2">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="w-4 h-4 accent-flesan-red" />
          Preparar el envío automáticamente
        </label>
        <button type="button" className="btn-flesan btn-flesan-primary rounded-flesan ml-auto" disabled={!cambio || guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {config.actualizado_por && (
        <p className="text-xs text-faint">
          Último cambio: {config.actualizado_por}, {fechaHoraCorta(config.actualizado_en)}
        </p>
      )}
    </section>
  );
}

function PrepararAhora({ periodos }: { periodos: string[] }) {
  const router = useRouter();
  const sugerido = periodoAnterior(new Date());
  const [periodo, setPeriodo] = useState("");
  const [preparando, setPreparando] = useState(false);
  const elegido = periodo || (periodos.includes(sugerido) ? sugerido : (periodos[0] ?? ""));

  async function preparar() {
    if (!elegido) return;
    setPreparando(true);
    try {
      const r = await enviarJson<{ id: number; total: number }>("/api/envios", { periodo: elegido });
      toast.success(`Envío de ${periodoLegible(elegido)} preparado: ${r.total} personas.`);
      router.push(`/envios/${r.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo preparar.");
      setPreparando(false);
    }
  }

  return (
    <section className="card dens-card flex flex-col gap-4">
      <h2 className="flex items-center gap-2 font-semibold text-text">
        <Send className="w-4 h-4 text-flesan-red" aria-hidden /> Preparar un envío ahora
      </h2>
      <p className="text-sm text-muted">
        Arma el envío de un periodo sin esperar el día programado. Queda por aprobar, igual que el automático.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <Campo etiqueta="Periodo" className="w-56">
          <Desplegable variante="campo" etiqueta="Periodo" valor={elegido} onCambio={setPeriodo} opciones={periodos.map((p) => ({ valor: p, texto: periodoLegible(p) }))} />
        </Campo>
        <button type="button" className="btn-flesan btn-flesan-dark rounded-flesan ml-auto" disabled={!elegido || preparando} onClick={preparar}>
          {preparando ? "Preparando…" : "Preparar envío"}
        </button>
      </div>
    </section>
  );
}

function TablaLotes({ lotes }: { lotes: Lote[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label-meta text-muted">Envíos por periodo</h2>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <Th>Periodo</Th>
                <Th>Estado</Th>
                <Th derecha>Personas</Th>
                <Th derecha>Con correo</Th>
                <Th derecha>Sin correo</Th>
                <Th derecha>Enviados</Th>
                <Th derecha>Errores</Th>
                <Th>Preparado</Th>
                <Th>Aprobado</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lotes.map((l) => (
                <tr key={l.id} className="hover:bg-surface-2/60">
                  <td className="px-3 py-2.5 font-semibold text-text whitespace-nowrap">
                    <Link href={`/envios/${l.id}`} className="hover:text-flesan-red">
                      {periodoLegible(l.periodo)}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Estado tono={ESTADOS_LOTE[l.estado].tono}>{ESTADOS_LOTE[l.estado].texto}</Estado>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.total}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{l.personal}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{l.sin_correo}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.enviados}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${l.errores ? "text-flesan-red font-semibold" : "text-muted"}`}>{l.errores}</td>
                  <td className="px-3 py-2.5 text-xs text-muted whitespace-nowrap">
                    {fechaHoraCorta(l.creado_en)}
                    <span className="block text-faint">{l.creado_por === "sistema" ? "Automático" : l.creado_por}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted whitespace-nowrap">
                    {l.aprobado_por ? (
                      <>
                        {fechaHoraCorta(l.aprobado_en)}
                        <span className="block text-faint">{l.aprobado_por}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <Link href={`/envios/${l.id}`} aria-label={`Ver el envío de ${periodoLegible(l.periodo)}`} className="inline-flex w-8 h-8 items-center justify-center rounded-md text-faint hover:text-text hover:bg-bg">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!lotes.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted">
                    Todavía no hay envíos. El primero se prepara solo el día programado, o puedes prepararlo ahora.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
