import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { marcarLeidas } from "@/lib/notificaciones-db";
import { marcarEjemplo } from "../ejemplo";

// Marca como leídas las notificaciones indicadas ({ ids: [..] }) o todas ({ todas: true }) del
// usuario en sesión. Solo toca las suyas: el destinatario sale de la sesión, no del cuerpo.

export async function POST(request: Request) {
  const correo = (await auth())?.user?.email;
  if (!correo) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let body: { ids?: unknown; todas?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is number => Number.isInteger(x)).slice(0, 500) : undefined;
  const seleccion = { ids, todas: body.todas === true };
  if (!seleccion.todas && !ids?.length) return NextResponse.json({ error: "Indica ids o todas." }, { status: 400 });

  try {
    if (!(await marcarLeidas(correo, seleccion))) marcarEjemplo(seleccion);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al marcar notificaciones:", error);
    return NextResponse.json({ error: "Error al guardar en la base de datos." }, { status: 500 });
  }
}
