import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";
import { sesionConAcceso } from "@/lib/liquidaciones/acceso";
import { cambiarExclusion, leerFila, leerLote } from "@/lib/liquidaciones/envios-db";
import { reenviarFila } from "@/lib/liquidaciones/envios";

/** Acciones sobre una persona del lote: excluir, incluir o reenviar (solo RR.HH.). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; detalleId: string }> }) {
  const sesion = await sesionConAcceso();
  if (sesion?.acceso.perfil !== "rrhh") return respuestaNoAutorizado();
  const p = await params;
  const loteId = Number(p.id);
  const id = Number(p.detalleId);
  const { accion } = ((await request.json().catch(() => null)) ?? {}) as { accion?: string };

  try {
    const [lote, fila] = await Promise.all([leerLote(loteId), leerFila(loteId, id)]);
    if (!lote || !fila) return NextResponse.json({ error: "No existe esa persona en el envío." }, { status: 404 });

    if (accion === "excluir" || accion === "incluir") {
      if (!(await cambiarExclusion(loteId, id, accion === "excluir"))) {
        return NextResponse.json({ error: "Solo se puede cambiar antes de aprobar el envío." }, { status: 409 });
      }
      await registrarActividad({
        correo: sesion.email,
        accion: accion === "excluir" ? "Excluyó del envío" : "Incluyó en el envío",
        entidad: "Envío por correo",
        entidadId: loteId,
        detalle: { periodo: lote.periodo, np: fila.numero_de_personal, nombre: fila.nombre },
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === "reenviar") {
      if (!["enviando", "pausado", "enviado"].includes(lote.estado) || !["enviado", "error"].includes(fila.estado)) {
        return NextResponse.json({ error: "Solo se reenvía lo ya enviado o con error, en un envío aprobado." }, { status: 409 });
      }
      const r = await reenviarFila(fila, lote.periodo);
      await registrarActividad({
        correo: sesion.email,
        accion: "Reenvió liquidación",
        entidad: "Envío por correo",
        entidadId: loteId,
        detalle: { periodo: lote.periodo, np: fila.numero_de_personal, nombre: fila.nombre, para: fila.correo, ok: r.ok },
      });
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: `No se pudo reenviar: ${r.error}` }, { status: 502 });
    }

    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (error) {
    console.error("Error en la acción sobre la persona:", error);
    return NextResponse.json({ error: "No se pudo completar la acción." }, { status: 500 });
  }
}
