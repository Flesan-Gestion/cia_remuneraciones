import { agrupar, codigoCc, consultar, esGgo, type FilaCentro } from "@/lib/libro/consultas";
import type { AccesoLibro, EmpresaLibro, FiltrosLibro } from "@/lib/libro/tipos";
import { listarPeriodos } from "@/lib/liquidaciones/consultas";
import { CONCEPTOS, type ConceptoProrrateado } from "@/lib/libro-prorrateado/conceptos";
import { veProrrateado } from "@/lib/libro-prorrateado/tipos";

/**
 * Consultas del libro de remuneraciones prorrateado a la base transaccional (DATABASE_URL, solo
 * lectura), portadas desde el aplicativo antiguo libro_rem_dis (class_libro_rem_dist.php). El libro
 * sale de flesan_rrhh.libro_rem_nuevo_g2, una tabla que arma un proceso externo con el libro de
 * remuneraciones de cada mes de pago (una fila por persona), y cada fila se reparte entre los centros
 * de costo de su distribución en SAP (flesan_rrhh.distribucion_sap) o, sin distribución, va entera
 * a su CC del mes (flesan_rrhh.np_cc_nuevo). Las reglas y las expresiones son las del original;
 * cambia que todo va con parámetros y que viaja solo lo que el Excel usa. Solo runtime Node.
 */

const HORA = 3_600_000;

// ---------------------------------------------------------------- periodos

/**
 * getfecha del original: los periodos de nómina, sin 000000, hasta el mes anterior
 * ((periodo || '01')::integer <= hoy en AAAAMMDD - 100). La base corre con hora de Chile
 * (TimeZone America/Santiago), así que la fecha de hoy se toma igual aquí.
 */
export async function listarPeriodosProrrateado(ahora = new Date()): Promise<string[]> {
  const hoy = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora).replaceAll("-", ""));
  return (await listarPeriodos()).filter((p) => Number(`${p}01`) <= hoy - 100);
}

// ---------------------------------------------------------------- empresas y CC del filtro

declare global {
  var _empresasProrrateado: { valor: EmpresaLibro[]; en: number } | undefined;
}

/**
 * getCentrosGestion1 del original (Administrador y RRHH): la empresa y el CC actuales (maestro de
 * colaboradores) de toda persona con alguna liquidación, con el nombre de empresa del maestro de CC
 * (Chile). Recorre la tabla de liquidaciones completa: se guarda una hora en memoria. El original
 * ordenaba solo por el nombre del CC; los empates van por código para que el orden sea siempre el mismo.
 */
async function empresasConLiquidaciones(): Promise<EmpresaLibro[]> {
  const cache = globalThis._empresasProrrateado;
  if (cache && Date.now() - cache.en < HORA) return cache.valor;
  const filas = await consultar<FilaCentro>(
    `WITH base AS (
       SELECT numero_de_personal::integer AS numero_de_personal
       FROM flesan_rrhh.sap_liquidaciones_grupo_flesan_g2
       GROUP BY numero_de_personal
     )
     SELECT col.empresa AS external_code_empresa, emp.nombre_empresa, col.centro_costo AS external_code_cc, col.nombre_centro_costo AS nombre_cc
     FROM base
     LEFT JOIN flesan_rrhh.sap_maestro_colaborador col ON col.user_id = base.numero_de_personal
     LEFT JOIN flesan_rrhh.sap_maestro_empresa_dep_un_cc emp ON emp.external_code_cc = col.centro_costo
     WHERE emp.external_code_pais = '10000004' AND emp.nombre_empresa IS NOT NULL
     GROUP BY col.empresa, col.centro_costo, col.nombre_centro_costo, emp.nombre_empresa
     ORDER BY col.nombre_centro_costo, col.empresa, col.centro_costo, emp.nombre_empresa`,
    [],
    "memoria",
  );
  const valor = agrupar(filas);
  globalThis._empresasProrrateado = { valor, en: Date.now() };
  return valor;
}

/**
 * Empresas y CC que muestra el filtro, según el rol (libro_rem_dist.php):
 * - Administrador y RRHH: todas (getCentrosGestion1).
 * - Quien figura como GGO de algún CC: esos CC (getCentrosGestion2, cruzando por el nombre del CC).
 * - El resto (un GGO que no figura en ningún CC): los CC donde es encargado o visitador (getCentrosGestion).
 * Solo CC de Chile y sin los FL%. Correos sin distinguir mayúsculas, como en el libro de remuneraciones.
 */
