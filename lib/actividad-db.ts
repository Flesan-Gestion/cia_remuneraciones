import { poolPlataforma, tablaPlataforma } from "@/lib/configuracion-db";

/**
 * Registro de actividad (tabla registro_actividad del esquema propio, db/004_liquidaciones.sql):
 * quién hizo qué y cuándo. En esta plataforma, sobre todo, quién descargó o envió la liquidación
 * de quién. Solo runtime Node.
 */
const TABLA = tablaPlataforma("registro_actividad");

export interface EventoActividad {
  id: number;
  ocurrido_en: string;
  correo: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalle: Record<string, unknown>;
}

/** Devuelve false si no se pudo registrar (sin base o sin tabla). Quien llama decide si sigue. */
export async function registrarActividad(evento: {
  correo: string;
  accion: string;
  entidad: string;
  entidadId?: string | number | null;
  detalle?: Record<string, unknown>;
}): Promise<boolean> {
  if (!poolPlataforma || !TABLA) return false;
  try {
    await poolPlataforma.query(
      `INSERT INTO ${TABLA} (correo, accion, entidad, entidad_id, detalle) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        evento.correo.toLowerCase(),
        evento.accion,
        evento.entidad,
        evento.entidadId == null ? null : String(evento.entidadId),
        JSON.stringify(evento.detalle ?? {}),
      ],
    );
    return true;
  } catch (error) {
    console.error("Error al registrar actividad:", error);
    return false;
  }
}

/** Eventos de los últimos `dias` días, del más reciente al más antiguo. null = sin base o tabla. */
export async function listarActividad(dias: number, limite = 2000): Promise<EventoActividad[] | null> {
  if (!poolPlataforma || !TABLA) return null;
  try {
    const { rows } = await poolPlataforma.query<EventoActividad>(
      `SELECT id, ocurrido_en, correo, accion, entidad, entidad_id, detalle FROM ${TABLA}
       WHERE ocurrido_en >= now() - make_interval(days => $1)
       ORDER BY ocurrido_en DESC LIMIT $2`,
      [dias, limite],
    );
    return rows;
  } catch (error) {
    console.error("Error al leer el registro de actividad:", error);
    return null;
  }
}
