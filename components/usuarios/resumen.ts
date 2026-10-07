import type { UsuarioAsignado } from "@/lib/usuarios-db";
import type { RolLibro } from "@/lib/libro/tipos";

// Qué ve cada persona, dicho en palabras a partir de sus permisos. Solo describe: las reglas están
// en lib/liquidaciones/consultas.ts y lib/libro/consultas.ts.

/** En cuántos centros es encargado o visitador (los que ve en Liquidaciones y en los libros 3 y 4) y GGO. */
export interface ConteoCentros {
  centros: number;
  ggo: number;
}

export type Tono = "todo" | "parcial" | "nada";

export interface Linea {
  texto: string;
  tono: Tono;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Elección de Liquidaciones que muestra la ficha (perfil + empresas completas). */
export type AccesoLiquidaciones = "todas" | "centros" | "empresas" | "ninguna";

export function accesoLiquidaciones(u: Pick<UsuarioAsignado, "perfil" | "empresas">): AccesoLiquidaciones {
  if (u.perfil === "rrhh") return "todas";
  if (u.perfil === "sin_acceso") return "ninguna";
  return u.empresas?.length ? "empresas" : "centros";
}

export function lineaLiquidaciones(u: Pick<UsuarioAsignado, "perfil" | "empresas">, c: ConteoCentros | null, nombreEmpresa: (codigo: string) => string): Linea {
  switch (accesoLiquidaciones(u)) {
    case "todas":
      return { texto: "Todas", tono: "todo" };
    case "ninguna":
      return { texto: "Sin acceso", tono: "nada" };
    case "empresas":
      return { texto: `Todas de ${(u.empresas ?? []).map(nombreEmpresa).join(", ")}`, tono: "parcial" };
    case "centros":
      if (!c) return { texto: "Sus centros", tono: "parcial" };
      return c.centros ? { texto: plural(c.centros, "centro", "centros"), tono: "parcial" } : { texto: "Ninguna (sin centros)", tono: "nada" };
  }
}

export function lineaLibros(rol: RolLibro | null, c: ConteoCentros | null): Linea {
  switch (rol) {
    case null:
      return { texto: "Sin acceso", tono: "nada" };
    case "administrador":
      return { texto: "Todo", tono: "todo" };
    case "rrhh":
      return { texto: "Todo, por razón social", tono: "todo" };
    case "ggo":
      if (!c) return { texto: "Costo empresa de sus centros GGO", tono: "parcial" };
      return c.ggo ? { texto: `Costo empresa de ${plural(c.ggo, "centro", "centros")}`, tono: "parcial" } : { texto: "Ninguno (no es GGO de ningún centro)", tono: "nada" };
    default:
      if (!c) return { texto: "Sus centros", tono: "parcial" };
      return c.centros ? { texto: plural(c.centros, "centro", "centros"), tono: "parcial" } : { texto: "Ninguno (sin centros)", tono: "nada" };
  }
}

export const OPCIONES_LIQUIDACIONES: { valor: AccesoLiquidaciones; titulo: string; detalle: string }[] = [
  { valor: "todas", titulo: "Todas", detalle: "Todas las empresas. Además aprueba los envíos por correo (RR.HH. total)." },
  { valor: "centros", titulo: "Las de sus centros", detalle: "Los centros donde es encargado o visitador." },
  { valor: "empresas", titulo: "Empresas completas", detalle: "Todas las de las empresas que elijas, en vez de las de sus centros." },
  { valor: "ninguna", titulo: "Ninguna", detalle: "No entra a Liquidaciones." },
];

export const OPCIONES_LIBROS: { valor: RolLibro | ""; titulo: string; detalle: string }[] = [
  { valor: "administrador", titulo: "Todo", detalle: "Todas las empresas; la razón social es opcional. Rol «Administrador»." },
  { valor: "rrhh", titulo: "Todo, por razón social", detalle: "Todas las empresas, eligiendo siempre una razón social (en finiquitos es opcional). Rol «RRHH»." },
  // «Administrador OBRA» se unió a este rol el 2026-10-06 (veían lo mismo); el valor sigue siendo válido.
  {
    valor: "administrativo_rrhh",
    titulo: "Sus centros",
    detalle:
      "Los centros donde es encargado o visitador; sin el libro prorrateado, como en el aplicativo antiguo. Roles «Administrativo RRHH» y «Administrador OBRA» del aplicativo antiguo.",
  },
  {
    valor: "ggo",
    titulo: "Costo empresa",
    detalle:
      "Solo el costo empresa de los centros donde es GGO; en el libro prorrateado, todos los conceptos de esos centros. Sin finiquitos, como en el aplicativo antiguo. Rol «GGO».",
  },
  { valor: "", titulo: "Ninguno", detalle: "No entra a los libros ni a finiquitos." },
];
