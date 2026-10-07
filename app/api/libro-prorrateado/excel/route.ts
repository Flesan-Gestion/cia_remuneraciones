import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";
import { sesionConAccesoLibro } from "@/lib/libro/acceso";
import { exigeEmpresa } from "@/lib/libro/tipos";
import { leerFiltrosLibro } from "@/lib/libro/validar";
import { consultarProrrateado } from "@/lib/libro-prorrateado/consultas";
import { generarExcelProrrateado, NOMBRE_ARCHIVO_PRORRATEADO } from "@/lib/libro-prorrateado/excel";
import { veProrrateado } from "@/lib/libro-prorrateado/tipos";

/**
 * Excel del libro de remuneraciones prorrateado con los filtros elegidos. Lo que puede ver cada rol
 * se calcula aquí (en el antiguo viajaba en la URL desde el navegador). Cada descarga queda en el
 * registro de actividad con los filtros y la cantidad de filas y personas.
 */
export async function POST(request: Request) {
  const sesion = await sesionConAccesoLibro();
  if (!sesion) return respuestaNoAutorizado();
  const { acceso } = sesion;
  if (!veProrrateado(acceso)) return respuestaNoAutorizado("No tienes acceso al libro prorrateado.");

  const filtros = leerFiltrosLibro(await request.json().catch(() => null));
  if (typeof filtros === "string") return NextResponse.json({ error: filtros }, { status: 400 });
  if (exigeEmpresa(acceso.rol) && !filtros.empresa) return NextResponse.json({ error: "Elige la razón social." }, { status: 400 });

  try {
    const filas = await consultarProrrateado(filtros, acceso);
    if (!filas.length) return NextResponse.json({ error: "Sin resultados para esos filtros." }, { status: 404 });
    const personas = new Set(filas.map((f) => f.np)).size;

    const registrado = await registrarActividad({
      correo: sesion.email,
      accion: "Descargó el libro prorrateado",
      entidad: "Libro de remuneraciones prorrateado",
      detalle: { filtros, rol: acceso.rol, filas: filas.length, personas },
    });
    // En producción no sale un libro sin dejar rastro de quién lo descargó.
    if (!registrado && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "No se pudo registrar la descarga. Intenta de nuevo." }, { status: 503 });
    }

    const excel = await generarExcelProrrateado(filas, filtros);
    return new NextResponse(new Uint8Array(excel), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${NOMBRE_ARCHIVO_PRORRATEADO}"`,
        "Cache-Control": "no-store",
        "X-Archivo": NOMBRE_ARCHIVO_PRORRATEADO,
        "X-Filas": String(filas.length),
        "X-Personas": String(personas),
      },
    });
  } catch (error) {
    console.error("Error al generar el libro prorrateado:", error);
    return NextResponse.json({ error: "No se pudo generar el libro." }, { status: 500 });
  }
}
