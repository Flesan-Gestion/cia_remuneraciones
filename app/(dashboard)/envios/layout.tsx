import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolverAcceso } from "@/lib/liquidaciones/acceso";

/** Envío por correo: solo perfil RR.HH. (las APIs validan lo mismo por su cuenta). */
export default async function EnviosLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const correo = session?.user?.email;
  if (!correo || (await resolverAcceso(correo)).perfil !== "rrhh") redirect("/");
  return <>{children}</>;
}
