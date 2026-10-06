import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { sesionConAcceso } from "@/lib/liquidaciones/acceso";
import { listarEmpresas, listarPeriodos } from "@/lib/liquidaciones/consultas";

/** Opciones de los filtros según el perfil: empresas y CC que puede ver, y periodos con datos. */
export async function GET() {
  const sesion = await sesionConAcceso();
  if (!sesion) return respuestaNoAutorizado();
  const { acceso } = sesion;
  if (acceso.perfil === "sin_acceso") {
    return NextResponse.json({ perfil: acceso.perfil, sinBase: acceso.sinBase ?? false, empresas: [], periodos: [] });
  }
  try {
    const [empresas, periodos] = await Promise.all([listarEmpresas(acceso), listarPeriodos()]);
    return NextResponse.json({ perfil: acceso.perfil, sinBase: false, empresas, periodos });
  } catch (error) {
    console.error("Error al leer los filtros de liquidaciones:", error);
    return NextResponse.json({ error: "No se pudo leer la base de datos." }, { status: 500 });
  }
}
