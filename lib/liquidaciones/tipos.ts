// Tipos compartidos entre servidor y cliente (sin dependencias de Node).

/**
 * Perfil de acceso a las liquidaciones (tabla usuarios del esquema propio):
 * - rrhh: todas las empresas, incluida NFG; filtra planta / no planta; aprueba los envíos.
 * - jefatura: los centros de costo donde es encargado o visitador (copia de tabla_encargados_cc,
 *   db/006) o, si tiene empresas asignadas, todas las liquidaciones de esas empresas (nunca NFG).
 *   Es el perfil de quien no está en la tabla.
 * - sin_acceso: no ve liquidaciones.
 */
export type Perfil = "rrhh" | "jefatura" | "sin_acceso";

export const PERFILES: { valor: Perfil; texto: string; detalle: string }[] = [
  { valor: "rrhh", texto: "RR.HH. total", detalle: "Todas las empresas y el envío por correo" },
  { valor: "jefatura", texto: "Jefatura", detalle: "Solo sus centros de costo (encargado o visitador)" },
  { valor: "sin_acceso", texto: "Sin acceso", detalle: "No ve liquidaciones" },
];

export function etiquetaPerfil(perfil: Perfil) {
  return PERFILES.find((p) => p.valor === perfil)?.texto ?? perfil;
}

export interface Acceso {
  correo: string;
  perfil: Perfil;
  /** Jefatura con empresas asignadas: ve todas las liquidaciones de esas empresas (no sus CC). */
  empresas: string[] | null;
  /** No se pudo leer el perfil (base o tabla no disponibles). */
  sinBase?: boolean;
}

export interface CentroCosto {
  codigo: string;
  nombre: string;
}

export interface Empresa {
  codigo: string;
  nombre: string;
  centros: CentroCosto[];
}

export interface Filtros {
  empresa: string | null;
  cc: string | null;
  /** Periodo AAAAMM. */
  desde: string;
  hasta: string;
  /** Número de personal, RUT o nombre. */
  persona: string | null;
  /** Solo perfil RR.HH. */
  planta: "PL" | "NP" | null;
}

/** Una liquidación encontrada, para la vista previa. */
export interface FilaVista {
  /** numero_de_personal|periodo_para_nomina|periodo_efectivo */
  clave: string;
  nombre: string;
  numero_de_personal: string;
  rut: string | null;
  sociedad: string;
  centro_costo: string | null;
  nombre_cc: string | null;
  periodo_para_nomina: string;
  periodo_efectivo: string;
  /** Normal o fuera de ciclo (periodo 000000, tipo de cálculo B). */
  fuera_de_ciclo: boolean;
  liquido: number | null;
}

export type EstadoLote = "por_aprobar" | "enviando" | "pausado" | "enviado" | "cancelado";
export type EstadoEnvio = "pendiente" | "enviando" | "enviado" | "error" | "sin_correo" | "excluido";

export interface Lote {
  id: number;
  periodo: string;
  estado: EstadoLote;
  creado_por: string;
  creado_en: string;
  aprobado_por: string | null;
  aprobado_en: string | null;
  terminado_en: string | null;
  total: number;
  corporativo: number;
  personal: number;
  sin_correo: number;
  enviados: number;
  errores: number;
  excluidos: number;
  pendientes: number;
}

export interface DetalleEnvio {
  id: number;
  numero_de_personal: string;
  nombre: string;
  sociedad: string | null;
  correo: string | null;
  origen_correo: "corporativo" | "personal" | null;
  liquidaciones: { periodo_para_nomina: string; periodo_efectivo: string }[];
  estado: EstadoEnvio;
  intentos: number;
  ultimo_error: string | null;
  enviado_en: string | null;
}

export interface ConfiguracionEnvio {
  dia_mes: number;
  activo: boolean;
  actualizado_por: string | null;
  actualizado_en: string | null;
}
