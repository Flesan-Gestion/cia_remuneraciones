import { Pool } from "pg";

// SHELL · acceso a las tablas de Configuración (db/002_configuracion.sql) en el esquema propio
// de la plataforma en QA. Solo runtime Node (route handlers). Queda inerte si falta
// DATABASE_URL_PLATAFORMA o ESQUEMA_PLATAFORMA: las funciones devuelven `null` y el cliente
// sigue usando lo guardado en el navegador.

declare global {
  var _pgPoolConfiguracion: Pool | undefined;
}

const URL = process.env.DATABASE_URL_PLATAFORMA;
// ESQUEMA_PLATAFORMA; si no está, DB_QA_SCHEMA (nombre que ya usan algunas plataformas).
const ESQUEMA_ENV = process.env.ESQUEMA_PLATAFORMA ?? process.env.DB_QA_SCHEMA;
// El esquema se interpola en el SQL: solo se acepta un nombre cia_* simple.
const ESQUEMA = ESQUEMA_ENV && /^cia_[a-z0-9_]{1,60}$/.test(ESQUEMA_ENV) ? ESQUEMA_ENV : null;

export const configuracionDisponible = Boolean(URL && ESQUEMA);

const pool: Pool | null = configuracionDisponible
  ? (globalThis._pgPoolConfiguracion ?? new Pool({ connectionString: URL, max: 3 }))
  : null;
if (pool && process.env.NODE_ENV !== "production") globalThis._pgPoolConfiguracion = pool;

/** Pool de la base propia (QA, lectura y escritura). null si la plataforma no la tiene. */
export const poolPlataforma = pool;

/** Nombre calificado de una tabla del esquema propio (ej. cia_plataforma_x.usuarios), o null. */
export function tablaPlataforma(nombre: string): string | null {
  return ESQUEMA && /^[a-z_]+$/.test(nombre) ? `${ESQUEMA}.${nombre}` : null;
}

/** Código de Postgres para «la tabla no existe» (SQL aún no aplicado en esta plataforma). */
const TABLA_NO_EXISTE = "42P01";
function esTablaInexistente(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === TABLA_NO_EXISTE;
}

// ---------------------------------------------------------------- preferencias_usuario

/** null = sin base configurada o tabla aún no creada; {} = el usuario no guardó nada. */
export async function leerPreferencias(correo: string): Promise<Record<string, unknown> | null> {
  if (!pool) return null;
  try {
    const { rows } = await pool.query<{ preferencias: Record<string, unknown> }>(
      `SELECT preferencias FROM ${ESQUEMA}.preferencias_usuario WHERE correo = $1`,
      [correo.toLowerCase()],
    );
    return rows[0]?.preferencias ?? {};
  } catch (e) {
    if (esTablaInexistente(e)) return null;
    throw e;
  }
}

/** Devuelve false si la base no está disponible (el cliente conserva su copia local). */
export async function guardarPreferencias(correo: string, preferencias: Record<string, unknown>): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query(
      `INSERT INTO ${ESQUEMA}.preferencias_usuario (correo, preferencias, actualizado_en)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (correo) DO UPDATE SET preferencias = EXCLUDED.preferencias, actualizado_en = now()`,
      [correo.toLowerCase(), JSON.stringify(preferencias)],
    );
    return true;
  } catch (e) {
    if (esTablaInexistente(e)) return false;
    throw e;
  }
}

// ---------------------------------------------------------------- avisos

export type NivelAviso = "info" | "atencion" | "critico";
export interface Aviso {
  id: number;
  mensaje: string;
  nivel: NivelAviso;
  desde: string;
  hasta: string | null;
  creado_por: string;
  creado_en: string;
}

const COLUMNAS_AVISO = "id, mensaje, nivel, desde, hasta, creado_por, creado_en";

/** Avisos vigentes ahora (para la franja). null = sin base o tabla. */
export async function avisosVigentes(): Promise<Aviso[] | null> {
  if (!pool) return null;
  try {
    const { rows } = await pool.query<Aviso>(
      `SELECT ${COLUMNAS_AVISO} FROM ${ESQUEMA}.avisos
       WHERE desde <= now() AND (hasta IS NULL OR hasta > now())
       ORDER BY CASE nivel WHEN 'critico' THEN 0 WHEN 'atencion' THEN 1 ELSE 2 END, desde DESC
       LIMIT 5`,
    );
    return rows;
  } catch (e) {
    if (esTablaInexistente(e)) return null;
    throw e;
  }
}

/** Últimos avisos (vigentes, programados y terminados) para administrarlos. */
export async function listarAvisos(): Promise<Aviso[] | null> {
  if (!pool) return null;
  try {
    const { rows } = await pool.query<Aviso>(
      `SELECT ${COLUMNAS_AVISO} FROM ${ESQUEMA}.avisos ORDER BY creado_en DESC LIMIT 50`,
    );
    return rows;
  } catch (e) {
    if (esTablaInexistente(e)) return null;
    throw e;
  }
}

export async function crearAviso(a: { mensaje: string; nivel: NivelAviso; desde: string | null; hasta: string | null; creadoPor: string }) {
  if (!pool) return null;
  const { rows } = await pool.query<Aviso>(
    `INSERT INTO ${ESQUEMA}.avisos (mensaje, nivel, desde, hasta, creado_por)
     VALUES ($1, $2, COALESCE($3::timestamptz, now()), $4::timestamptz, $5)
     RETURNING ${COLUMNAS_AVISO}`,
    [a.mensaje, a.nivel, a.desde, a.hasta, a.creadoPor.toLowerCase()],
  );
  return rows[0];
}

/** «Terminar»: fija el término en este momento (no borra el aviso; queda el historial). Un aviso
 * programado (inicio futuro) también se puede terminar: se adelanta su inicio para que se cumpla
 * hasta > desde. */
export async function terminarAviso(id: number) {
  if (!pool) return false;
  const { rowCount } = await pool.query(
    `UPDATE ${ESQUEMA}.avisos
     SET desde = LEAST(desde, now() - interval '1 second'), hasta = now(), actualizado_en = now()
     WHERE id = $1 AND (hasta IS NULL OR hasta > now())`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}
