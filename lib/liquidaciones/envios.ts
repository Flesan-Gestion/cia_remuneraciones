import { sendEmailDetallado } from "@/lib/mailer";
import { registrarActividad } from "@/lib/actividad-db";
import { contactosColaboradores, detallarLiquidaciones, listarLiquidaciones, type ClaveLiquidacion, type ContactoColaborador } from "@/lib/liquidaciones/consultas";
import { generarPdf } from "@/lib/liquidaciones/pdf";
import { correoLiquidacion, correoLoteListo, nombrePila } from "@/lib/liquidaciones/correo";
import { periodoLegible } from "@/lib/liquidaciones/formato";
import {
  cerrarSiTermino,
  correosRrhh,
  crearLote,
  devolverPendientes,
  enviadosHoy,
  existeLote,
  leerLote,
  lotesPorEnviar,
  marcarEnviado,
  marcarError,
  reclamarPendientes,
  type NuevaFilaEnvio,
} from "@/lib/liquidaciones/envios-db";
import type { Acceso, DetalleEnvio } from "@/lib/liquidaciones/tipos";

/**
 * Envío mensual de liquidaciones por correo. Solo runtime Node.
 *
 * 1. Preparar: arma el lote del periodo con todas las liquidaciones (como RR.HH. total) y fija el
 *    correo personal de cada persona registrado en SAP (nunca el corporativo).
 * 2. RR.HH. revisa, excluye si hace falta, prueba con su correo y aprueba.
 * 3. Este proceso envía de a poco, respetando el tope diario de la cuenta de Gmail; lo que no
 *    alcanza sale al día siguiente. Cada persona recibe un PDF con clave = RUT sin dígito verificador.
 */

/** Acceso de sistema: todas las liquidaciones, como el perfil RR.HH. */
const TODO: Acceso = { correo: "sistema", perfil: "rrhh", empresas: null };

/** Tope de correos por día (Gmail Workspace permite ~2.000 por cuenta y la cuenta es compartida). */
const MAX_DIA = Number(process.env.ENVIO_MAX_DIA ?? 1500);
/** Pausa entre correos, para no gatillar los límites de Gmail. */
const PAUSA_MS = Number(process.env.ENVIO_PAUSA_MS ?? 1500);
/** Solo la instancia de producción envía en masa (dev y producción comparten la base de QA). */
export const ENVIO_HABILITADO = process.env.ENVIO_HABILITADO === "true";

const SIN_CORREO = "sincorreo@flesan.cl";

