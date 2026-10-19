import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";
import { sesionConAcceso } from "@/lib/liquidaciones/acceso";
import { cambiarExclusiones, leerLote } from "@/lib/liquidaciones/envios-db";
import type { AccionExclusion } from "@/lib/liquidaciones/tipos";

const ACCIONES: AccionExclusion[] = ["excluir", "incluir", "solo"];

/**
 * Excluir o volver a incluir personas del lote (una o varias de una vez), o dejar por enviar solo a
 * esas (solo RR.HH.). Antes de aprobar el envío o con el envío pausado. `criterio` describe qué se
 * eligió (marcas o filtro) para el registro de actividad.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionConAcceso();
  if (sesion?.acceso.perfil !== "rrhh") return respuestaNoAutorizado();
  const loteId = Number((await params).id);
  const { accion, ids, criterio } = ((await request.json().catch(() => null)) ?? {}) as { accion?: AccionExclusion; ids?: unknown; criterio?: unknown };
  if (!Number.isInteger(loteId) || loteId <= 0 || !accion || !ACCIONES.includes(accion)) {
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  }
  if (!Array.isArray(ids) || !ids.length || ids.length > 10_000 || !ids.every((n) => Number.isInteger(n) && n > 0)) {
    return NextResponse.json({ error: "Elige al menos una persona." }, { status: 400 });
  }

  try {
    const lote = await leerLote(loteId);
    if (!lote) return NextResponse.json({ error: "No existe ese envío." }, { status: 404 });
    const r = await cambiarExclusiones(loteId, accion, ids as number[]);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 409 });

    const texto = typeof criterio === "string" ? criterio.trim().slice(0, 300) : "";
    const comun = { periodo: lote.periodo, ...(texto && { criterio: accion === "solo" ? `dejó solo ${texto}` : texto }) };
    for (const [personas, que] of [
      [r.excluidos, "Excluyó del envío"],
      [r.incluidos, "Incluyó en el envío"],
    ] as const) {
      if (personas.length) {
        await registrarActividad({ correo: sesion.email, accion: que, entidad: "Envío por correo", entidadId: loteId, detalle: { ...comun, personas } });
      }
    }
    return NextResponse.json({ ok: true, excluidos: r.excluidos.length, incluidos: r.incluidos.length });
  } catch (error) {
    console.error("Error al excluir o incluir personas del envío:", error);
    return NextResponse.json({ error: "No se pudo completar la acción." }, { status: 500 });
  }
}
