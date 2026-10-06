import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listarNotificaciones } from "@/lib/notificaciones-db";
import type { RespuestaNotificaciones } from "@/lib/notificaciones-tipos";
import { listarEjemplo } from "./ejemplo";

// Notificaciones del usuario en sesión: las últimas (?limite=, 10 por defecto) y cuántas tiene
// sin leer. La campanita la consulta cada minuto. Sin tabla, responde datos de ejemplo.

export async function GET(request: Request) {
  const correo = (await auth())?.user?.email;
  if (!correo) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const limite = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limite")) || 10, 1), 200);
  try {
    const reales = await listarNotificaciones(correo, limite);
    const cuerpo: RespuestaNotificaciones = reales ? { ...reales, ejemplo: false } : { ...listarEjemplo(limite), ejemplo: true };
    return NextResponse.json(cuerpo);
  } catch (error) {
    console.error("Error al leer notificaciones:", error);
    return NextResponse.json({ error: "Error al leer la base de datos." }, { status: 500 });
  }
}
