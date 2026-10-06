import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const CENTRAL = process.env.CIA_FEEDBACK_URL ?? "http://192.168.10.22:8083";
const TOKEN = process.env.CIA_SERVICE_TOKEN ?? "";

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ detail: "no_autenticado" }, { status: 401 });
  }
  const body = await req.json();
  const r = await fetch(`${CENTRAL}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CIA-Service-Token": TOKEN },
    body: JSON.stringify({
      mensaje: String(body.mensaje ?? "").slice(0, 2000),
      tipo: body.tipo ?? "sugerencia",
      url_origen: body.url_origen,
      usuario_email: email,
      usuario_nombre: session.user?.name ?? undefined,
      user_agent: req.headers.get("user-agent") ?? undefined,
    }),
  });
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
