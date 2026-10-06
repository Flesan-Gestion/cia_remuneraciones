import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/roles";

/**
 * Gate por rol de las secciones de administración de Configuración (grupo de rutas «(admin)»: las
 * URL no cambian). Vive fuera del middleware porque necesita el rol ya resuelto en la sesión. Toda
 * sección nueva solo para administradores va dentro de esta carpeta; las APIs validan el rol por
 * su cuenta.
 */
export default async function AdministracionLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!esAdmin(session?.user?.role)) {
    redirect("/configuracion");
  }
  return <>{children}</>;
}
