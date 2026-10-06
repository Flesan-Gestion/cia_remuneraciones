import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Rol } from "@/lib/roles";

/** Solo para route handlers (runtime Node) — nunca importar desde un client component. */
export async function sesionConRol(): Promise<{ email: string; role: Rol } | null> {
  const session = await auth();
  const email = session?.user?.email;
  const role = session?.user?.role;
  if (!email || !role) return null;
  return { email: email.toLowerCase(), role };
}

export function respuestaNoAutorizado(mensaje = "No autorizado.") {
  return NextResponse.json({ error: mensaje }, { status: 403 });
}
