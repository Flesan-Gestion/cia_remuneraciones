import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { sesionConAccesoLibro } from "@/lib/libro/acceso";
import { listarEmpresasProrrateado, listarPeriodosProrrateado } from "@/lib/libro-prorrateado/consultas";
import { veProrrateado } from "@/lib/libro-prorrateado/tipos";

/** Opciones de los filtros del libro prorrateado según el rol: empresas y CC que puede elegir, y meses. */
export async function GET() {
  const sesion = await sesionConAccesoLibro();
  if (!sesion) return respuestaNoAutorizado();
  const { acceso } = sesion;
  if (!veProrrateado(acceso)) {
    return NextResponse.json({ rol: null, sinBase: acceso.sinBase ?? false, empresas: [], periodos: [] });
  }
  try {
    const [empresas, periodos] = await Promise.all([listarEmpresasProrrateado(acceso), listarPeriodosProrrateado()]);
    return NextResponse.json({
      rol: acceso.rol,
      sinBase: false,
      empresas: empresas.map((e) => ({ codigo: e.codigo, nombre: e.nombre, centros: e.centros })),
      periodos,
    });
  } catch (error) {
    console.error("Error al leer los filtros del libro prorrateado:", error);
    return NextResponse.json({ error: "No se pudo leer la base de datos." }, { status: 500 });
  }
}
