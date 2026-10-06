import { auth } from "@/auth";
import { NextResponse } from "next/server";

const CENTRAL = process.env.CIA_FEEDBACK_URL ?? "http://192.168.10.22:8083";
const TOKEN = process.env.CIA_SERVICE_TOKEN ?? "";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json([], { status: 200 });

  const url = new URL(`${CENTRAL}/feedback/mios`);
  url.searchParams.set("usuario_email", email);
  const r = await fetch(url, { headers: { "X-CIA-Service-Token": TOKEN } });
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
