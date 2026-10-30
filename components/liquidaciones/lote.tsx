"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, Ban, ListChecks, MailCheck, Pause, Play, RotateCcw, Search, Send, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Desplegable, type OpcionDesplegable } from "@/components/desplegable";
import { miles, normalizar, periodoLegible } from "@/lib/liquidaciones/formato";
import { esFiniquito, ETIQUETA_LIQUIDACION, tiposEnvio, type AccionExclusion, type DetalleEnvio, type Empresa, type EstadoEnvio, type Lote } from "@/lib/liquidaciones/tipos";
import { Casilla, enviarJson, Estado, fechaHoraCorta, fetcher, Nota, Paginacion, Th, type Tono } from "@/components/liquidaciones/ui";
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
/** Valor de filtro para quien no tiene el dato (los lotes preparados antes del 2026-10-19 no traen CC ni planta). */
const SIN_DATO = "__sin__";
const PLANTA: Record<string, string> = { PL: "Planta", NP: "No planta" };
const TIPOS = { normal: "Normales", finiquito: "Finiquitos" };
type TipoPersona = keyof typeof TIPOS;
const tipoDe = (d: DetalleEnvio): TipoPersona => (esFiniquito(d.liquidaciones) ? "finiquito" : "normal");
const SITUACIONES = { activo: "Activos", inactivo: "Inactivos" };
type Situacion = keyof typeof SITUACIONES;
const situacionDe = (d: DetalleEnvio): Situacion | null => (d.activo == null ? null : d.activo ? "activo" : "inactivo");

interface DatosLote {
  lote: Lote;
  detalle: DetalleEnvio[];
  envioHabilitado: boolean;
}

const personas = (n: number) => `${miles(n)} ${n === 1 ? "persona" : "personas"}`;

/** Opciones de un filtro con lo que hay en el lote y cuántas personas tiene cada una. */
function opcionesDe(
  filas: DetalleEnvio[],
  clave: (d: DetalleEnvio) => string | null,
  texto: (valor: string, d: DetalleEnvio) => string,
  sinDato: string,
): OpcionDesplegable[] {
  const grupos = new Map<string, { d: DetalleEnvio; n: number }>();
  for (const d of filas) {
    const valor = clave(d) || SIN_DATO;
    const g = grupos.get(valor);
    if (g) g.n++;
    else grupos.set(valor, { d, n: 1 });
  }
  return [...grupos]
    .map(([valor, { d, n }]) => ({ valor, texto: valor === SIN_DATO ? sinDato : texto(valor, d), detalle: miles(n) }))
    .sort((a, b) => Number(a.valor === SIN_DATO) - Number(b.valor === SIN_DATO) || a.texto.localeCompare(b.texto, "es"));
}