export async function listarEmpresasProrrateado(acceso: AccesoLibro): Promise<EmpresaLibro[]> {
  if (!veProrrateado(acceso)) return [];
  if (acceso.rol === "administrador" || acceso.rol === "rrhh") return empresasConLiquidaciones();
  if (await esGgo(acceso.correo)) {
    return agrupar(
      await consultar<FilaCentro>(
        `SELECT e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc
         FROM flesan_rrhh.sap_maestro_empresa_dep_un_cc e
         INNER JOIN flesan_rrhh.tabla_encargados_cc t ON t.centro_coto = (e.external_code_cc || '-' || e.nombre_cc)
         WHERE e.external_code_pais = '10000004' AND e.external_code_cc NOT LIKE 'FL%' AND strpos(lower(t.correo_ggo), $1) > 0
         GROUP BY e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc, t.correo_ggo
         ORDER BY e.nombre_empresa, e.nombre_cc, e.external_code_empresa, e.external_code_cc`,
        [acceso.correo],
      ),
    );
  }
  return agrupar(
    await consultar<FilaCentro>(
      `SELECT e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc
       FROM flesan_rrhh.sap_maestro_empresa_dep_un_cc e
       LEFT JOIN flesan_rrhh.tabla_encargados_cc t
         ON t.llave = (e.external_code_empresa || '-' || e.nombre_empresa || e.external_code_cc || '-' || e.nombre_cc)
       WHERE e.external_code_pais = '10000004' AND e.external_code_cc NOT LIKE 'FL%' AND (lower(trim(t.correo)) = $1 OR lower(trim(t.visitador)) = $1)
       GROUP BY e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc, t.correo, t.administrador
       ORDER BY e.nombre_empresa, e.nombre_cc, e.external_code_empresa, e.external_code_cc`,
      [acceso.correo],
    ),
  );
}

// ---------------------------------------------------------------- consulta del libro

/** Porcentaje de la distribución; sin distribución, 100. */
const PCT = "(CASE WHEN d.porcentaje IS NULL THEN 100 ELSE d.porcentaje END)";
/** CC al que va la fila: el de la distribución o, sin ella, el CC del mes de la persona. */
const CC_PRORRATEO = "(CASE WHEN LENGTH(d.centro_costo) > 0 THEN d.centro_costo ELSE n.centro_costo END)";

/** Cada concepto prorrateado y redondeado hacia arriba, con la misma expresión del original (el
 * orden de las operaciones importa: el resultado tiene que ser el mismo número). */
function prorrateo(c: ConceptoProrrateado) {
  const valor = c.horas ? `(CASE WHEN l.${c.clave} = '' THEN 0 ELSE replace(l.${c.clave}, ',', '.')::DOUBLE PRECISION END)` : `l.${c.clave}::DOUBLE PRECISION`;
  return `CEIL(sum(${valor} * ${PCT} / 100))`;
}

export type FilaProrrateado = Record<string, string | null>;

/**
 * El libro prorrateado: una fila por persona, mes y CC de su distribución, con el porcentaje, los
 * días trabajados prorrateados y cada concepto prorrateado (CEIL) en su columna. Mismas reglas que el
 * original según el rol:
 * - Administrador: todas las empresas (getLibroREMvalidacion).
 * - RRHH: todas menos NFG (getLibroREM sin encargado).
 * - GGO: los CC de la distribución donde figura como GGO (getLibroREMGGO). El original cruzaba con
 *   la tabla de encargados y contaba dos veces a las personas de los CC que están dos veces en ella;
 *   aquí cada persona cuenta una vez (decisión del 2026-10-06).
 * - Administrativo RRHH, Administrador OBRA y la excepción del original: sin acceso (ver veProrrateado).
 * La empresa filtra la sociedad de la persona y el CC, el de la distribución.
 *
 * Los conceptos viajan juntos en un texto «índice:valor;…» con solo los distintos de cero (casi
 * ocho de cada diez son cero): la base resuelve un mes en menos de un segundo y lo que más demora es
 * traer las filas. Los valores son el mismo texto que entregaba la consulta original.
 */
