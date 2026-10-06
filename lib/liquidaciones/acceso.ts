import { poolPlataforma, tablaPlataforma } from "@/lib/configuracion-db";
import { sesionConRol } from "@/lib/auth-guard";
import type { Rol } from "@/lib/roles";
import type { Acceso, Perfil } from "@/lib/liquidaciones/tipos";

/**
 * Perfil de acceso a las liquidaciones, leído de la tabla usuarios del esquema propio
 * (db/004_liquidaciones.sql). Reemplaza las listas de correos del aplicativo antiguo. Solo
 * runtime Node.
 *
 * - Sin fila: jefatura (ve lo que la copia de tabla_encargados_cc le asigna, db/006).
 * - Si la base o la tabla no responden: sin acceso. Son datos de remuneraciones; ante la duda,
 *   no se muestra nada.
 */
const TABLA = tablaPlataforma("usuarios");

const PERFILES = new Set<Perfil>(["rrhh", "jefatura", "sin_acceso"]);

/** Perfil fijo para desarrollo con AUTH_DISABLED (ver .env.example). Nunca en producción. */
function perfilDesarrollo(): Perfil | null {
  if (process.env.AUTH_DISABLED !== "true" || process.env.NODE_ENV === "production") return null;
  const p = process.env.DEV_PERFIL as Perfil | undefined;
  return p && PERFILES.has(p) ? p : null;
}

export async function resolverAcceso(correo: string): Promise<Acceso> {
  const c = correo.trim().toLowerCase();
  const dev = perfilDesarrollo();
  if (dev) return { correo: c, perfil: dev, empresas: null };
  if (!poolPlataforma || !TABLA) return { correo: c, perfil: "sin_acceso", empresas: null, sinBase: true };
  try {
    const { rows } = await poolPlataforma.query<{ perfil: string; empresas: string[] | null }>(
      `SELECT perfil, empresas FROM ${TABLA} WHERE correo = $1`,
      [c],
    );
    const fila = rows[0];
    if (!fila) return { correo: c, perfil: "jefatura", empresas: null };
    const perfil = PERFILES.has(fila.perfil as Perfil) ? (fila.perfil as Perfil) : "sin_acceso";
    return { correo: c, perfil, empresas: fila.empresas?.length ? fila.empresas : null };
  } catch (error) {
    console.error("Error al resolver el perfil de acceso:", error);
    return { correo: c, perfil: "sin_acceso", empresas: null, sinBase: true };
  }
}

/** Sesión + rol + perfil, para route handlers. null = sin sesión. */
export async function sesionConAcceso(): Promise<{ email: string; role: Rol; acceso: Acceso } | null> {
  const sesion = await sesionConRol();
  if (!sesion) return null;
  return { ...sesion, acceso: await resolverAcceso(sesion.email) };
}
