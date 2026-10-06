import { NextResponse } from "next/server";

/** Healthcheck del contenedor Docker (ver docker-compose.yml). Sin auth: fuera del matcher de middleware.ts. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
