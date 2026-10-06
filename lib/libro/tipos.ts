// Tipos compartidos entre servidor y cliente (sin dependencias de Node).

/**
 * Rol en el Libro de Remuneraciones: los cinco de flesan_rrhh.tabla_rol_encargados_cc, que
 * comparten los aplicativos antiguos libro_rem_g2, libro_rem_dis y finiquito_rem.
 * - administrador (1): todas las empresas, incluida NFG.
 * - rrhh (2): todas las empresas menos NFG.
 * - administrativo_rrhh (3) y administrador_obra (4): los CC donde es encargado o visitador.
 * - ggo (5): los CC donde figura como GGO; solo costo empresa.
 */
export type RolLibro = "administrador" | "rrhh" | "administrativo_rrhh" | "administrador_obra" | "ggo";

export const ROLES_LIBRO: { valor: RolLibro; id: number; texto: string; detalle: string }[] = [
  { valor: "administrador", id: 1, texto: "Administrador", detalle: "Todas las empresas; la razón social es opcional" },
  { valor: "rrhh", id: 2, texto: "RRHH", detalle: "Todas las empresas, eligiendo una razón social" },
  { valor: "administrativo_rrhh", id: 3, texto: "Administrativo RRHH", detalle: "Los CC donde es encargado" },
  { valor: "administrador_obra", id: 4, texto: "Administrador OBRA", detalle: "Los CC donde es visitador" },
  { valor: "ggo", id: 5, texto: "GGO", detalle: "Los CC donde figura como GGO, solo costo empresa" },
];

export function etiquetaRolLibro(rol: RolLibro | null) {
  return ROLES_LIBRO.find((r) => r.valor === rol)?.texto ?? "Sin acceso";
}

export interface AccesoLibro {
  /** En minúsculas. */
  correo: string;
  /** null = sin acceso al libro. */
  rol: RolLibro | null;
  /** No se pudo leer el rol (base o tabla no disponibles, o db/005 sin aplicar). */
  sinBase?: boolean;
}

export interface CentroCostoLibro {
  codigo: string;
  nombre: string;
}

export interface EmpresaLibro {
  codigo: string;
  nombre: string;
  centros: CentroCostoLibro[];
  /** ver_planta de la empresa para el encargado ('x' = solo no planta si no es el visitador). No va al navegador. */
  verPlanta?: string;
}

export interface FiltrosLibro {
  empresa: string | null;
  cc: string | null;
  /** Periodo AAAAMM (mes de pago). */
  desde: string;
  hasta: string;
}

/** La empresa es obligatoria para RRHH, Administrativo RRHH y Administrador OBRA (como en el original). */
export function exigeEmpresa(rol: RolLibro | null) {
  return rol === "rrhh" || rol === "administrativo_rrhh" || rol === "administrador_obra";
}