export function LoteEnvio({ id }: { id: number }) {
  const { data, error, isLoading, mutate } = useSWR<DatosLote>(`/api/envios/${id}`, fetcher, {
    // Mientras envía (o terminan de salir los correos de antes de una pausa), se actualiza solo.
    refreshInterval: (d) => (d?.lote.estado === "enviando" || d?.detalle.some((x) => x.estado === "enviando") ? 5000 : 0),
  });
  // Nombres de las razones sociales: el lote guarda solo el código.
  const { data: filtros } = useSWR<{ empresas: Empresa[] }>("/api/liquidaciones/filtros", fetcher, { revalidateOnFocus: false });
  const [filtro, setFiltro] = useState<EstadoEnvio | "">("");
  const [tipo, setTipo] = useState<TipoPersona | "">("");
  const [situacion, setSituacion] = useState<Situacion | "">("");
  const [texto, setTexto] = useState("");
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [centros, setCentros] = useState<string[]>([]);
  const [planta, setPlanta] = useState("");
  const [marcas, setMarcas] = useState<Set<number>>(() => new Set());
  const [pagina, setPagina] = useState(0);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoBloque, setConfirmandoBloque] = useState<AccionExclusion | null>(null);

  const detalle = useMemo(() => data?.detalle ?? [], [data]);
  const nombreEmpresa = useMemo(() => new Map((filtros?.empresas ?? []).map((e) => [e.codigo, e.nombre])), [filtros]);
  const empresaDe = (codigo: string | null) => (codigo ? (nombreEmpresa.get(codigo) ?? codigo) : "—");

  // Las opciones de cada filtro se acotan a lo elegido en el anterior (razón social → CC → planta).
  const enEmpresas = useMemo(() => (empresas.length ? detalle.filter((d) => empresas.includes(d.sociedad || SIN_DATO)) : detalle), [detalle, empresas]);
  const enCentros = useMemo(() => (centros.length ? enEmpresas.filter((d) => centros.includes(d.centro_costo || SIN_DATO)) : enEmpresas), [enEmpresas, centros]);
  const opcionesEmpresa = useMemo(() => opcionesDe(detalle, (d) => d.sociedad, (v) => nombreEmpresa.get(v) ?? v, "Sin razón social"), [detalle, nombreEmpresa]);
  const opcionesCentro = useMemo(
    () => opcionesDe(enEmpresas, (d) => d.centro_costo, (v, d) => (d.nombre_cc ? `${v} - ${d.nombre_cc}` : v), "Sin centro de costo"),
    [enEmpresas],
  );
  const opcionesPlanta = useMemo(() => {
    const opciones = opcionesDe(enCentros, (d) => d.planta_noplanta, (v) => PLANTA[v] ?? v, "Sin dato");
    // La elegida sigue a la vista aunque ya no tenga personas con los otros filtros.
    return planta && !opciones.some((o) => o.valor === planta)
      ? [...opciones, { valor: planta, texto: planta === SIN_DATO ? "Sin dato" : (PLANTA[planta] ?? planta), detalle: "0" }]
      : opciones;
  }, [enCentros, planta]);

  // Todos los filtros menos los chips: cada grupo de chips cuenta con los otros aplicados.
  const sinChips = useMemo(() => {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    return enCentros.filter((d) => {
      if (planta && (d.planta_noplanta || SIN_DATO) !== planta) return false;
      if (!palabras.length) return true;
      const t = normalizar(`${d.nombre} ${d.numero_de_personal} ${d.correo ?? ""} ${d.centro_costo ?? ""} ${d.nombre_cc ?? ""}`);
      return palabras.every((p) => t.includes(p));
    });
  }, [enCentros, planta, texto]);
  const porFiltros = useMemo(
    () => sinChips.filter((d) => (!tipo || tipoDe(d) === tipo) && (!situacion || situacionDe(d) === situacion)),
    [sinChips, tipo, situacion],
  );
  const filtradas = useMemo(() => (filtro ? porFiltros.filter((d) => d.estado === filtro) : porFiltros), [porFiltros, filtro]);
  useEffect(() => setPagina(0), [filtro, tipo, situacion, texto, empresas, centros, planta]);
  // Lo que se iba a confirmar cambia con los filtros o las marcas: se vuelve a pedir.
  useEffect(() => setConfirmandoBloque(null), [filtro, tipo, situacion, texto, empresas, centros, planta, marcas]);

  if (isLoading) return <div className="skeleton h-64 rounded-flesan" />;
  if (error || !data) return <Nota tono="alerta" titulo="No se pudo leer el envío">{error?.message ?? "Intenta de nuevo."}</Nota>;

  const { lote } = data;
  // Excluir e incluir: antes de aprobar o con el envío pausado, y solo lo que aún no sale.
  const editable = lote.estado === "por_aprobar" || lote.estado === "pausado";
  const marcable = (d: DetalleEnvio) => editable && (d.estado === "pendiente" || d.estado === "excluido");
  const conteo = (e: EstadoEnvio) => porFiltros.filter((d) => d.estado === e).length;
  const conteoTipo = (t: TipoPersona) => sinChips.filter((d) => tipoDe(d) === t && (!situacion || situacionDe(d) === situacion) && (!filtro || d.estado === filtro)).length;
  const conteoSituacion = (s: Situacion) => sinChips.filter((d) => situacionDe(d) === s && (!tipo || tipoDe(d) === tipo) && (!filtro || d.estado === filtro)).length;
  const aEnviar = lote.total - lote.excluidos - lote.sin_correo;
  const avance = aEnviar > 0 ? Math.round((lote.enviados / aEnviar) * 100) : 0;
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visibles = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  // Acciones en bloque: sobre las marcadas o, si no hay marcas, sobre lo filtrado.
  const marcadas = detalle.filter((d) => marcas.has(d.id) && marcable(d));
  const hayFiltro = Boolean(filtro || tipo || situacion || texto.trim() || empresas.length || centros.length || planta);
  const filtradasMarcables = filtradas.filter(marcable);
  const objetivo = marcadas.length ? marcadas : filtradasMarcables;
  // Filtradas que no se pueden excluir ni incluir (sin correo, enviadas, con error).
  const fijas = filtradas.length - filtradasMarcables.length;
  const enObjetivo = new Set(objetivo.map((d) => d.id));
  const enFiltro = new Set(filtradas.map((d) => d.id));
  const fueraDelFiltro = marcadas.filter((d) => !enFiltro.has(d.id)).length;
  const marcadasEnFiltro = filtradasMarcables.filter((d) => marcas.has(d.id)).length;
  const pendientes = detalle.filter((d) => d.estado === "pendiente").length;
  const nExcluir = objetivo.filter((d) => d.estado === "pendiente").length;
  const nIncluir = objetivo.length - nExcluir;
  const nResto = detalle.filter((d) => d.estado === "pendiente" && !enObjetivo.has(d.id)).length;
  const confirmacion: Record<AccionExclusion, string> = {
    excluir: `Se excluyen ${personas(nExcluir)}: quedan ${miles(pendientes - nExcluir)} por enviar.`,
    incluir: `Vuelven al envío ${personas(nIncluir)}: quedan ${miles(pendientes + nIncluir)} por enviar.`,
    solo: `Quedan por enviar solo ${personas(objetivo.length)}${nResto ? ` y se excluye al resto (${miles(nResto)})` : ""}.`,
  };

  // Lo que se envía, por razón social, para revisar antes de aprobar.
  const porEmpresa = new Map<string | null, number>();
  for (const d of detalle) if (d.estado === "pendiente") porEmpresa.set(d.sociedad, (porEmpresa.get(d.sociedad) ?? 0) + 1);
  const desglose = [...porEmpresa].sort((a, b) => b[1] - a[1]);
  const textoDesglose =
    desglose.length === 1
      ? `, todos de ${empresaDe(desglose[0][0])}`
      : desglose.length > 1
        ? `: ${desglose
            .slice(0, 4)
            .map(([e, n]) => `${empresaDe(e)} ${miles(n)}`)
            .join(", ")}${desglose.length > 4 ? ` y ${desglose.length - 4} razones sociales más` : ""}`
        : "";

  /** Cómo se eligió a las personas, para el registro de actividad. */
  function criterio() {
    if (marcadas.length) return marcadas.length === 1 ? "la marcada" : `las ${miles(marcadas.length)} marcadas`;
    if (!hayFiltro) return "todas";
    const partes = [
      empresas.length ? `razón social ${empresas.map((e) => (e === SIN_DATO ? "sin dato" : empresaDe(e))).join(", ")}` : "",
      centros.length ? `CC ${centros.map((c) => (c === SIN_DATO ? "sin dato" : c)).join(", ")}` : "",
      planta ? (planta === SIN_DATO ? "planta sin dato" : (PLANTA[planta] ?? planta).toLowerCase()) : "",
      filtro ? `estado ${ESTADOS_ENVIO[filtro].texto.toLowerCase()}` : "",
      tipo ? TIPOS[tipo].toLowerCase() : "",
      situacion ? SITUACIONES[situacion].toLowerCase() : "",
      texto.trim() ? `búsqueda «${texto.trim()}»` : "",
    ];
    return `las filtradas por ${partes.filter(Boolean).join(" · ")}`;
  }

  function marcar(ids: number[], si: boolean) {
    setMarcas((m) => {
      const nuevas = new Set(m);
      for (const i of ids) {
        if (si) nuevas.add(i);
        else nuevas.delete(i);
      }
      return nuevas;
    });
  }

  function cambiarEmpresas(valor: string[]) {
    setEmpresas(valor);
    // Quita los CC que ya no están en las razones sociales elegidas.
    const quedan = new Set((valor.length ? detalle.filter((d) => valor.includes(d.sociedad || SIN_DATO)) : detalle).map((d) => d.centro_costo || SIN_DATO));
    setCentros((c) => c.filter((v) => quedan.has(v)));
  }

  function limpiarFiltros() {
    setEmpresas([]);
    setCentros([]);
    setPlanta("");
    setFiltro("");
    setTipo("");
    setSituacion("");
    setTexto("");
  }

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
      if (que === "reenviar") await enviarJson(`/api/envios/${id}/detalle/${d.id}`, { accion: que });
      else await enviarJson(`/api/envios/${id}/detalle`, { accion: que, ids: [d.id] });
      toast.success(que === "reenviar" ? `Reenviada a ${d.correo}.` : que === "excluir" ? `${d.nombre} no recibirá el correo.` : `${d.nombre} vuelve al envío.`);
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setOcupado(null);
    }
  }

  async function accionBloque(que: AccionExclusion) {
    setOcupado(que);
    try {
      const r = await enviarJson<{ excluidos: number; incluidos: number }>(`/api/envios/${id}/detalle`, {
        accion: que,
        ids: objetivo.map((d) => d.id),
        criterio: criterio(),
      });
      const partes = [
        r.excluidos ? `${personas(r.excluidos)} ${r.excluidos === 1 ? "excluida" : "excluidas"}` : "",
        r.incluidos ? `${personas(r.incluidos)} de vuelta en el envío` : "",
      ].filter(Boolean);
      toast.success(partes.length ? `${partes.join(" y ")}.` : "No había nada que cambiar.");
      setMarcas(new Set());
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setOcupado(null);
      setConfirmandoBloque(null);
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
              Revisa la lista y excluye a quien no corresponda: filtra o marca personas para hacerlo de una vez. Con «Enviar prueba» te llega a ti
              la liquidación de la primera persona, con su clave, para ver cómo la recibirán.
            </p>
            <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" disabled={!!ocupado} onClick={() => prueba()}>
              <MailCheck className="w-4 h-4" aria-hidden /> {ocupado === "prueba" ? "Enviando…" : "Enviar prueba a mi correo"}
            </button>
            <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" disabled={!!ocupado} onClick={() => accion("cancelar", { accion: "cancelar" }, () => "Envío cancelado.")}>
              <Ban className="w-4 h-4" aria-hidden /> Cancelar envío
            </button>
            {confirmando ? (
              <span className="inline-flex flex-wrap items-center gap-2 text-sm text-text">
                Se enviarán {miles(aEnviar)} correos{textoDesglose}. ¿Aprobar?
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
            <p className="text-sm text-muted mr-auto">
              {lote.pendientes
                ? "Envío pausado. Lo pendiente sale al reanudar; mientras tanto puedes excluir o volver a incluir a quienes aún no lo reciben."
                : "Envío pausado. No queda nada pendiente: al reanudar, el envío queda terminado."}
            </p>
            <button
              type="button"
              className="btn-flesan btn-flesan-primary rounded-flesan"
              disabled={!!ocupado}
              onClick={() => accion("reanudar", { accion: "reanudar" }, (r) => (r.terminado ? "No quedaba nada pendiente: el envío quedó terminado." : "Envío reanudado."))}
            >
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Desplegable multiple variante="filtro" etiqueta="Razón social" textoTodos="Todas" valor={empresas} activo={empresas.length > 0} onCambio={cambiarEmpresas} opciones={opcionesEmpresa} />
          <Desplegable multiple variante="filtro" etiqueta="Centro de costo" textoTodos="Todos" valor={centros} activo={centros.length > 0} onCambio={setCentros} opciones={opcionesCentro} />
          <Desplegable variante="filtro" etiqueta="Planta" valor={planta} activo={!!planta} onCambio={setPlanta} opciones={[{ valor: "", texto: "Todas" }, ...opcionesPlanta]} />
          {hayFiltro && (
            <button type="button" onClick={limpiarFiltros} className="text-xs font-semibold text-muted hover:text-flesan-red cursor-pointer px-1">
              Limpiar filtros
            </button>
          )}
          <label className="relative w-full sm:w-80 sm:ml-auto">
            <span className="sr-only">Buscar persona</span>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, N° personal, correo o CC…" className="field-input rounded-full! pl-10! w-full!" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["", "pendiente", "enviado", "error", "sin_correo", "excluido"] as const).map((e) => {
            const n = e ? conteo(e) : porFiltros.length;
            if (e && !n && filtro !== e) return null;
            return (
              <button key={e || "todos"} type="button" onClick={() => setFiltro(e)} className={cn("chip-flesan", filtro === e && "is-active")}>
                {e ? ESTADOS_ENVIO[e].texto : "Todos"} · {miles(n)}
              </button>
            );
          })}
          <span className="w-px h-5 bg-border mx-1" aria-hidden />
          {(["normal", "finiquito"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(tipo === t ? "" : t)} className={cn("chip-flesan", tipo === t && "is-active")}>
              {TIPOS[t]} · {miles(conteoTipo(t))}
            </button>
          ))}
          <span className="w-px h-5 bg-border mx-1" aria-hidden />
          {(["activo", "inactivo"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={situacion === s} onClick={() => setSituacion(situacion === s ? "" : s)} className={cn("chip-flesan", situacion === s && "is-active")}>
              {SITUACIONES[s]} · {miles(conteoSituacion(s))}
            </button>
          ))}
        </div>
      </div>

      {editable && (
        <div className="card dens-card flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted mr-auto">
            {marcadas.length ? (
              <>
                <span className="font-semibold text-text">
                  {personas(marcadas.length)} {marcadas.length === 1 ? "marcada" : "marcadas"}
                </span>
                {fueraDelFiltro > 0 && ` (${miles(fueraDelFiltro)} fuera del filtro actual)`} ·{" "}
                <button type="button" onClick={() => setMarcas(new Set())} className="font-semibold hover:text-flesan-red cursor-pointer">
                  Quitar marcas
                </button>
              </>
            ) : hayFiltro ? (
              <>
                <span className="font-semibold text-text">{personas(objetivo.length)}</span> con el filtro
                {fijas > 0 && ` (y ${miles(fijas)} que no se ${fijas === 1 ? "puede cambiar: sin correo, ya enviada" : "pueden cambiar: sin correo, ya enviadas"} o con error)`}. Marca casillas
                para elegir a mano.
              </>
            ) : (
              "Sin filtros ni marcas, las acciones aplican a todas. Filtra o marca personas para elegir."
            )}
          </p>
          {confirmandoBloque ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-sm text-text">
              {confirmacion[confirmandoBloque]} ¿Confirmar?
              <button type="button" className="btn-flesan btn-flesan-primary rounded-flesan" disabled={!!ocupado} onClick={() => accionBloque(confirmandoBloque)}>
                {ocupado === confirmandoBloque ? "Aplicando…" : "Sí, confirmar"}
              </button>
              <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" onClick={() => setConfirmandoBloque(null)}>
                No
              </button>
            </span>
          ) : (
            <>
              <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" disabled={!!ocupado || !nExcluir} onClick={() => setConfirmandoBloque("excluir")}>
                <Ban className="w-4 h-4" aria-hidden /> Excluir ({miles(nExcluir)})
              </button>
              <button type="button" className="btn-flesan btn-flesan-ghost rounded-flesan" disabled={!!ocupado || !nIncluir} onClick={() => setConfirmandoBloque("incluir")}>
                <Undo2 className="w-4 h-4" aria-hidden /> Incluir ({miles(nIncluir)})
              </button>
              {(marcadas.length > 0 || hayFiltro) && (
                <button
                  type="button"
                  className="btn-flesan btn-flesan-ghost rounded-flesan"
                  disabled={!!ocupado || !objetivo.length || (!nResto && !nIncluir)}
                  onClick={() => setConfirmandoBloque("solo")}
                  title="Deja por enviar solo a estas personas y excluye al resto"
                >
                  <ListChecks className="w-4 h-4" aria-hidden /> Dejar solo estas
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                {editable && (
                  <th scope="col" className="pl-4 pr-1 py-2.5 w-8 text-left">
                    {filtradasMarcables.length > 0 && (
                      <Casilla
                        marcada={marcadasEnFiltro === filtradasMarcables.length}
                        indeterminada={marcadasEnFiltro > 0 && marcadasEnFiltro < filtradasMarcables.length}
                        onCambio={(v) => marcar(filtradasMarcables.map((d) => d.id), v)}
                        etiqueta={`Marcar las ${filtradasMarcables.length} personas filtradas`}
                      />
                    )}
                  </th>
                )}
                <Th>Nombre</Th>
                <Th>N° personal</Th>
                <Th>Empresa</Th>
                <Th>Centro de costo</Th>
                <Th>Correo</Th>
                <Th>Liquidaciones</Th>
                <Th>Estado</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((d) => (
                <tr key={d.id} className={cn("hover:bg-surface-2/60", d.estado === "excluido" && "opacity-60", marcas.has(d.id) && marcable(d) && "bg-flesan-red/5")}>
                  {editable && (
                    <td className="pl-4 pr-1 py-2">
                      {marcable(d) && <Casilla marcada={marcas.has(d.id)} onCambio={(v) => marcar([d.id], v)} etiqueta={`Marcar a ${d.nombre}`} />}
                    </td>
                  )}
                  <td className="px-3 py-2 font-semibold text-text min-w-56">{d.nombre}</td>
                  <td className="px-3 py-2 text-muted tabular-nums">{d.numero_de_personal}</td>
                  <td className="px-3 py-2 text-muted">
                    <span className="block max-w-48 truncate" title={d.sociedad ? `${empresaDe(d.sociedad)} (${d.sociedad})` : undefined}>
                      {empresaDe(d.sociedad)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {d.centro_costo ? (
                      <>
                        <span className="tabular-nums">{d.centro_costo}</span>
                        {d.nombre_cc && (
                          <span className="block text-xs text-faint max-w-56 truncate" title={d.nombre_cc}>
                            {d.nombre_cc}
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {d.correo ? (
                      <span className="text-text">{d.correo}</span>
                    ) : (
                      <span className="text-faint">Sin correo personal en SAP</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                    {esFiniquito(d.liquidaciones) ? "Finiquito" : tiposEnvio(d.liquidaciones).map((t) => ETIQUETA_LIQUIDACION[t]).join(" + ")}
                  </td>
                  <td className="px-3 py-2">
                    <Estado tono={ESTADOS_ENVIO[d.estado].tono}>{ESTADOS_ENVIO[d.estado].texto}</Estado>
                    {d.enviado_en && <span className="block text-xs text-faint mt-0.5">{fechaHoraCorta(d.enviado_en)}</span>}
                    {d.estado === "error" && d.ultimo_error && <span className="block text-xs text-flesan-red mt-0.5 max-w-72">{d.ultimo_error}</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {lote.estado === "por_aprobar" && d.estado === "pendiente" && (
                      <BotonFila onClick={() => prueba(d)} disabled={!!ocupado} titulo={`Enviarme la liquidación de ${d.nombre} como prueba`}>
                        <MailCheck className="w-4 h-4" />
                      </BotonFila>
                    )}
                    {editable && d.estado === "pendiente" && (
                      <BotonFila onClick={() => accionFila(d, "excluir")} disabled={!!ocupado} titulo={`Excluir a ${d.nombre}`}>
                        <Ban className="w-4 h-4" />
                      </BotonFila>
                    )}
                    {editable && d.estado === "excluido" && (
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
                  <td colSpan={editable ? 9 : 8} className="px-4 py-8 text-center text-muted">
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
