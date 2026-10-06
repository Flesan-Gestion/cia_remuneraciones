import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";
import { sesionConAcceso } from "@/lib/liquidaciones/acceso";
import { claveDe, detallarLiquidaciones, listarLiquidaciones } from "@/lib/liquidaciones/consultas";
import { generarPdf } from "@/lib/liquidaciones/pdf";
import { leerFiltros } from "@/lib/liquidaciones/validar";

/**
 * PDF de las liquidaciones elegidas en la vista previa. El permiso se vuelve a calcular aquí con
 * los mismos filtros: solo salen las claves que el usuario puede ver, aunque el navegador pida otras.
 * Cada descarga queda en el registro de actividad con la lista de personas.
 */
export async function POST(request: Request) {
  const sesion = await sesionConAcceso();
  if (!sesion) return respuestaNoAutorizado();
  if (sesion.acceso.perfil === "sin_acceso") return respuestaNoAutorizado("No tienes acceso a liquidaciones.");

  const cuerpo = (await request.json().catch(() => null)) as { filtros?: unknown; claves?: unknown } | null;
  const filtros = leerFiltros(cuerpo?.filtros);
  if (typeof filtros === "string") return NextResponse.json({ error: filtros }, { status: 400 });
  const pedidas = new Set(Array.isArray(cuerpo?.claves) ? cuerpo.claves.filter((c): c is string => typeof c === "string") : []);
  if (!pedidas.size) return NextResponse.json({ error: "Elige al menos una liquidación." }, { status: 400 });

  try {
    const permitidas = await listarLiquidaciones(filtros, sesion.acceso);
    const vistas = new Set<string>();
    const elegidas = permitidas.filter((l) => {
      const clave = claveDe(l);
      if (!pedidas.has(clave) || vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
    if (!elegidas.length) return NextResponse.json({ error: "Sin resultados para esos filtros." }, { status: 404 });

    const detalle = await detallarLiquidaciones(elegidas);
    const registrado = await registrarActividad({
      correo: sesion.email,
      accion: "Descargó liquidaciones",
      entidad: "Liquidación",
      detalle: {
        cantidad: detalle.length,
        filtros,
        personas: elegidas.map((l) => ({ np: l.numero_de_personal, nombre: l.apellido_nombre, periodo: l.periodo_efectivo, sociedad: l.sociedad })),
      },
    });
    // En producción no sale una liquidación sin dejar rastro de quién la descargó.
    if (!registrado && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "No se pudo registrar la descarga. Intenta de nuevo." }, { status: 503 });
    }

    const pdf = await generarPdf(detalle);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="liquidacion.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error al generar el PDF de liquidaciones:", error);
    return NextResponse.json({ error: "No se pudo generar el PDF." }, { status: 500 });
  }
}
