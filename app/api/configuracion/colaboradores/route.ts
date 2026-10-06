import { NextResponse } from "next/server";
import { esAdmin } from "@/lib/roles";
import { respuestaNoAutorizado, sesionConRol } from "@/lib/auth-guard";
import { listarColaboradores } from "@/lib/colaboradores-db";

export async function GET() {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();

  try {
    const colaboradores = await listarColaboradores();
    return NextResponse.json({ colaboradores });
  } catch (error) {
    console.error("Error al leer maestro de colaboradores:", error);
    return NextResponse.json({ error: "No se pudo leer el maestro de colaboradores." }, { status: 500 });
  }
}
