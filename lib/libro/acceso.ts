import { poolPlataforma, tablaPlataforma } from "@/lib/configuracion-db";
import { sesionConRol } from "@/lib/auth-guard";
import type { Rol } from "@/lib/roles";
import { ROLES_LIBRO, type AccesoLibro, type RolLibro } from "@/lib/libro/tipos";

/**
 * Rol en los libros de remuneraciones y finiquitos, leído de la tabla usuarios del esquema propio
 * (db/005_remuneraciones.sql). Reemplaza la tabla tabla_mantendor_rol_encargados_cc que leían los
 * aplicativos antiguos. Solo runtime Node.
 *
 * - Sin fila o sin rol: sin acceso (en el antiguo, «¡Sin Acceso! Contactar a RRHH»).
 * - Si la base o la columna no responden: sin acceso. Son datos de remuneraciones.
 */
const TABLA = tablaPlataforma("usuarios");

const ROLES = new Set<RolLibro>(ROLES_LIBRO.map((r) => r.valor));

/** Rol fijo para desarrollo con AUTH_DISABLED (ver .env.example). Nunca en producción. */
function rolDesarrollo(): RolLibro | null {
  if (process.env.AUTH_DISABLED !== "true" || process.env.NODE_ENV === "production") return null;
  const r = process.env.DEV_ROL_LIBRO as RolLibro | undefined;
  return r && ROLES.has(r) ? r : null;
}

export async function resolverAccesoLibro(correo: string): Promise<AccesoLibro> {
  const c = correo.trim().toLowerCase();
  const dev = rolDesarrollo();
  if (dev) return { correo: c, rol: dev };
  if (!poolPlataforma || !TABLA) return { correo: c, rol: null, sinBase: true };
  try {
    const { rows } = await poolPlataforma.query<{ rol_remuneraciones: string | null }>(
      `SELECT rol_remuneraciones FROM ${TABLA} WHERE correo = $1`,
      [c],
    );
    const fila = rows[0];
    const rol = fila && ROLES.has(fila.rol_remuneraciones as RolLibro) ? (fila.rol_remuneraciones as RolLibro) : null;
    return { correo: c, rol };
  } catch (error) {
    // Sin db/005_remuneraciones.sql aplicado la columna no existe: se avisa una vez, no en cada página.
    if ((error as { code?: string }).code === "42703") {
      if (!avisadoSinColumna) console.warn("Libros sin acceso: falta aplicar db/005_remuneraciones.sql (usuarios.rol_remuneraciones).");
      avisadoSinColumna = true;
    } else {
      console.error("Error al resolver el rol de los libros:", error);
    }
    return { correo: c, rol: null, sinBase: true };
  }
}

let avisadoSinColumna = false;

/** Sesión + rol de la plataforma + rol de los libros, para route handlers. null = sin sesión. */
export async function sesionConAccesoLibro(): Promise<{ email: string; role: Rol; acceso: AccesoLibro } | null> {
  const sesion = await sesionConRol();
  if (!sesion) return null;
  return { ...sesion, acceso: await resolverAccesoLibro(sesion.email) };
}
