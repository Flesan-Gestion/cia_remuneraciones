import { poolPlataforma, tablaPlataforma } from "@/lib/configuracion-db";
import type { ConfiguracionEnvio, DetalleEnvio, EstadoLote, Lote } from "@/lib/liquidaciones/tipos";

/**
 * Tablas del envío por correo (esquema propio, db/004_liquidaciones.sql): configuración, lotes
 * por periodo y una fila por persona. Solo runtime Node.
 */
const LOTES = tablaPlataforma("envio_lotes");
const DETALLE = tablaPlataforma("envio_detalle");
const CONFIG = tablaPlataforma("envio_configuracion");
const USUARIOS = tablaPlataforma("usuarios");

function base() {
  if (!poolPlataforma || !LOTES || !DETALLE || !CONFIG) throw new Error("La plataforma no tiene base propia configurada.");
  return poolPlataforma;
}

// ---------------------------------------------------------------- configuración

export async function leerConfiguracion(): Promise<ConfiguracionEnvio> {
  const { rows } = await base().query<ConfiguracionEnvio>(
    `SELECT dia_mes, activo, actualizado_por, actualizado_en FROM ${CONFIG} WHERE id = 1`,
  );
  return rows[0] ?? { dia_mes: 5, activo: true, actualizado_por: null, actualizado_en: null };
}

export async function guardarConfiguracion(diaMes: number, activo: boolean, correo: string) {
  await base().query(
    `INSERT INTO ${CONFIG} (id, dia_mes, activo, actualizado_por, actualizado_en) VALUES (1, $1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET dia_mes = EXCLUDED.dia_mes, activo = EXCLUDED.activo,
       actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now()`,
    [diaMes, activo, correo],
  );
}

// ---------------------------------------------------------------- lotes

const COLUMNAS_LOTE = `l.id::int AS id, l.periodo, l.estado, l.creado_por, l.creado_en, l.aprobado_por, l.aprobado_en, l.terminado_en,
  count(d.id)::int AS total,
  count(d.id) FILTER (WHERE d.origen_correo = 'corporativo')::int AS corporativo,
  count(d.id) FILTER (WHERE d.origen_correo = 'personal')::int AS personal,
  count(d.id) FILTER (WHERE d.estado = 'sin_correo')::int AS sin_correo,
  count(d.id) FILTER (WHERE d.estado = 'enviado')::int AS enviados,
  count(d.id) FILTER (WHERE d.estado = 'error')::int AS errores,
  count(d.id) FILTER (WHERE d.estado = 'excluido')::int AS excluidos,
  count(d.id) FILTER (WHERE d.estado IN ('pendiente', 'enviando'))::int AS pendientes`;

export async function listarLotes(): Promise<Lote[]> {
  const { rows } = await base().query<Lote>(
    `SELECT ${COLUMNAS_LOTE} FROM ${LOTES} l LEFT JOIN ${DETALLE} d ON d.lote_id = l.id
     GROUP BY l.id ORDER BY l.periodo DESC, l.id DESC LIMIT 36`,
  );
  return rows;
}

export async function leerLote(id: number): Promise<Lote | null> {
  const { rows } = await base().query<Lote>(
    `SELECT ${COLUMNAS_LOTE} FROM ${LOTES} l LEFT JOIN ${DETALLE} d ON d.lote_id = l.id WHERE l.id = $1 GROUP BY l.id`,
    [id],
  );
  return rows[0] ?? null;
}

/** Si ya hay un lote para el periodo. Con `incluirCancelados`, cuenta también los cancelados
 * (el programador no vuelve a preparar un lote que RR.HH. canceló). */
export async function existeLote(periodo: string, incluirCancelados: boolean) {
  const { rows } = await base().query(
    `SELECT 1 FROM ${LOTES} WHERE periodo = $1 ${incluirCancelados ? "" : "AND estado <> 'cancelado'"} LIMIT 1`,
    [periodo],
  );
  return rows.length > 0;
}

export interface NuevaFilaEnvio {
  numero_de_personal: string;
  nombre: string;
  sociedad: string | null;
  correo: string | null;
  origen_correo: "corporativo" | "personal" | null;
  liquidaciones: { periodo_para_nomina: string; periodo_efectivo: string }[];
}

