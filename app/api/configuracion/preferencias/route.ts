import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { guardarPreferencias, leerPreferencias } from "@/lib/configuracion-db";

// Mi personalización: preferencias del usuario en sesión. 204 = la plataforma aún no tiene la
// tabla (o no hay base): el cliente sigue con lo guardado en el navegador.

const CLAVES = new Set(["tema", "texto", "densidad", "reducirAnimaciones", "inicio", "widgetCia", "widgetMinimizado", "portales", "tutoriales", "ofrecerTutoriales"]);
const MAX_BYTES = 4096;

export async function GET() {
  const correo = (await auth())?.user?.email;
  if (!correo) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const preferencias = await leerPreferencias(correo);
    if (preferencias === null) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ preferencias });
  } catch (error) {
    console.error("Error al leer preferencias:", error);
    return NextResponse.json({ error: "Error al leer la base de datos." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const correo = (await auth())?.user?.email;
  if (!correo) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const entrada = (body as { preferencias?: unknown })?.preferencias;
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    return NextResponse.json({ error: "Se esperaba un objeto de preferencias." }, { status: 400 });
  }
  // Solo claves conocidas y valores simples: nada de objetos anidados arbitrarios.
  const limpio = Object.fromEntries(
    Object.entries(entrada as Record<string, unknown>).filter(
      ([k, v]) => CLAVES.has(k) && (v === null || ["string", "boolean", "number"].includes(typeof v)),
    ),
  );
  if (JSON.stringify(limpio).length > MAX_BYTES) {
    return NextResponse.json({ error: "Preferencias demasiado grandes." }, { status: 413 });
  }
  try {
    const ok = await guardarPreferencias(correo, limpio);
    return ok ? NextResponse.json({ ok: true }) : new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error al guardar preferencias:", error);
    return NextResponse.json({ error: "Error al guardar en la base de datos." }, { status: 500 });
  }
}
