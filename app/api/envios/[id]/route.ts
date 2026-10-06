import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";
import { sesionConAcceso } from "@/lib/liquidaciones/acceso";
import { cambiarEstadoLote, leerLote, listarDetalle, reintentarErrores } from "@/lib/liquidaciones/envios-db";
import { ENVIO_HABILITADO, enviarPrueba, lanzarEnvio } from "@/lib/liquidaciones/envios";
import type { EstadoLote } from "@/lib/liquidaciones/tipos";

type Contexto = { params: Promise<{ id: string }> };

async function preparar(params: Contexto["params"]) {
  const sesion = await sesionConAcceso();
  if (sesion?.acceso.perfil !== "rrhh") return null;
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? { sesion, id } : null;
}

/** Un lote con sus personas (solo RR.HH.). */
export async function GET(_request: Request, { params }: Contexto) {
  const ctx = await preparar(params);
  if (!ctx) return respuestaNoAutorizado();
  try {
    const lote = await leerLote(ctx.id);
    if (!lote) return NextResponse.json({ error: "No existe ese envío." }, { status: 404 });
    return NextResponse.json({ lote, detalle: await listarDetalle(ctx.id), envioHabilitado: ENVIO_HABILITADO });
  } catch (error) {
    console.error("Error al leer el lote:", error);
    return NextResponse.json({ error: "No se pudo leer la base de datos." }, { status: 500 });
  }
}

const TRANSICIONES: Record<string, { desde: EstadoLote[]; a: EstadoLote; accion: string }> = {
  aprobar: { desde: ["por_aprobar"], a: "enviando", accion: "Aprobó envío" },
  cancelar: { desde: ["por_aprobar"], a: "cancelado", accion: "Canceló envío" },
  pausar: { desde: ["enviando"], a: "pausado", accion: "Pausó envío" },
  reanudar: { desde: ["pausado"], a: "enviando", accion: "Reanudó envío" },
};

/** Acciones sobre el lote: aprobar, cancelar, pausar, reanudar, reintentar errores, prueba. */
export async function POST(request: Request, { params }: Contexto) {
  const ctx = await preparar(params);
  if (!ctx) return respuestaNoAutorizado();
  const { accion, detalleId } = ((await request.json().catch(() => null)) ?? {}) as { accion?: string; detalleId?: number };
  const { sesion, id } = ctx;

  try {
    const lote = await leerLote(id);
    if (!lote) return NextResponse.json({ error: "No existe ese envío." }, { status: 404 });

    if (accion === "prueba") {
      const detalle = await listarDetalle(id);
      const fila = detalle.find((d) => (detalleId ? d.id === detalleId : d.estado === "pendiente")) ?? detalle[0];
      if (!fila) return NextResponse.json({ error: "El envío no tiene personas." }, { status: 400 });
      const r = await enviarPrueba(fila, lote.periodo, sesion.email);
      await registrarActividad({
        correo: sesion.email,
        accion: "Envió prueba",
        entidad: "Envío por correo",
        entidadId: id,
        detalle: { periodo: lote.periodo, np: fila.numero_de_personal, nombre: fila.nombre, para: sesion.email, ok: r.ok },
      });
      return r.ok
        ? NextResponse.json({ ok: true, para: sesion.email, nombre: fila.nombre })
        : NextResponse.json({ error: `No se pudo enviar la prueba: ${r.error}` }, { status: 502 });
    }

    if (accion === "reintentar") {
      const n = await reintentarErrores(id);
      await registrarActividad({ correo: sesion.email, accion: "Reintentó errores", entidad: "Envío por correo", entidadId: id, detalle: { periodo: lote.periodo, personas: n } });
      lanzarEnvio();
      return NextResponse.json({ ok: true, reintentos: n });
    }

    const t = accion ? TRANSICIONES[accion] : undefined;
    if (!t) return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    if (!(await cambiarEstadoLote(id, t.desde, t.a, sesion.email))) {
      return NextResponse.json({ error: "El envío cambió de estado. Actualiza la página." }, { status: 409 });
    }
    await registrarActividad({ correo: sesion.email, accion: t.accion, entidad: "Envío por correo", entidadId: id, detalle: { periodo: lote.periodo } });
    if (t.a === "enviando") lanzarEnvio();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en la acción del lote:", error);
    return NextResponse.json({ error: "No se pudo completar la acción." }, { status: 500 });
  }
}
