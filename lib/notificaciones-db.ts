import { poolPlataforma, tablaPlataforma } from "@/lib/configuracion-db";
import type { Notificacion } from "@/lib/notificaciones-tipos";

// SHELL · acceso a la tabla de notificaciones (db/003_notificaciones.sql) en el esquema propio
// de la plataforma. Solo runtime Node (route handlers, server actions). Las lecturas devuelven
// null si no hay base o la tabla aún no existe: la API cae a los datos de ejemplo.

const TABLA_NO_EXISTE = "42P01";
const esTablaInexistente = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === TABLA_NO_EXISTE;

const COLUMNAS = `id::int AS id, tipo, titulo, cuerpo, enlace, datos,
  to_char(leida_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "leidaEn",
  to_char(creada_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "creadaEn"`;

/** Las últimas notificaciones de un usuario y cuántas tiene sin leer. */
export async function listarNotificaciones(correo: string, limite = 10): Promise<{ notificaciones: Notificacion[]; noLeidas: number } | null> {
  const tabla = tablaPlataforma("notificaciones");
  if (!poolPlataforma || !tabla) return null;
  try {
    const destinatario = correo.toLowerCase();
    const [lista, conteo] = await Promise.all([
      poolPlataforma.query<Notificacion>(
        `SELECT ${COLUMNAS} FROM ${tabla} WHERE destinatario_correo = $1 ORDER BY creada_en DESC LIMIT $2`,
        [destinatario, Math.min(Math.max(limite, 1), 200)],
      ),
      poolPlataforma.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${tabla} WHERE destinatario_correo = $1 AND leida_en IS NULL`, [destinatario]),
    ]);
    return { notificaciones: lista.rows, noLeidas: conteo.rows[0]?.n ?? 0 };
  } catch (e) {
    if (esTablaInexistente(e)) return null;
    throw e;
  }
}

/** Marca como leídas las indicadas (o todas) de un usuario. false si no hay base. */
export async function marcarLeidas(correo: string, seleccion: { ids?: number[]; todas?: boolean }): Promise<boolean> {
  const tabla = tablaPlataforma("notificaciones");
  if (!poolPlataforma || !tabla) return false;
  const destinatario = correo.toLowerCase();
  try {
    if (seleccion.todas) {
      await poolPlataforma.query(`UPDATE ${tabla} SET leida_en = now() WHERE destinatario_correo = $1 AND leida_en IS NULL`, [destinatario]);
    } else if (seleccion.ids?.length) {
      await poolPlataforma.query(`UPDATE ${tabla} SET leida_en = now() WHERE destinatario_correo = $1 AND id = ANY($2::bigint[]) AND leida_en IS NULL`, [
        destinatario,
        seleccion.ids,
      ]);
    }
    return true;
  } catch (e) {
    if (esTablaInexistente(e)) return false;
    throw e;
  }
}

/**
 * Emite una notificación para uno o varios destinatarios. Se llama desde el servidor cuando
 * pasa algo (una entrega, un rechazo, una carga). El tipo debe estar en
 * lib/notificaciones-plataforma.ts. false si no hay base.
 */
export async function crearNotificacion(n: {
  destinatarios: string[];
  tipo: string;
  titulo: string;
  cuerpo?: string;
  enlace?: string | null;
  datos?: Record<string, unknown>;
  actor?: string | null;
}): Promise<boolean> {
  const tabla = tablaPlataforma("notificaciones");
  if (!poolPlataforma || !tabla || !n.destinatarios.length) return false;
  await poolPlataforma.query(
    `INSERT INTO ${tabla} (destinatario_correo, tipo, titulo, cuerpo, enlace, datos, actor_correo)
     SELECT lower(d), $2, $3, $4, $5, $6::jsonb, $7 FROM unnest($1::text[]) AS d`,
    [n.destinatarios, n.tipo, n.titulo, n.cuerpo ?? "", n.enlace ?? null, JSON.stringify(n.datos ?? {}), n.actor ?? null],
  );
  return true;
}