export async function consultarProrrateado(f: FiltrosLibro, acceso: AccesoLibro): Promise<FilaProrrateado[]> {
  if (!veProrrateado(acceso)) return [];
  const params: unknown[] = [f.desde, f.hasta];
  let where = "";
  if (f.empresa) {
    params.push(f.empresa);
    where += ` AND l.sociedad = $${params.length}`;
  }
  if (f.cc) {
    params.push(codigoCc(f.cc));
    where += ` AND e.external_code_cc = $${params.length}`;
  }
  if (acceso.rol === "rrhh") where += ` AND NOT (l.sociedad = 'NFG')`;
  if (acceso.rol === "ggo") {
    params.push(acceso.correo);
    where += ` AND EXISTS (
      SELECT 1 FROM flesan_rrhh.tabla_encargados_cc t
      WHERE t.centro_coto = (e.external_code_cc || '-' || e.nombre_cc) AND strpos(lower(t.correo_ggo), $${params.length}) > 0
    )`;
  }

  // La agrupación y el orden son los del original: agrupaba por estas columnas (ordenándolas en
  // este orden) y ordenaba por NP y mes.
  const sql = `SELECT x.sociedad, x.cc, x.nombre_completo, x.rut, x.np, x.cargo, x.tipo_contrato, x.fecha_ingreso, x.fecha_estimada_termino,
  x.fecha_retiro, x.dias, x.porcentaje,
  array_to_string(ARRAY[
    ${CONCEPTOS.map((_, i) => `CASE WHEN x.c${i} <> 0 THEN '${i}:' || x.c${i} END`).join(",\n    ")}
  ], ';') AS conceptos,
  x.nombre_clasificacion_gasto, x.ames, x.planta
FROM (
  SELECT l.sociedad,
    (${CC_PRORRATEO} || '-' || e.nombre_cc) AS cc,
    l.nombre_completo, l.rut, l.np::DOUBLE PRECISION AS np, l.cargo, l.tipo_contrato,
    l.fecha_ingreso, l.fecha_estimada_termino, l.fecha_retiro,
    ${PCT} || '%' AS porcentaje,
    sum(l.dias::DOUBLE PRECISION * ${PCT} / 100) AS dias,
    ${CONCEPTOS.map((c, i) => `${prorrateo(c)} AS c${i}`).join(",\n    ")},
    l.ames, l.administrativo, l.planta, d.porcentaje AS porcentaje_sap, cg.nombre_clasificacion_gasto
  FROM flesan_rrhh.libro_rem_nuevo_g2 l
  LEFT JOIN flesan_rrhh.np_cc_nuevo n ON n.user_id = l.np AND n.ames = l.ames
  LEFT JOIN flesan_rrhh.distribucion_sap d ON d.np::varchar = l.np AND d.anomes = l.ames
  LEFT JOIN flesan_rrhh.sap_maestro_colaborador m ON m.user_id::varchar = l.np::varchar
  LEFT JOIN flesan_rrhh.sap_maestro_empresa_dep_un_cc e ON e.external_code_cc = ${CC_PRORRATEO}
  LEFT JOIN flesan_rrhh.sap_maestro_clasificacion_gasto cg ON cg.id_clasificacion_gasto::varchar = m.id_clasificacion_gasto::varchar
  WHERE e.external_code_pais = '10000004' AND replace(l.ames, '-', '') >= $1 AND replace(l.ames, '-', '') <= $2${where}
  GROUP BY l.sociedad, (${CC_PRORRATEO} || '-' || e.nombre_cc), l.nombre_completo, l.rut, l.np::DOUBLE PRECISION, l.cargo, l.tipo_contrato,
    l.fecha_ingreso, l.fecha_estimada_termino, l.fecha_retiro, l.ames, l.administrativo, l.planta, d.porcentaje, cg.nombre_clasificacion_gasto
) x
ORDER BY x.np, x.ames, x.sociedad, x.cc, x.nombre_completo, x.rut, x.cargo, x.tipo_contrato, x.fecha_ingreso, x.fecha_estimada_termino,
  x.fecha_retiro, x.administrativo, x.planta, x.porcentaje_sap, x.nombre_clasificacion_gasto`;

  const filas = await consultar<FilaProrrateado>(sql, params, "memoria");
  // Los conceptos vuelven a su columna; los que no vienen eran cero (o nulos: el Excel los deja en 0).
  for (const fila of filas) {
    const empaquetados = fila.conceptos;
    delete fila.conceptos;
    if (!empaquetados) continue;
    for (const par of empaquetados.split(";")) {
      const i = par.indexOf(":");
      fila[CONCEPTOS[Number(par.slice(0, i))].clave] = par.slice(i + 1);
    }
  }
  return filas;
}