/** Crea el lote con sus filas en una transacción. Las personas sin correo quedan «sin_correo». */
export async function crearLote(periodo: string, creadoPor: string, filas: NuevaFilaEnvio[]): Promise<number> {
  const cliente = await base().connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO ${LOTES} (periodo, creado_por) VALUES ($1, $2) RETURNING id`,
      [periodo, creadoPor],
    );
    const id = Number(rows[0].id);
    for (let i = 0; i < filas.length; i += 500) {
      const parte = filas.slice(i, i + 500);
      await cliente.query(
        `INSERT INTO ${DETALLE} (lote_id, numero_de_personal, nombre, sociedad, correo, origen_correo, liquidaciones, estado)
         SELECT $1, f.np, f.nombre, f.soc, f.correo, f.origen, f.liq::jsonb, CASE WHEN f.correo IS NULL THEN 'sin_correo' ELSE 'pendiente' END
         FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]) AS f(np, nombre, soc, correo, origen, liq)`,
        [
          id,
          parte.map((f) => f.numero_de_personal),
          parte.map((f) => f.nombre),
          parte.map((f) => f.sociedad),
          parte.map((f) => f.correo),
          parte.map((f) => f.origen_correo),
          parte.map((f) => JSON.stringify(f.liquidaciones)),
        ],
      );
    }
    await cliente.query("COMMIT");
    return id;
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

/** Cambia el estado del lote solo si está en uno de `desde`. Devuelve si cambió. */
export async function cambiarEstadoLote(id: number, desde: EstadoLote[], a: EstadoLote, correo: string) {
  const extra =
    a === "enviando" && desde.includes("por_aprobar")
      ? ", aprobado_por = COALESCE(aprobado_por, $4), aprobado_en = COALESCE(aprobado_en, now())"
      : a === "cancelado"
        ? ", cancelado_por = $4, cancelado_en = now()"
        : "";
  const { rowCount } = await base().query(
    `UPDATE ${LOTES} SET estado = $3${extra} WHERE id = $1 AND estado = ANY($2::text[])`,
    extra ? [id, desde, a, correo] : [id, desde, a],
  );
  return (rowCount ?? 0) > 0;
}

export async function listarDetalle(loteId: number): Promise<DetalleEnvio[]> {
  const { rows } = await base().query<DetalleEnvio>(
    `SELECT id::int AS id, numero_de_personal, nombre, sociedad, correo, origen_correo, liquidaciones, estado, intentos,
       ultimo_error, enviado_en
     FROM ${DETALLE} WHERE lote_id = $1 ORDER BY nombre`,
    [loteId],
  );
  return rows;
}

export async function leerFila(loteId: number, id: number): Promise<DetalleEnvio | null> {
  const { rows } = await base().query<DetalleEnvio>(
    `SELECT id::int AS id, numero_de_personal, nombre, sociedad, correo, origen_correo, liquidaciones, estado, intentos,
       ultimo_error, enviado_en
     FROM ${DETALLE} WHERE lote_id = $1 AND id = $2`,
    [loteId, id],
  );
  return rows[0] ?? null;
}

/** Excluir o volver a incluir a una persona; solo antes de aprobar el lote. */
export async function cambiarExclusion(loteId: number, id: number, excluir: boolean) {
  const { rowCount } = await base().query(
    `UPDATE ${DETALLE} d SET estado = $3, actualizado_en = now()
     FROM ${LOTES} l
     WHERE d.lote_id = l.id AND l.id = $1 AND d.id = $2 AND l.estado = 'por_aprobar'
       AND d.estado = $4`,
    [loteId, id, excluir ? "excluido" : "pendiente", excluir ? "pendiente" : "excluido"],
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- envío

/** Toma hasta `n` filas pendientes de un lote en envío y las marca «enviando» (nadie más las toma). */
export async function reclamarPendientes(loteId: number, n: number): Promise<DetalleEnvio[]> {
  const { rows } = await base().query<DetalleEnvio>(
    `UPDATE ${DETALLE} SET estado = 'enviando', actualizado_en = now()
     WHERE id IN (
       SELECT id FROM ${DETALLE} WHERE lote_id = $1 AND estado = 'pendiente'
       ORDER BY nombre LIMIT $2 FOR UPDATE SKIP LOCKED
     )
     RETURNING id::int AS id, numero_de_personal, nombre, sociedad, correo, origen_correo, liquidaciones, estado, intentos,
       ultimo_error, enviado_en`,
    [loteId, n],
  );
  return rows;
}

export async function devolverPendientes(ids: number[]) {
  if (!ids.length) return;
  await base().query(`UPDATE ${DETALLE} SET estado = 'pendiente', actualizado_en = now() WHERE id = ANY($1::bigint[]) AND estado = 'enviando'`, [ids]);
}

export async function marcarEnviado(id: number) {
  await base().query(
    `UPDATE ${DETALLE} SET estado = 'enviado', intentos = intentos + 1, ultimo_error = NULL, enviado_en = now(), actualizado_en = now()
     WHERE id = $1`,
    [id],
  );
}

export async function marcarError(id: number, error: string) {
  await base().query(
    `UPDATE ${DETALLE} SET estado = 'error', intentos = intentos + 1, ultimo_error = $2, actualizado_en = now() WHERE id = $1`,
    [id, error.slice(0, 1000)],
  );
}

/** Correos de liquidaciones enviados hoy (hora de Chile), para respetar el tope diario de Gmail. */
export async function enviadosHoy(): Promise<number> {
  const { rows } = await base().query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${DETALLE}
     WHERE enviado_en >= (date_trunc('day', now() AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago')`,
  );
  return rows[0]?.n ?? 0;
}

