import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";
import { sesionConAcceso } from "@/lib/liquidaciones/acceso";
import { guardarConfiguracion } from "@/lib/liquidaciones/envios-db";

/** Día del mes en que se prepara el envío, y si está activo (solo RR.HH.). */
export async function PUT(request: Request) {
  const sesion = await sesionConAcceso();
  if (sesion?.acceso.perfil !== "rrhh") return respuestaNoAutorizado();
  const { diaMes, activo } = ((await request.json().catch(() => null)) ?? {}) as { diaMes?: number; activo?: boolean };
  if (!Number.isInteger(diaMes) || diaMes! < 1 || diaMes! > 28 || typeof activo !== "boolean") {
    return NextResponse.json({ error: "El día debe ser un número entre 1 y 28." }, { status: 400 });
  }
  try {
    await guardarConfiguracion(diaMes!, activo, sesion.email);
    await registrarActividad({
      correo: sesion.email,
      accion: "Cambió la programación",
      entidad: "Envío por correo",
      detalle: { dia_mes: diaMes, activo },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al guardar la programación:", error);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
