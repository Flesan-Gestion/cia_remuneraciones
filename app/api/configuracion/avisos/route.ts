import { NextResponse } from "next/server";
import { esAdmin } from "@/lib/roles";
import { respuestaNoAutorizado, sesionConRol } from "@/lib/auth-guard";
import { crearAviso, listarAvisos, type NivelAviso } from "@/lib/configuracion-db";

// Configuración › Avisos (solo administradores): listar y crear.
const NIVELES = new Set<NivelAviso>(["info", "atencion", "critico"]);

export async function GET() {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();
  try {
    const avisos = await listarAvisos();
    return NextResponse.json({ disponible: avisos !== null, avisos: avisos ?? [] });
  } catch (error) {
    console.error("Error al leer avisos:", error);
    return NextResponse.json({ error: "Error al leer la base de datos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();

  let body: { mensaje?: string; nivel?: string; desde?: string | null; hasta?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const mensaje = String(body.mensaje ?? "").trim();
  const nivel = (body.nivel ?? "info") as NivelAviso;
  const fecha = (v: string | null | undefined) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
  const desde = fecha(body.desde);
  const hasta = fecha(body.hasta);

  if (!mensaje || mensaje.length > 500) {
    return NextResponse.json({ error: "El mensaje debe tener entre 1 y 500 caracteres." }, { status: 400 });
  }
  if (!NIVELES.has(nivel)) return NextResponse.json({ error: "Nivel inválido." }, { status: 400 });
  if (hasta && hasta <= (desde ?? new Date().toISOString())) {
    return NextResponse.json({ error: "El término debe ser posterior al inicio." }, { status: 400 });
  }
  try {
    const aviso = await crearAviso({ mensaje, nivel, desde, hasta, creadoPor: sesion.email });
    if (!aviso) return NextResponse.json({ error: "La plataforma aún no tiene la tabla de avisos." }, { status: 503 });
    return NextResponse.json({ aviso }, { status: 201 });
  } catch (error) {
    console.error("Error al crear aviso:", error);
    return NextResponse.json({ error: "Error al guardar en la base de datos." }, { status: 500 });
  }
}
