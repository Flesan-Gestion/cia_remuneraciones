import { BookOpenText, FileText, LayoutGrid, Send, Settings } from "lucide-react";
import { crearMigas, type NavItem } from "@/lib/nav-base";

export * from "@/lib/nav-base";

// PLATAFORMA · menú propio de cada plataforma (este archivo sí se edita en cada una).
// Fuente única de navegación: Sidebar, TopBar (ruta de migas) y las tabs de sección
// consumen estos arreglos para no mantener listas sincronizadas a mano. Los tipos y las
// funciones comunes vienen de `lib/nav-base.ts` (shell).

/** Nombre en el encabezado del sidebar: texto normal + palabra destacada en rojo. `texto` puede
 * quedar vacío si el nombre es una sola palabra (va toda en rojo). */
export const NOMBRE_PLATAFORMA = { texto: "Remuneraciones", destacado: "SAP" };

/**
 * El menú filtra con un solo texto de perfil (UsuarioActual.perfil). Aquí se juntan los dos
 * accesos de la plataforma: el perfil de liquidaciones (rrhh / jefatura / sin_acceso) y, si tiene
 * rol en los libros y finiquitos, el sufijo «+libros». Ej.: «jefatura+libros».
 */
export function perfilMenu(perfilLiquidaciones: string, conLibros: boolean) {
  return conLibros ? `${perfilLiquidaciones}+libros` : perfilLiquidaciones;
}

const conYSinLibros = (perfiles: string[]) => perfiles.flatMap((p) => [p, `${p}+libros`]);
const CON_LIBROS = ["rrhh", "jefatura", "sin_acceso"].map((p) => `${p}+libros`);

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutGrid },
  // Perfiles (lib/liquidaciones/tipos.ts): quien no tiene acceso no ve Liquidaciones; el envío
  // por correo es solo de RR.HH. El libro, para quien tiene rol en los libros
  // (lib/libro/tipos.ts). Cada ruta valida lo mismo en el servidor.
  { href: "/liquidaciones", label: "Liquidaciones", icon: FileText, perfiles: conYSinLibros(["rrhh", "jefatura"]) },
  { href: "/envios", label: "Envío por correo", icon: Send, perfiles: conYSinLibros(["rrhh"]) },
  { href: "/libro-remuneraciones", label: "Libro de remuneraciones", icon: BookOpenText, perfiles: CON_LIBROS },
];

/** Configuración no va en el menú principal: vive en el pie del sidebar. Está abierta a todos y
 * cada sección se muestra según el rol: «Usuarios y roles» siempre es solo de administradores
 * (gate en app/(dashboard)/configuracion/usuarios/layout.tsx). En una plataforma donde toda la
 * configuración es de administración, se marca `adminOnly: true` el ítem completo. */
export const NAV_CONFIG: NavItem = {
  href: "/configuracion",
  label: "Configuración",
  icon: Settings,
  children: [
    { href: "/configuracion/personalizacion", label: "Mi personalización" },
    { href: "/configuracion/comentarios", label: "Mis comentarios" },
    { href: "/configuracion/acerca", label: "Acerca de" },
    { href: "/configuracion/usuarios", label: "Usuarios y roles", adminOnly: true },
    { href: "/configuracion/avisos", label: "Avisos", adminOnly: true },
    { href: "/configuracion/actividad", label: "Registro de actividad", adminOnly: true },
  ],
};

/** Ruta de migas según la URL: Inicio › Sección › Subpanel. */
export function migasDe(pathname: string) {
  return crearMigas(pathname, NAV_ITEMS, NAV_CONFIG);
}
