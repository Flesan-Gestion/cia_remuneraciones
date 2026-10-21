import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { sesionConAcceso } from "@/lib/liquidaciones/acceso";
import { filasVista, listarLiquidaciones, resumirLiquidaciones } from "@/lib/liquidaciones/consultas";
import { leerFiltros } from "@/lib/liquidaciones/validar";

/** Vista previa: las liquidaciones que calzan con los filtros y que el usuario puede ver. */
export async function POST(request: Request) {
  const sesion = await sesionConAcceso();
  if (!sesion) return respuestaNoAutorizado();
  if (sesion.acceso.perfil === "sin_acceso") return respuestaNoAutorizado("No tienes acceso a liquidaciones.");

  const filtros = leerFiltros(await request.json().catch(() => null));
  if (typeof filtros === "string") return NextResponse.json({ error: filtros }, { status: 400 });

  try {
    const listado = await listarLiquidaciones(filtros, sesion.acceso);
    return NextResponse.json({ filas: filasVista(listado, await resumirLiquidaciones(listado)) });
  } catch (error) {
    console.error("Error al buscar liquidaciones:", error);
    return NextResponse.json({ error: "No se pudo leer la base de datos." }, { status: 500 });
  }
}
