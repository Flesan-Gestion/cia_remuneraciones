import { NextResponse } from "next/server";
import { esAdmin } from "@/lib/roles";
import { respuestaNoAutorizado, sesionConRol } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";
import { cambiarFuncion, funcionesDe, leerEncargados, type Funcion } from "@/lib/encargados-cc";

/**
 * Encargados de centros de costo (copia de tabla_encargados_cc, db/006), por persona: lo que hacía
 * «Configurar Centros de Costos» del PHP. Solo administradores.
 */

const CORREO = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const FUNCIONES = new Set<Funcion>(["encargado", "visitador", "ggo"]);
const ETIQUETA: Record<Funcion, string> = { encargado: "encargado", visitador: "visitador", ggo: "GGO" };

/**
 * ?correo= → sus centros y funciones, y el catálogo de centros de la tabla (como getlistCentrosGestion).
 * Sin correo → todos los centros de la tabla con su encargado, visitador, GGO y marcas (pestaña
 * «Centros de costo»).
 */
export async function GET(request: Request) {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();
  const filas = await leerEncargados();
  if (!filas) return NextResponse.json({ error: "Falta aplicar db/006_encargados_cc.sql en cia_liquidaciones." }, { status: 503 });

  const parametro = new URL(request.url).searchParams.get("correo");
  if (parametro === null) {
    // Un centro puede tener varias filas (49 hoy); el UPDATE del PHP las tocaba todas, así que se
    // muestran juntas con lo de la primera y la marca «filas».
    const centros = new Map<string, { sociedad: string; centroCoto: string; encargado: string | null; visitador: string | null; ggo: string[]; verPlanta: boolean; administrador: boolean; filas: number }>();
    for (const f of filas) {
      if (!f.sociedad || !f.centro_coto) continue;
      const clave = `${f.sociedad}|${f.centro_coto}`;
      const actual = centros.get(clave);
      if (actual) {
        actual.filas += 1;
        continue;
      }
      centros.set(clave, {
        sociedad: f.sociedad,
        centroCoto: f.centro_coto,
        encargado: f.correo?.trim() || null,
        visitador: f.visitador?.trim() || null,
        ggo: (f.correo_ggo ?? "").split(",").map((g) => g.trim()).filter(Boolean),
        verPlanta: Boolean((f.ver_planta ?? "").trim()),
        administrador: Boolean((f.administrador ?? "").trim()),
        filas: 1,
      });
    }
    return NextResponse.json({ centros: [...centros.values()] });
  }

  const correo = parametro.trim().toLowerCase();
  if (!CORREO.test(correo)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });

  const catalogo = new Map<string, { sociedad: string; centroCoto: string; encargado: string | null; visitador: string | null }>();
  for (const f of filas) {
    if (!f.sociedad || !f.centro_coto) continue;
    const clave = `${f.sociedad}|${f.centro_coto}`;
    if (!catalogo.has(clave)) catalogo.set(clave, { sociedad: f.sociedad, centroCoto: f.centro_coto, encargado: f.correo, visitador: f.visitador });
  }
  return NextResponse.json({
    centros: funcionesDe(filas, correo),
    catalogo: [...catalogo.values()].sort((a, b) => a.sociedad.localeCompare(b.sociedad, "es") || a.centroCoto.localeCompare(b.centroCoto, "es")),
  });
}

/** Asigna o quita una función de una persona en un centro (insertColaborador del PHP). */
export async function POST(request: Request) {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();

  const body = (await request.json().catch(() => null)) as {
    correo?: unknown;
    sociedad?: unknown;
    centroCoto?: unknown;
    funcion?: unknown;
    asignar?: unknown;
  } | null;
  const correo = typeof body?.correo === "string" ? body.correo.trim().toLowerCase() : "";
  const sociedad = typeof body?.sociedad === "string" ? body.sociedad : "";
  const centroCoto = typeof body?.centroCoto === "string" ? body.centroCoto : "";
  const funcion = body?.funcion as Funcion;
  const asignar = body?.asignar === true;
  if (!CORREO.test(correo) || !sociedad || !centroCoto || sociedad.length > 200 || centroCoto.length > 300 || !FUNCIONES.has(funcion)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  try {
    const filas = (await leerEncargados()) ?? [];
    const fila = filas.find((f) => f.sociedad === sociedad && f.centro_coto === centroCoto);
    if (!fila) return NextResponse.json({ error: "Ese centro de costo no está en la tabla de encargados." }, { status: 404 });
    const anterior = funcion === "encargado" ? fila.correo : funcion === "visitador" ? fila.visitador : null;
    const filasCambiadas = await cambiarFuncion({ centro: { sociedad, centroCoto }, funcion, correo, asignar, por: sesion.email });
    await registrarActividad({
      correo: sesion.email,
      accion: asignar ? `Asignó ${ETIQUETA[funcion]} de CC` : `Quitó ${ETIQUETA[funcion]} de CC`,
      entidad: "Usuario",
      entidadId: correo,
      detalle: { sociedad, centro_coto: centroCoto, funcion, ...(asignar && anterior ? { reemplaza_a: anterior } : {}), filas: filasCambiadas },
    });
    return NextResponse.json({ ok: true, filas: filasCambiadas, anterior: asignar ? anterior : null });
  } catch (error) {
    console.error("Error al cambiar el encargado del CC:", error);
    return NextResponse.json({ error: "Error al guardar en la base de datos." }, { status: 500 });
  }
}