/** Lotes aprobados que todavía tienen filas por enviar. */
export async function lotesPorEnviar(): Promise<number[]> {
  const { rows } = await base().query<{ id: number }>(
    `SELECT l.id::int AS id FROM ${LOTES} l
     WHERE l.estado = 'enviando' AND EXISTS (SELECT 1 FROM ${DETALLE} d WHERE d.lote_id = l.id AND d.estado = 'pendiente')
     ORDER BY l.aprobado_en`,
  );
  return rows.map((r) => r.id);
}

/** Cierra el lote si ya no le queda nada pendiente ni en curso. */
export async function cerrarSiTermino(loteId: number) {
  await base().query(
    `UPDATE ${LOTES} SET estado = 'enviado', terminado_en = now()
     WHERE id = $1 AND estado = 'enviando'
       AND NOT EXISTS (SELECT 1 FROM ${DETALLE} WHERE lote_id = $1 AND estado IN ('pendiente', 'enviando'))`,
    [loteId],
  );
}

/** Vuelve a la cola las filas con error y reabre el lote. Devuelve cuántas. */
export async function reintentarErrores(loteId: number): Promise<number> {
  const cliente = await base().connect();
  try {
    await cliente.query("BEGIN");
    const { rowCount } = await cliente.query(
      `UPDATE ${DETALLE} SET estado = 'pendiente', actualizado_en = now() WHERE lote_id = $1 AND estado = 'error'`,
      [loteId],
    );
    if (rowCount) {
      await cliente.query(`UPDATE ${LOTES} SET estado = 'enviando', terminado_en = NULL WHERE id = $1 AND estado IN ('enviado', 'enviando', 'pausado')`, [loteId]);
    }
    await cliente.query("COMMIT");
    return rowCount ?? 0;
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

/** Al arrancar: lo que quedó «enviando» de un proceso que se cortó pasa a error. No se reenvía
 * solo, porque el correo pudo haber salido antes del corte. */
export async function recuperarInterrumpidos() {
  await base().query(
    `UPDATE ${DETALLE} SET estado = 'error', actualizado_en = now(),
       ultimo_error = 'El envío se interrumpió (reinicio del servidor). Revisa si le llegó antes de reenviar.'
     WHERE estado = 'enviando' AND actualizado_en < now() - interval '10 minutes'`,
  );
}

/** Correos de quienes tienen perfil RR.HH. (aviso de lote listo para revisar). */
export async function correosRrhh(): Promise<string[]> {
  if (!USUARIOS) return [];
  const { rows } = await base().query<{ correo: string }>(`SELECT correo FROM ${USUARIOS} WHERE perfil = 'rrhh' ORDER BY correo`);
  return rows.map((r) => r.correo);
}
