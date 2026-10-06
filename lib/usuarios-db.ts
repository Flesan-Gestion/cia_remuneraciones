import { poolPlataforma, tablaPlataforma } from "@/lib/configuracion-db";
import type { Rol } from "@/lib/roles";
import type { Perfil } from "@/lib/liquidaciones/tipos";
import { ROLES_LIBRO, type RolLibro } from "@/lib/libro/tipos";

/**
 * Runtime Node únicamente — nunca importar desde un client component ni desde
 * auth.config.ts (edge, ver middleware.ts). Esquema en db/001_usuarios_roles.sql.
 *
 * Tabla `usuarios` del esquema propio (DATABASE_URL_PLATAFORMA + ESQUEMA_PLATAFORMA). Sin
 * base propia, todos entran como "member" salvo CIA_ADMIN_EMAILS — ver auth.ts.
 */
// Roles en el esquema propio de la plataforma (QA), nunca en la base transaccional.
const TABLA_USUARIOS = tablaPlataforma("usuarios");

function base() {
  if (!poolPlataforma || !TABLA_USUARIOS) throw new Error("La plataforma no tiene base propia configurada.");
  return { pool: poolPlataforma, tabla: TABLA_USUARIOS };
}

export interface UsuarioAsignado {
  correo: string;
  nombre: string | null;
  rol: Rol;
  /** Perfil de acceso a las liquidaciones (db/004_liquidaciones.sql). */
  perfil: Perfil;
  /** Empresas fijas del filtro «Razón social» (null = las de sus centros de costo). */
  empresas: string[] | null;
  /** Rol en los libros de remuneraciones y finiquitos (db/005_remuneraciones.sql); null = sin acceso. */
  rolRemuneraciones: RolLibro | null;
}

const PERFILES = new Set<Perfil>(["rrhh", "jefatura", "sin_acceso"]);
const ROLES_REMUNERACIONES = new Set<RolLibro>(ROLES_LIBRO.map((r) => r.valor));

/** Código de Postgres para «la columna no existe» (db/005 sin aplicar). */
function esColumnaInexistente(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "42703";
}

/**
 * Rol de un correo, para el callback `session` de auth.ts cuando la plataforma
 * necesita roles persistidos en BBDD (no solo por email vía env CIA_ADMIN_EMAILS).
 * Sin fila (nunca administrado desde /configuracion/usuarios, o error de conexión):
 * "member" por defecto — mínimo privilegio, nunca le corta el acceso a nadie que ya
 * usa la plataforma.
 */
export async function resolverRol(correo: string): Promise<{ rol: Rol; nombre: string | null }> {
  if (!poolPlataforma || !TABLA_USUARIOS) return { rol: "member", nombre: null };
  try {
    const { rows } = await poolPlataforma.query<{ rol: string; nombre: string | null }>(
      `SELECT rol, nombre FROM ${TABLA_USUARIOS} WHERE correo = $1`,
      [correo],
    );
    const fila = rows[0];
    return { rol: fila?.rol === "admin" ? "admin" : "member", nombre: fila?.nombre ?? null };
  } catch (error) {
    console.error("Error al resolver rol de usuario:", error);
    return { rol: "member", nombre: null };
  }
}

interface FilaUsuario {
  correo: string;
  nombre: string | null;
  rol: string;
  perfil: string;
  empresas: string[] | null;
  rol_remuneraciones?: string | null;
}

/** Usuarios con acceso administrado. `libros` = false si db/005 aún no está aplicado (sin columna). */
export async function listarUsuariosAsignados(): Promise<{ usuarios: UsuarioAsignado[]; libros: boolean }> {
  const { pool, tabla } = base();
  let filas: FilaUsuario[];
  let libros = true;
  try {
    filas = (
      await pool.query<FilaUsuario>(
        `SELECT correo, nombre, rol, perfil, empresas, rol_remuneraciones FROM ${tabla} ORDER BY nombre NULLS LAST, correo`,
      )
    ).rows;
  } catch (e) {
    if (!esColumnaInexistente(e)) throw e;
    libros = false;
    filas = (await pool.query<FilaUsuario>(`SELECT correo, nombre, rol, perfil, empresas FROM ${tabla} ORDER BY nombre NULLS LAST, correo`)).rows;
  }
  return {
    libros,
    usuarios: filas.map((r) => ({
      correo: r.correo,
      nombre: r.nombre,
      rol: r.rol === "admin" ? "admin" : "member",
      perfil: PERFILES.has(r.perfil as Perfil) ? (r.perfil as Perfil) : "sin_acceso",
      empresas: r.empresas?.length ? r.empresas : null,
      rolRemuneraciones: ROLES_REMUNERACIONES.has(r.rol_remuneraciones as RolLibro) ? (r.rol_remuneraciones as RolLibro) : null,
    })),
  };
}

export async function asignarUsuario(params: {
  correo: string;
  nombre: string | null;
  rol: Rol;
  perfil: Perfil;
  empresas: string[] | null;
  /** undefined = no tocar el rol de libros (p. ej. si db/005 no está aplicado). */
  rolRemuneraciones?: RolLibro | null;
}): Promise<void> {
  const correo = params.correo.trim().toLowerCase();
  const { pool, tabla } = base();
  const empresas = params.empresas?.length ? params.empresas : null;
  if (params.rolRemuneraciones === undefined) {
    await pool.query(
      `INSERT INTO ${tabla} (correo, nombre, rol, perfil, empresas, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (correo) DO UPDATE SET nombre = COALESCE(EXCLUDED.nombre, ${tabla}.nombre), rol = EXCLUDED.rol,
         perfil = EXCLUDED.perfil, empresas = EXCLUDED.empresas, updated_at = now()`,
      [correo, params.nombre, params.rol, params.perfil, empresas],
    );
    return;
  }
  await pool.query(
    `INSERT INTO ${tabla} (correo, nombre, rol, perfil, empresas, rol_remuneraciones, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (correo) DO UPDATE SET nombre = COALESCE(EXCLUDED.nombre, ${tabla}.nombre), rol = EXCLUDED.rol,
       perfil = EXCLUDED.perfil, empresas = EXCLUDED.empresas, rol_remuneraciones = EXCLUDED.rol_remuneraciones,
       updated_at = now()`,
    [correo, params.nombre, params.rol, params.perfil, empresas, params.rolRemuneraciones],
  );
}

/** Quita al usuario de la tabla administrada: vuelve al default (miembro, perfil jefatura,
 * sin acceso a los libros) en vez de quedar "sin rol". */
export async function revocarUsuario(correo: string): Promise<void> {
  const { pool, tabla } = base();
  await pool.query(`DELETE FROM ${tabla} WHERE correo = $1`, [correo.trim().toLowerCase()]);
}
