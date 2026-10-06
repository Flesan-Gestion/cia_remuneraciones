import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { sesionConAcceso } from "@/lib/liquidaciones/acceso";
import { leerConfiguracion, listarLotes } from "@/lib/liquidaciones/envios-db";
import { ENVIO_HABILITADO, prepararLote } from "@/lib/liquidaciones/envios";

async function sesionRrhh() {
  const sesion = await sesionConAcceso();
  return sesion?.acceso.perfil === "rrhh" ? sesion : null;
}

/** Programación y lotes del envío por correo (solo RR.HH.). */
export async function GET() {
  if (!(await sesionRrhh())) return respuestaNoAutorizado();
  try {
    const [configuracion, lotes] = await Promise.all([leerConfiguracion(), listarLotes()]);
    return NextResponse.json({ configuracion, lotes, envioHabilitado: ENVIO_HABILITADO });
  } catch (error) {
    console.error("Error al leer los envíos:", error);
    return NextResponse.json({ error: "No se pudo leer la base de datos." }, { status: 500 });
  }
}

/** Preparar a mano el lote de un periodo (queda por aprobar). */
export async function POST(request: Request) {
  const sesion = await sesionRrhh();
  if (!sesion) return respuestaNoAutorizado();
  const { periodo } = ((await request.json().catch(() => null)) ?? {}) as { periodo?: string };
  if (!periodo || !/^\d{6}$/.test(periodo)) return NextResponse.json({ error: "Elige un periodo." }, { status: 400 });
  try {
    const r = await prepararLote(periodo, sesion.email);
    if ("error" in r) return NextResponse.json(r, { status: 409 });
    return NextResponse.json(r);
  } catch (error) {
    console.error("Error al preparar el lote:", error);
    return NextResponse.json({ error: "No se pudo preparar el envío." }, { status: 500 });
  }
}
