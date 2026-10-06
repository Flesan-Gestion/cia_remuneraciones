import { NextResponse } from "next/server";
import { revocarUsuario } from "@/lib/usuarios-db";
import { esAdmin } from "@/lib/roles";
import { respuestaNoAutorizado, sesionConRol } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";

/** Revierte al usuario al default (miembro, perfil jefatura) — no queda "sin rol". */
export async function DELETE(_request: Request, { params }: { params: Promise<{ correo: string }> }) {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();

  const { correo } = await params;
  const correoNormalizado = decodeURIComponent(correo).toLowerCase();

  try {
    await revocarUsuario(correoNormalizado);
    await registrarActividad({ correo: sesion.email, accion: "Quitó acceso administrado", entidad: "Usuario", entidadId: correoNormalizado });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return NextResponse.json({ error: "Error al eliminar en la base de datos." }, { status: 500 });
  }
}