function correoValido(valor: string | null | undefined) {
  const v = valor?.trim().toLowerCase();
  return v && v !== SIN_CORREO && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

/** Solo el correo personal registrado en SAP, nunca el corporativo (decisión 2026-10-06). Si en
 * el campo personal hay un correo @flesan.cl, la persona queda sin correo. */
function elegirCorreo(c: ContactoColaborador | undefined): Pick<NuevaFilaEnvio, "correo" | "origen_correo"> {
  const personal = correoValido(c?.correo_gmail);
  if (personal && !personal.endsWith("@flesan.cl")) return { correo: personal, origen_correo: "personal" };
  return { correo: null, origen_correo: null };
}

export async function prepararLote(periodo: string, creadoPor: string): Promise<{ id: number; total: number; sinCorreo: number } | { error: string }> {
  if (await existeLote(periodo, false)) return { error: `Ya hay un envío de ${periodoLegible(periodo)}.` };
  const listado = await listarLiquidaciones({ empresa: null, cc: null, desde: periodo, hasta: periodo, persona: null, planta: null }, TODO);
  if (!listado.length) return { error: `No hay liquidaciones de ${periodoLegible(periodo)} todavía.` };

  // Una fila por persona, con todas sus liquidaciones del periodo (normal y fuera de ciclo).
  const porPersona = new Map<string, NuevaFilaEnvio>();
  for (const f of listado) {
    let fila = porPersona.get(f.numero_de_personal);
    if (!fila) {
      fila = { numero_de_personal: f.numero_de_personal, nombre: f.apellido_nombre, sociedad: f.sociedad, correo: null, origen_correo: null, liquidaciones: [] };
      porPersona.set(f.numero_de_personal, fila);
    }
    if (!fila.liquidaciones.some((l) => l.periodo_para_nomina === f.periodo_para_nomina && l.periodo_efectivo === f.periodo_efectivo)) {
      fila.liquidaciones.push({ periodo_para_nomina: f.periodo_para_nomina, periodo_efectivo: f.periodo_efectivo });
    }
  }
  const filas = [...porPersona.values()];
  const contactos = await contactosColaboradores(filas.map((f) => ({ numero_de_personal: f.numero_de_personal, sociedad: f.sociedad ?? "" })));
  for (const f of filas) Object.assign(f, elegirCorreo(contactos.get(`${f.numero_de_personal}|${f.sociedad}`)));

  const id = await crearLote(periodo, creadoPor, filas);
  const sinCorreo = filas.filter((f) => !f.correo).length;
  await registrarActividad({
    correo: creadoPor,
    accion: "Preparó envío",
    entidad: "Envío por correo",
    entidadId: id,
    detalle: { periodo, personas: filas.length, sin_correo: sinCorreo },
  });
  return { id, total: filas.length, sinCorreo };
}

/** Avisa a RR.HH. que hay un lote para revisar. */
export async function avisarLoteListo(id: number, periodo: string, total: number, sinCorreo: number) {
  const para = await correosRrhh();
  if (!para.length) return;
  const url = (process.env.AUTH_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");
  const correo = correoLoteListo({ periodo, total, sinCorreo, enlace: `${url}/envios/${id}` });
  await sendEmailDetallado({ to: para, subject: correo.subject, html: correo.html });
}

function pedidosDe(filas: DetalleEnvio[]): ClaveLiquidacion[] {
  return filas.flatMap((f) => f.liquidaciones.map((l) => ({ numero_de_personal: f.numero_de_personal, ...l })));
}

/** Arma el PDF con clave de una persona y lo envía a `para`. */
async function enviarFila(
  fila: DetalleEnvio,
  periodo: string,
  detalles: Map<string, Awaited<ReturnType<typeof detallarLiquidaciones>>>,
  para: string,
  prueba = false,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const liquidaciones = detalles.get(fila.numero_de_personal) ?? [];
  if (!liquidaciones.length) return { ok: false, error: "No se encontraron los conceptos de la liquidación." };
  const rut = liquidaciones[0].rut;
  if (!rut) return { ok: false, error: "No tiene RUT en el maestro: no se puede proteger el PDF." };
  const pdf = await generarPdf(liquidaciones, rut);
  const correo = correoLiquidacion({ nombre: nombrePila(liquidaciones[0].nombre_completo), periodo, prueba: prueba ? { para } : undefined });
  return sendEmailDetallado({
    to: para,
    subject: correo.subject,
    html: correo.html,
    attachments: [{ filename: correo.archivo, content: pdf, contentType: "application/pdf" }],
  });
}

async function detallesPorPersona(filas: DetalleEnvio[]) {
  const detalle = await detallarLiquidaciones(pedidosDe(filas));
  const mapa = new Map<string, typeof detalle>();
  for (const d of detalle) {
    const lista = mapa.get(d.numero_de_personal) ?? [];
    lista.push(d);
    mapa.set(d.numero_de_personal, lista);
  }
  return mapa;
}

/** Correo de prueba: la liquidación de `fila` va al correo de quien prueba, no a la persona. */
export async function enviarPrueba(fila: DetalleEnvio, periodo: string, para: string) {
  const detalles = await detallesPorPersona([fila]);
  return enviarFila(fila, periodo, detalles, para, true);
}

/** Reenvío individual, al correo fijado en el lote. */
export async function reenviarFila(fila: DetalleEnvio, periodo: string) {
  if (!fila.correo) return { ok: false as const, error: "No tiene correo." };
  const detalles = await detallesPorPersona([fila]);
  const r = await enviarFila(fila, periodo, detalles, fila.correo);
  if (r.ok) await marcarEnviado(fila.id);
  else await marcarError(fila.id, r.error);
  return r;
}

// ---------------------------------------------------------------- proceso de envío en masa

declare global {
  var _envioLiquidacionesEnCurso: boolean | undefined;
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lanza el envío en segundo plano si no hay uno en curso en este proceso. */
export function lanzarEnvio() {
  if (!ENVIO_HABILITADO || globalThis._envioLiquidacionesEnCurso) return;
  globalThis._envioLiquidacionesEnCurso = true;
  procesarEnvios()
    .catch((e) => console.error("[envío de liquidaciones]", e))
    .finally(() => {
      globalThis._envioLiquidacionesEnCurso = false;
    });
}

async function procesarEnvios() {
  for (const loteId of await lotesPorEnviar()) {
    for (;;) {
      const lote = await leerLote(loteId);
      if (!lote || lote.estado !== "enviando") break;
      const cupo = MAX_DIA - (await enviadosHoy());
      if (cupo <= 0) {
        console.log(`[envío de liquidaciones] tope diario de ${MAX_DIA} correos alcanzado; sigue mañana.`);
        return;
      }
      const filas = await reclamarPendientes(loteId, Math.min(25, cupo));
      if (!filas.length) {
        await cerrarSiTermino(loteId);
        break;
      }
      const detalles = await detallesPorPersona(filas);
      for (let i = 0; i < filas.length; i++) {
        const fila = filas[i];
        // Si lo pausaron mientras tanto, lo que falta vuelve a la cola.
        if (i > 0 && i % 5 === 0 && (await leerLote(loteId))?.estado !== "enviando") {
          await devolverPendientes(filas.slice(i).map((f) => f.id));
          return;
        }
        try {
          const r = await enviarFila(fila, lote.periodo, detalles, fila.correo ?? "");
          if (r.ok) await marcarEnviado(fila.id);
          else await marcarError(fila.id, r.error);
        } catch (e) {
          await marcarError(fila.id, e instanceof Error ? e.message : String(e));
        }
        await pausa(PAUSA_MS);
      }
    }
  }
}
