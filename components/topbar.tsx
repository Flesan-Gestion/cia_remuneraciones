"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { BotonTema, ThemeToggle } from "@/components/theme-toggle";
import { BotonPantallaCompleta } from "@/components/pantalla-completa";
import { EstadoDatos } from "@/components/estado-datos";
import { BotonComentariosBarra } from "@/components/comentarios/widget";
import { BotonesBarraModulos } from "@/components/modulos";
import { Campanita } from "@/components/notificaciones/campanita";
import { UserMenu } from "@/components/user-menu";
import { useUsuarioActual } from "@/components/user-context";
import { cn } from "@/lib/cn";
import { esAdmin } from "@/lib/roles";
import { useBreadcrumbContext } from "@/components/breadcrumb-context";
import { NAV_ITEMS, isNavActive, menuPara, migasDe } from "@/lib/nav";

const claseMiga = "font-label text-xs tracking-[0.08em] uppercase truncate";

// Barra superior: la ruta de migas (Inicio › Sección › Subpanel › drilldown…) y, a la derecha,
// «Agregar a presentación» (se apaga desde el menú de usuario) y la pantalla completa.
// Menú, configuración, tema y usuario viven en el sidebar. En móvil, donde el sidebar
// se oculta, la barra vuelve a mostrar el menú, el tema y el usuario.
export function TopBar() {
  const pathname = usePathname();
  const { state: drilldown } = useBreadcrumbContext();
  const user = useUsuarioActual();
  const items = menuPara(NAV_ITEMS, { admin: esAdmin(user?.role), perfil: user?.perfil });

  const migas = migasDe(pathname);
  const niveles = drilldown?.items ?? [];

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 lg:px-6 border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      {/* Nav móvil */}
      <nav className="flex md:hidden items-center gap-1 overflow-x-auto">
        {items.map(({ href, label, icon: IconCmp }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 font-label text-[10px] tracking-[0.06em] uppercase whitespace-nowrap border",
                active ? "border-flesan-red text-text" : "border-transparent text-muted",
              )}
            >
              <IconCmp className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Ruta" className="hidden md:flex items-center gap-1.5 min-w-0">
        {migas.map((miga, i) => {
          const esUltima = i === migas.length - 1 && niveles.length === 0;
          return (
            <Fragment key={miga.href}>
              {i > 0 && <Separador />}
              {esUltima ? (
                <span aria-current="page" className={cn(claseMiga, "text-text max-w-[280px]")}>
                  {miga.label}
                </span>
              ) : (
                <Link href={miga.href} className={cn(claseMiga, "text-faint hover:text-flesan-red max-w-[200px]")}>
                  {miga.label}
                </Link>
              )}
            </Fragment>
          );
        })}
        {niveles.map((label, i) => {
          const esUltima = i === niveles.length - 1;
          return (
            <Fragment key={i}>
              <Separador />
              {esUltima ? (
                <span aria-current="page" className={cn(claseMiga, "text-text max-w-[280px]")}>
                  {label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => drilldown?.onNavigate(i)}
                  className={cn(claseMiga, "text-faint hover:text-flesan-red max-w-[200px] cursor-pointer")}
                >
                  {label}
                </button>
              )}
            </Fragment>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-2">
        <EstadoDatos />
        <BotonesBarraModulos />
        <BotonComentariosBarra />
        <Campanita />
        <BotonPantallaCompleta />
        <BotonTema />
      </div>

      <div className="flex md:hidden items-center gap-3">
        <Campanita />
        <ThemeToggle />
        <UserMenu name={user?.name} email={user?.email} image={user?.image} role={user?.role} />
      </div>
    </header>
  );
}

function Separador() {
  return <ChevronRight className="w-[0.6875rem] h-[0.6875rem] text-faint shrink-0" />;
}
