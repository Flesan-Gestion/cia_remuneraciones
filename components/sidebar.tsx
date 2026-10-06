"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  NAV_CONFIG,
  NAV_ITEMS,
  NOMBRE_PLATAFORMA,
  gruposDe,
  menuPara,
  visibleEnMenu,
  hijoActivo,
  isNavActive,
  type NavItem,
} from "@/lib/nav";
import { esAdmin } from "@/lib/roles";
import { useUsuarioActual } from "@/components/user-context";
import { CiaLogo } from "@/components/cia-logo";
import { UserCard } from "@/components/user-menu";
import { AccesoPortales } from "@/components/portales/acceso";
import { BotonTutorial } from "@/components/tutorial/tutorial";

const COLLAPSE_KEY = "sidebar-collapsed";

// Margen para cruzar del ítem al menú flotante sin que se cierre.
const CIERRE_MS = 150;

const claseItem = (active: boolean, collapsed: boolean) =>
  cn(
    "flex items-center gap-3 w-full px-3 py-2.5 font-label text-xs tracking-[0.08em] uppercase transition-colors border-l-2 whitespace-nowrap cursor-pointer",
    collapsed && "justify-center px-0",
    active ? "border-flesan-red bg-bg text-text" : "border-transparent text-muted hover:text-text hover:bg-bg",
  );

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const user = useUsuarioActual();
  const admin = esAdmin(user?.role);
  const items = menuPara(NAV_ITEMS, { admin, perfil: user?.perfil });

  // Persistido en localStorage para que sobreviva un refresh, no solo la
  // navegacion dentro de la SPA.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);

  // Al navegar, el menú flotante se cierra.
  useEffect(() => setAbierto(null), [pathname]);

  // Clic fuera o Esc cierran el menú flotante.
  useEffect(() => {
    if (!abierto) return;
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setAbierto(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(null);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function abrir(href: string) {
    if (cierre.current) clearTimeout(cierre.current);
    setAbierto(href);
  }

  function cerrarLuego() {
    if (cierre.current) clearTimeout(cierre.current);
    cierre.current = setTimeout(() => setAbierto(null), CIERRE_MS);
  }

  const configActiva = isNavActive(pathname, NAV_CONFIG.href);
  // Configuración se muestra a todos salvo que la plataforma la marque solo para administradores.
  const verConfig = visibleEnMenu(NAV_CONFIG, { admin, perfil: user?.perfil });
  const ConfigIcon = NAV_CONFIG.icon;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 relative z-40 border-r border-border bg-surface transition-[width] duration-150",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Encabezado: logo + nombre (su borde calza con el de la barra superior) */}
      <div
        data-sidebar-encabezado
        className={cn(
          "flex items-center h-14 border-b border-border",
          collapsed ? "justify-center px-2" : "gap-3 px-5",
        )}
      >
        <CiaLogo className="w-6 h-6 shrink-0 text-flesan-red dark:text-white" />
        {!collapsed && (
          // El nombre sale de lib/nav.ts (NOMBRE_PLATAFORMA): texto normal + palabra en rojo.
          // Nombres largos bajan un punto para caber en el ancho del sidebar sin cortarse.
          <span
            className={cn(
              "font-display font-bold italic uppercase tracking-[0.04em] text-text leading-none whitespace-nowrap flex-1 min-w-0 truncate",
              `${NOMBRE_PLATAFORMA.texto} ${NOMBRE_PLATAFORMA.destacado}`.trim().length > 18 ? "text-[0.9375rem]" : "text-[1.1875rem]",
            )}
          >
            {NOMBRE_PLATAFORMA.texto && `${NOMBRE_PLATAFORMA.texto} `}
            <span className="text-flesan-red">{NOMBRE_PLATAFORMA.destacado}</span>
          </span>
        )}
      </div>

      {/* Navegación: enlace directo, o menú flotante si el ítem tiene subpaneles */}
      <nav ref={navRef} aria-label="Principal" className="flex-1 px-3 py-4 flex flex-col gap-1">
        {items.map((item) =>
          item.children?.length ? (
            <ItemConSubpaneles
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              abierto={abierto === item.href}
              onAbrir={() => abrir(item.href)}
              onCerrarLuego={cerrarLuego}
            />
          ) : (
            <ItemDirecto key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ),
        )}
      </nav>

      {/* Portales del grupo (CIA / SAP), en el estilo que el usuario eligió en «Personalizar» */}
      <AccesoPortales />

      {/* Pie: tutorial (si la pantalla tiene), configuración, colapsar y usuario (el tema vive en la barra superior) */}
      <div data-sidebar-pie className={cn("border-t border-border flex flex-col gap-2 py-3", collapsed ? "px-2 items-center" : "px-3")}>
        <BotonTutorial colapsado={collapsed} />
        {/* Configuración y, a su lado, el botón para colapsar el menú */}
        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "w-full")}>
          {verConfig && (
            <Link
              data-tutorial="configuracion"
              href={NAV_CONFIG.href}
              title={collapsed ? NAV_CONFIG.label : undefined}
              aria-current={configActiva ? "page" : undefined}
              className={cn(claseItem(configActiva, collapsed), !collapsed && "flex-1 min-w-0")}
            >
              <ConfigIcon className={cn("w-4 h-4 shrink-0", configActiva && "text-flesan-red")} />
              {!collapsed && NAV_CONFIG.label}
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className={cn(
              "flex items-center justify-center w-8 h-8 shrink-0 rounded-md border border-border text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer",
              !collapsed && !verConfig && "ml-auto",
            )}
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>
        <div className="w-full" data-tutorial="usuario">
          <UserCard name={user?.name} email={user?.email} image={user?.image} role={user?.role} colapsado={collapsed} />
        </div>
      </div>
    </aside>
  );
}

function ItemDirecto({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const active = isNavActive(pathname, item.href);
  const IconCmp = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={claseItem(active, collapsed)}
    >
      <IconCmp className={cn("w-4 h-4 shrink-0", active && "text-flesan-red")} />
      {!collapsed && item.label}
    </Link>
  );
}

interface ItemConSubpanelesProps {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  abierto: boolean;
  onAbrir: () => void;
  onCerrarLuego: () => void;
}

// Ítem con subpaneles: el clic lleva a la primera subopción. El menú flotante (al costado
// del sidebar, agrupado por `grupo`) se abre al pasar el mouse o con foco de teclado y se
// cierra al salir, con Esc o con un clic fuera.
function ItemConSubpaneles({ item, pathname, collapsed, abierto, onAbrir, onCerrarLuego }: ItemConSubpanelesProps) {
  const active = isNavActive(pathname, item.href);
  const actual = hijoActivo(item, pathname);
  const IconCmp = item.icon;
  const idMenu = `subpaneles-${item.href.replace(/\W+/g, "-")}`;
  const primera = item.children?.[0]?.href ?? item.href;

  return (
    <div className="relative" onMouseEnter={onAbrir} onMouseLeave={onCerrarLuego}>
      {/* Clic: va a la primera subopción. Mouse encima o foco de teclado: abre el menú flotante
          (con Tab se entra a sus opciones, que vienen justo después en el orden de foco). */}
      <Link
        href={primera}
        onFocus={onAbrir}
        title={collapsed ? item.label : undefined}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={idMenu}
        className={cn(claseItem(active, collapsed), abierto && !active && "bg-bg text-text")}
      >
        <IconCmp className={cn("w-4 h-4 shrink-0", active && "text-flesan-red")} />
        {!collapsed && (
          <>
            {item.label}
            <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0 text-faint" />
          </>
        )}
      </Link>

      {abierto && (
        // pl-3 transparente: puente para que el mouse cruce sin cerrar el menú.
        <div id={idMenu} className="absolute left-full top-0 pl-3 z-50">
          <div className="w-56 rounded-flesan border border-border bg-surface shadow-lg p-1.5 animate-fade-in">
            {collapsed && (
              <p className="font-label text-xs font-semibold tracking-[0.08em] uppercase text-text px-3 pt-2 pb-1">
                {item.label}
              </p>
            )}
            {gruposDe(item.children ?? []).map(({ grupo, items }, i) => (
              <div key={grupo ?? i} className={cn(i > 0 && "mt-1 pt-1 border-t border-border")}>
                {grupo && (
                  <p className="font-label text-[0.625rem] font-semibold tracking-[0.14em] uppercase text-faint px-3 pt-2 pb-1">
                    {grupo}
                  </p>
                )}
                {items.map((hijo) => {
                  const esActual = actual?.href === hijo.href;
                  return (
                    <Link
                      key={hijo.href}
                      href={hijo.href}
                      aria-current={esActual ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-flesan-sm text-sm transition-colors",
                        esActual ? "bg-bg text-text font-semibold" : "text-muted hover:text-text hover:bg-bg",
                      )}
                    >
                      {esActual && <span className="w-1.5 h-1.5 bg-flesan-red shrink-0" />}
                      {hijo.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
