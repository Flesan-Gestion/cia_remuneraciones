import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { sesionConAccesoLibro } from "@/lib/libro/acceso";
import { listarEmpresasLibro } from "@/lib/libro/consultas";
import { listarPeriodos } from "@/lib/liquidaciones/consultas";

/** Opciones de los filtros del libro según el rol: empresas y CC que puede elegir, y periodos. */
export async function GET() {
  const sesion = await sesionConAccesoLibro();
  if (!sesion) return respuestaNoAutorizado();
  const { acceso } = sesion;
  if (!acceso.rol) {
    return NextResponse.json({ rol: null, sinBase: acceso.sinBase ?? false, empresas: [], periodos: [] });
  }
  try {
    const [empresas, periodos] = await Promise.all([listarEmpresasLibro(acceso), listarPeriodos()]);
    // ver_planta se usa en el servidor al generar el libro; no viaja al navegador.
    return NextResponse.json({
      rol: acceso.rol,
      sinBase: false,
      empresas: empresas.map((e) => ({ codigo: e.codigo, nombre: e.nombre, centros: e.centros })),
      periodos,
    });
  } catch (error) {
    console.error("Error al leer los filtros del libro de remuneraciones:", error);
    return NextResponse.json({ error: "No se pudo leer la base de datos." }, { status: 500 });
  }
}
