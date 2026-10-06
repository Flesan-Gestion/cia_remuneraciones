import { NextResponse } from "next/server";
import { esAdmin } from "@/lib/roles";
import { respuestaNoAutorizado, sesionConRol } from "@/lib/auth-guard";
import { terminarAviso } from "@/lib/configuracion-db";

// Terminar un aviso ahora (solo administradores). No se borra: queda en el historial.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  try {
    const ok = await terminarAviso(id);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "El aviso ya había terminado." }, { status: 409 });
  } catch (error) {
    console.error("Error al terminar aviso:", error);
    return NextResponse.json({ error: "Error al guardar en la base de datos." }, { status: 500 });
  }
}
