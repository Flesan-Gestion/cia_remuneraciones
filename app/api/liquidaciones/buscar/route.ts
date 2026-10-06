import { NextResponse } from "next/server";
import { respuestaNoAutorizado } from "@/lib/auth-guard";
import { sesionConAcceso } from "@/lib/liquidaciones/acceso";
import { claveDe, listarLiquidaciones, resumirLiquidaciones } from "@/lib/liquidaciones/consultas";
import { leerFiltros } from "@/lib/liquidaciones/validar";
import type { FilaVista } from "@/lib/liquidaciones/tipos";

/** Vista previa: las liquidaciones que calzan con los filtros y que el usuario puede ver. */
export async function POST(request: Request) {
  const sesion = await sesionConAcceso();
  if (!sesion) return respuestaNoAutorizado();
  if (sesion.acceso.perfil === "sin_acceso") return respuestaNoAutorizado("No tienes acceso a liquidaciones.");

  const filtros = leerFiltros(await request.json().catch(() => null));
  if (typeof filtros === "string") return NextResponse.json({ error: filtros }, { status: 400 });

  try {
    const listado = await listarLiquidaciones(filtros, sesion.acceso);
    const resumen = await resumirLiquidaciones(listado);
    const vistas = new Set<string>();
    const filas: FilaVista[] = [];
    for (const l of listado) {
      const clave = claveDe(l);
      // El original repetía la página si la persona aparecía con dos sociedades; aquí va una vez.
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      const r = resumen.get(clave);
      filas.push({
        clave,
        nombre: l.apellido_nombre,
        numero_de_personal: l.numero_de_personal,
        rut: r?.national_id ?? null,
        sociedad: l.sociedad,
        centro_costo: l.centro_costo,
        nombre_cc: r?.nombre_centro_costo ?? null,
        periodo_para_nomina: l.periodo_para_nomina,
        periodo_efectivo: l.periodo_efectivo,
        fuera_de_ciclo: l.periodo_para_nomina === "000000",
        liquido: r?.liquido == null ? null : Number(r.liquido),
      });
    }
    return NextResponse.json({ filas });
  } catch (error) {
    console.error("Error al buscar liquidaciones:", error);
    return NextResponse.json({ error: "No se pudo leer la base de datos." }, { status: 500 });
  }
}
