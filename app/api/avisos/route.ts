import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { avisosVigentes } from "@/lib/configuracion-db";

// Franja de avisos: los vigentes ahora, para cualquier usuario con sesión.
export async function GET() {
  if (!(await auth())?.user?.email) return NextResponse.json({ avisos: [] });
  try {
    return NextResponse.json({ avisos: (await avisosVigentes()) ?? [] });
  } catch (error) {
    console.error("Error al leer avisos:", error);
    return NextResponse.json({ avisos: [] });
  }
}
