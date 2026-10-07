import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { sesionConAccesoLibro } from "@/lib/libro/acceso";
import { listarEmpresasFiniquitos, listarSemanas } from "@/lib/finiquitos/consultas";
import { veFiniquitos } from "@/lib/finiquitos/tipos";

/** Opciones de los filtros de finiquitos según el rol: empresas y CC que puede elegir, y semanas de pago. */
export async function GET() {
  const sesion = await sesionConAccesoLibro();
  if (!sesion) return respuestaNoAutorizado();
  const { acceso } = sesion;
  if (!veFiniquitos(acceso)) {
    return NextResponse.json({ rol: null, sinBase: acceso.sinBase ?? false, empresas: [], periodos: [], formulario: false });
  }
  try {
    const [{ empresas, formulario }, periodos] = await Promise.all([listarEmpresasFiniquitos(acceso), listarSemanas()]);
    return NextResponse.json({
      rol: acceso.rol,
      sinBase: false,
      empresas: empresas.map((e) => ({ codigo: e.codigo, clave: e.clave, nombre: e.nombre, centros: e.centros })),
      periodos,
      formulario,
    });
  } catch (error) {
    console.error("Error al leer los filtros de finiquitos:", error);
    return NextResponse.json({ error: "No se pudo leer la base de datos." }, { status: 500 });
  }
}
