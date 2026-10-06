import { periodoAnterior } from "@/lib/liquidaciones/formato";
import { existeLote, leerConfiguracion, recuperarInterrumpidos } from "@/lib/liquidaciones/envios-db";
import { avisarLoteListo, ENVIO_HABILITADO, lanzarEnvio, prepararLote } from "@/lib/liquidaciones/envios";

/**
 * Programador del envío mensual (arranca desde instrumentation.ts). Cada 10 minutos:
 * - Desde el día configurado del mes (hora de Chile), si el periodo anterior no tiene lote (ni
 *   siquiera uno cancelado), lo prepara y avisa a RR.HH. Si las liquidaciones aún no están
 *   cargadas, vuelve a intentar en la siguiente vuelta.
 * - Retoma los lotes aprobados con correos pendientes (tope diario o reinicio del servidor).
 *
 * Solo corre con ENVIO_HABILITADO=true: dev y producción comparten la base de QA, y solo la
 * instancia de producción debe preparar lotes y enviar.
 */

const CADA_MS = 10 * 60_000;

declare global {
  var _programadorLiquidaciones: boolean | undefined;
}

/** Fecha de hoy en Chile, sin importar la zona horaria del servidor o del contenedor. */
function hoyEnChile() {
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  return { dia, fecha: new Date(anio, mes - 1, dia) };
}

async function vuelta() {
  try {
    const config = await leerConfiguracion();
    const hoy = hoyEnChile();
    if (config.activo && hoy.dia >= config.dia_mes) {
      const periodo = periodoAnterior(hoy.fecha);
      if (!(await existeLote(periodo, true))) {
        const r = await prepararLote(periodo, "sistema");
        if ("id" in r) {
          console.log(`[programador] lote ${r.id} de ${periodo} preparado (${r.total} personas).`);
          await avisarLoteListo(r.id, periodo, r.total, r.sinCorreo);
        }
      }
    }
    lanzarEnvio();
  } catch (error) {
    console.error("[programador de liquidaciones]", error);
  }
}

export function iniciarProgramador() {
  if (!ENVIO_HABILITADO || globalThis._programadorLiquidaciones) return;
  globalThis._programadorLiquidaciones = true;
  console.log("[programador] envío mensual de liquidaciones activo.");
  setTimeout(async () => {
    await recuperarInterrumpidos().catch((e) => console.error("[programador]", e));
    await vuelta();
    setInterval(vuelta, CADA_MS);
  }, 60_000);
}
