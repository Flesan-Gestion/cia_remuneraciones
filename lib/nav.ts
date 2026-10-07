import { BookOpenText, FileSignature, FileText, LayoutGrid, Settings, SplitSquareHorizontal } from "lucide-react";
import { crearMigas, type NavItem } from "@/lib/nav-base";

export * from "@/lib/nav-base";

// PLATAFORMA · menú propio de cada plataforma (este archivo sí se edita en cada una).
// Fuente única de navegación: Sidebar, TopBar (ruta de migas) y las tabs de sección
// consumen estos arreglos para no mantener listas sincronizadas a mano. Los tipos y las
// funciones comunes vienen de `lib/nav-base.ts` (shell).

/** Nombre en el encabezado del sidebar: texto normal + palabra destacada en rojo («Remuneraciones G2»).
 * `texto` puede quedar vacío si el nombre es una sola palabra (va toda en rojo). */
export const NOMBRE_PLATAFORMA = { texto: "Remuneraciones", destacado: "G2" };
export const NOMBRE_COMPLETO = `${NOMBRE_PLATAFORMA.texto} ${NOMBRE_PLATAFORMA.destacado}`.trim();

/**
 * El menú filtra con un solo texto de perfil (UsuarioActual.perfil). Aquí se juntan los accesos de
 * la plataforma: el perfil de liquidaciones (rrhh / jefatura / sin_acceso), el sufijo «+libros» si
 * tiene rol en los libros y finiquitos y, además, «+prorrateado» y «+finiquitos» si ese rol obtiene
 * el libro prorrateado o los finiquitos (lib/libro-prorrateado/tipos.ts, lib/finiquitos/tipos.ts).
 * Ej.: «jefatura+libros+prorrateado+finiquitos».
 */
export function perfilMenu(perfilLiquidaciones: string, conLibros: boolean, conProrrateado = false, conFiniquitos = false) {
  return `${perfilLiquidaciones}${conLibros ? "+libros" : ""}${conLibros && conProrrateado ? "+prorrateado" : ""}${conLibros && conFiniquitos ? "+finiquitos" : ""}`;
}

const PERFILES = ["rrhh", "jefatura", "sin_acceso"];
const CON_PRORRATEADO = ["+libros+prorrateado", "+libros+prorrateado+finiquitos"];
const CON_FINIQUITOS = ["+libros+finiquitos", "+libros+prorrateado+finiquitos"];
const CON_LIBROS = ["+libros", ...CON_PRORRATEADO, "+libros+finiquitos"];
const conSufijos = (perfiles: string[], sufijos: string[]) => perfiles.flatMap((p) => sufijos.map((s) => `${p}${s}`));

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutGrid },
  // Perfiles (lib/liquidaciones/tipos.ts): quien no tiene acceso no ve Liquidaciones; el envío
  // por correo es solo de RR.HH. Los libros, para quien tiene rol en los libros
  // (lib/libro/tipos.ts). Cada ruta valida lo mismo en el servidor.
  {
    href: "/liquidaciones",
    label: "Liquidaciones",
    icon: FileText,
    perfiles: conSufijos(["rrhh", "jefatura"], ["", ...CON_LIBROS]),
    children: [
      { href: "/liquidaciones", label: "Buscar liquidaciones" },
      { href: "/envios", label: "Envío por correo", perfiles: conSufijos(["rrhh"], ["", ...CON_LIBROS]) },
    ],
  },
  { href: "/libro-remuneraciones", label: "Libro de remuneraciones", icon: BookOpenText, perfiles: conSufijos(PERFILES, CON_LIBROS) },
  { href: "/libro-prorrateado", label: "Libro prorrateado", icon: SplitSquareHorizontal, perfiles: conSufijos(PERFILES, CON_PRORRATEADO) },
  { href: "/finiquitos", label: "Libro de finiquitos", icon: FileSignature, perfiles: conSufijos(PERFILES, CON_FINIQUITOS) },
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
