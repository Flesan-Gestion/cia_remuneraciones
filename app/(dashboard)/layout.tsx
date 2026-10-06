import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { BreadcrumbProvider } from "@/components/breadcrumb-context";
import { UserProvider } from "@/components/user-context";
import { SwrProvider } from "@/components/swr-provider";
import { resolverAcceso } from "@/lib/liquidaciones/acceso";
import { resolverAccesoLibro } from "@/lib/libro/acceso";
import { perfilMenu } from "@/lib/nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Perfil de liquidaciones (rrhh / jefatura / sin_acceso) y rol en los libros: el menú muestra lo que le toca.
  const correo = session?.user?.email;
  const [acceso, accesoLibro] = correo ? await Promise.all([resolverAcceso(correo), resolverAccesoLibro(correo)]) : [null, null];
  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
        perfil: acceso ? perfilMenu(acceso.perfil, Boolean(accesoLibro?.rol)) : null,
      }
    : null;

  return (
    <UserProvider user={user}>
      <SwrProvider>
        <BreadcrumbProvider>
          <AppShell>{children}</AppShell>
        </BreadcrumbProvider>
      </SwrProvider>
    </UserProvider>
  );
}
