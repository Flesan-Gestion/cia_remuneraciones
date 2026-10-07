import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";
import { sesionConAccesoLibro } from "@/lib/libro/acceso";
import { consultarFiniquitos, listarEmpresasFiniquitos } from "@/lib/finiquitos/consultas";
import { generarExcelFiniquitos, NOMBRE_ARCHIVO_FINIQUITOS } from "@/lib/finiquitos/excel";
import { veFiniquitos } from "@/lib/finiquitos/tipos";
import { leerFiltrosFiniquitos } from "@/lib/finiquitos/validar";

/**
 * Excel de finiquitos con los filtros elegidos. Lo que puede ver cada rol se calcula aquí (en el
 * antiguo viajaba en la URL desde el navegador). Cada descarga queda en el registro de actividad con
 * los filtros y la cantidad de filas y personas.
 */
export async function POST(request: Request) {
  const sesion = await sesionConAccesoLibro();
  if (!sesion) return respuestaNoAutorizado();
  const { acceso } = sesion;
  if (!veFiniquitos(acceso)) return respuestaNoAutorizado("No tienes acceso a los finiquitos.");

  const filtros = leerFiltrosFiniquitos(await request.json().catch(() => null));
  if (typeof filtros === "string") return NextResponse.json({ error: filtros }, { status: 400 });

  try {
    // Sin centros de costo en su lista, el antiguo no le mostraba los filtros (salvo que fuera encargado o GGO).
    const todas = acceso.rol === "administrador" || acceso.rol === "rrhh";
    const [formulario, datos] = await Promise.all([
      todas || listarEmpresasFiniquitos(acceso).then((l) => l.formulario),
      consultarFiniquitos(filtros, acceso),
    ]);
    if (!formulario) return respuestaNoAutorizado("No tienes centros de costo asignados.");
    if (!datos.detalle.length) return NextResponse.json({ error: "Sin resultados para esos filtros." }, { status: 404 });
    const personas = new Set(datos.detalle.map((f) => f.np)).size;

    const registrado = await registrarActividad({
      correo: sesion.email,
      accion: "Descargó los finiquitos",
      entidad: "Finiquitos",
      detalle: { filtros, rol: acceso.rol, filas: datos.detalle.length, personas },
    });
    // En producción no sale un Excel sin dejar rastro de quién lo descargó.
    if (!registrado && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "No se pudo registrar la descarga. Intenta de nuevo." }, { status: 503 });
    }

    const excel = await generarExcelFiniquitos(datos, filtros);
    return new NextResponse(new Uint8Array(excel), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${NOMBRE_ARCHIVO_FINIQUITOS}"`,
        "Cache-Control": "no-store",
        "X-Archivo": NOMBRE_ARCHIVO_FINIQUITOS,
        "X-Filas": String(datos.detalle.length),
        "X-Personas": String(personas),
      },
    });
  } catch (error) {
    console.error("Error al generar los finiquitos:", error);
    return NextResponse.json({ error: "No se pudo generar el Excel de finiquitos." }, { status: 500 });
  }
}
