import { NextResponse } from "next/server";
import { esAdmin } from "@/lib/roles";
import { respuestaNoAutorizado, sesionConRol } from "@/lib/auth-guard";
import { listarActividad } from "@/lib/actividad-db";

/** Registro de actividad de los últimos días (solo administradores). */
export async function GET(request: Request) {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();
  const dias = Math.min(Math.max(Number(new URL(request.url).searchParams.get("dias")) || 7, 1), 365);
  const eventos = await listarActividad(dias);
  if (!eventos) return NextResponse.json({ error: "El registro de actividad no está disponible (falta la tabla)." }, { status: 503 });
  return NextResponse.json({ eventos });
}
