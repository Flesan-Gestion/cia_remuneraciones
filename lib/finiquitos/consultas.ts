import { codigoCc, consultar, esGgo, listarEmpresasLibro, type FilaCentro } from "@/lib/libro/consultas";
import type { AccesoLibro, EmpresaLibro } from "@/lib/libro/tipos";
import { CONCEPTOS, type ConceptoFiniquito } from "@/lib/finiquitos/conceptos";
import { veFiniquitos, type FiltrosFiniquitos } from "@/lib/finiquitos/tipos";

/**
 * Consultas de Finiquitos a la base transaccional (DATABASE_URL, solo lectura), portadas desde el
 * aplicativo antiguo finiquito_rem (class_finiquito_rem.php). Los finiquitos salen de
 * flesan_rrhh.sap_finiquito_grupo_flesan_g2: una fila por concepto, persona y semana de pago, como la
 * tabla de liquidaciones. Las reglas y las expresiones son las del original; cambia que todo va con
 * parámetros, que viaja solo lo que el Excel usa y que las tres hojas se piden a la vez. Solo runtime Node.
 */

const FIN = "flesan_rrhh.sap_finiquito_grupo_flesan_g2";

/** Mes de pago «AAAA-MM», igual que el original (fecha_de_pago es texto tipo «Mon Sep 28 00:00:00 CLST 2026»). */
const MES_PAGO = "SUBSTRING(CAST(f.fecha_de_pago AS date)::varchar, 1, 7)";

/** CC de nómina que suman al imponible (jb_imponible del original; no es la lista del libro de remuneraciones). */
const CODIGOS_IMPONIBLE = [
  "M020", "MI11", "1060", "1003", "1008", "1009", "1014", "1016", "1035", "1036", "1042", "MI52", "1015", "1031", "1050",
  "1051", "/IF6", "1010", "1011", "1013", "1012", "1019", "1043", "1024", "1025",
];

// ---------------------------------------------------------------- semanas y empresas del filtro

/** getfecha del original: cada periodo (marca) y semana con finiquitos, del más reciente al más antiguo. */
export async function listarSemanas(): Promise<string[]> {
  const filas = await consultar<{ periodo: string | null; semana: string | null }>(
    `SELECT DISTINCT replace(marca, '-', '') AS periodo, semana FROM ${FIN} ORDER BY replace(marca, '-', '') DESC, semana DESC`,
    [],
  );
  return filas.map((f) => `${f.periodo ?? ""}${f.semana ?? ""}`);
}

/** Agrupa como getCentrosGestion1 del PHP: una entrada por código y nombre de empresa (la clave «CFM_FLESAN
 * MINERIA S.A.»), con sus CC en el orden de la consulta. Al generar, el original mandaba solo el código. */
function agruparPorNombre(filas: FilaCentro[]): EmpresaLibro[] {
  const porClave = new Map<string, EmpresaLibro>();
  for (const f of filas) {
    const codigo = (f.external_code_empresa ?? "").trim();
    const nombre = (f.nombre_empresa ?? "").trim();
    const clave = `${codigo}_${nombre}`;
    let empresa = porClave.get(clave);
    if (!empresa) {
      empresa = { codigo, clave, nombre, centros: [] };
      porClave.set(clave, empresa);
    }
    const cc = { codigo: (f.external_code_cc ?? "").trim(), nombre: (f.nombre_cc ?? "").trim() };
    if (!empresa.centros.some((c) => c.codigo === cc.codigo && c.nombre === cc.nombre)) empresa.centros.push(cc);
  }
  return [...porClave.values()];
}

/**
 * getCentrosGestion1 (Administrador y RRHH): la empresa y el CC actuales (maestro de colaboradores) de
 * toda persona con algún finiquito, con el nombre de empresa del finiquito. El original ordenaba por
 * nombre de empresa y de CC; los empates van por código para que el orden sea siempre el mismo.
 */
async function empresasConFiniquitos(): Promise<EmpresaLibro[]> {
  return agruparPorNombre(
    await consultar<FilaCentro>(
      `SELECT m.empresa AS external_code_empresa, f.nombre_de_la_empresa AS nombre_empresa, m.centro_costo AS external_code_cc, m.nombre_centro_costo AS nombre_cc
       FROM ${FIN} f
       LEFT JOIN flesan_rrhh.sap_maestro_colaborador m ON m.user_id = f.numero_de_personal::integer
       WHERE m.empresa IS NOT NULL
       GROUP BY m.empresa, f.nombre_de_la_empresa, m.centro_costo, m.nombre_centro_costo
       ORDER BY f.nombre_de_la_empresa, m.nombre_centro_costo, m.empresa, m.centro_costo`,
      [],
    ),
  );
}

/** Si el correo es encargado de algún CC (acceso() del original: la columna correo). */
async function esEncargado(correo: string): Promise<boolean> {
  const filas = await consultar(`SELECT 1 FROM flesan_rrhh.tabla_encargados_cc WHERE lower(trim(correo)) = $1 LIMIT 1`, [correo]);
  return filas.length > 0;
}

/**
 * Empresas y CC que muestra el filtro, según el rol (finiquito_rem.php):
 * - Administrador y RRHH: todas las de los finiquitos (getCentrosGestion1).
 * - El resto: las mismas listas del libro de remuneraciones, que el original copiaba tal cual: los CC
 *   donde figura como GGO (getCentrosGestion2) o, si no, donde es encargado o visitador (getCentrosGestion).
 * `formulario`: si el antiguo mostraba los filtros. Sin empresas en la lista, solo a quien es encargado
 * de algún CC o figura como GGO; a ellos les deja generar con todas sus personas.
 */
export async function listarEmpresasFiniquitos(acceso: AccesoLibro): Promise<{ empresas: EmpresaLibro[]; formulario: boolean }> {
  if (!veFiniquitos(acceso)) return { empresas: [], formulario: false };
  const empresas = acceso.rol === "administrador" || acceso.rol === "rrhh" ? await empresasConFiniquitos() : await listarEmpresasLibro(acceso);
  if (empresas.length) return { empresas, formulario: true };
  const [encargado, ggo] = await Promise.all([esEncargado(acceso.correo), esGgo(acceso.correo)]);
  return { empresas, formulario: encargado || ggo };
}

// ---------------------------------------------------------------- consulta de las tres hojas

/** Costo empresa por persona, mes de pago y CC, e imponible por persona y marca con tope de 81,6 UF del
 * último día con UF de ese mes (jb_costo_empresa y jb_imponible del original), solo de los meses
 * elegidos. $1/$2 = semanas desde/hasta, $3 = CC del imponible. */
const CTE = `costo_empresa AS (
  SELECT ccnomina, CASE WHEN cuadratura = 'Costo Empresa (-)' THEN -1 ELSE 1 END AS multiplicador
  FROM flesan_rrhh.cc_nomina
  WHERE cuadratura IN ('Costo Empresa', 'Costo Empresa (-)', 'Previred-Costo Empresa')
),
jb_costo_empresa AS (
  SELECT f.numero_de_personal, sum(f.importe::integer * ce.multiplicador) AS valor, ${MES_PAGO} AS fecha_de_pago, f.centro_de_coste
  FROM ${FIN} f
  JOIN costo_empresa ce ON ce.ccnomina = f.cc_nomina
  WHERE replace(${MES_PAGO}, '-', '') BETWEEN left($1, 6) AND left($2, 6)
  GROUP BY f.numero_de_personal, ${MES_PAGO}, f.centro_de_coste
),
jb_uf AS (
  WITH base AS (
    SELECT max(fecha) AS fecha FROM flesan_procesos.api_uf_utm GROUP BY extract(year FROM fecha), extract(month FROM fecha)
  )
  SELECT to_char(base.fecha, 'yyyy-MM') AS ames, valor_uf
  FROM base LEFT JOIN flesan_procesos.api_uf_utm u ON u.fecha = base.fecha
),
jb_imponible AS (
  SELECT f.numero_de_personal, f.marca,
    CASE WHEN sum(f.importe::double precision) > jb_uf.valor_uf::double precision * 81.6
      THEN round(jb_uf.valor_uf::double precision * 81.6)
      ELSE sum(f.importe::double precision) END AS imponible
  FROM ${FIN} f
  LEFT JOIN jb_uf ON jb_uf.ames = f.marca
  WHERE f.cc_nomina = ANY($3::text[]) AND replace(f.marca, '-', '') BETWEEN left($1, 6) AND left($2, 6)
  GROUP BY f.numero_de_personal, f.marca, jb_uf.valor_uf
)`;

/** Los cruces del original (sin la tabla de encargados: ver consultarFiniquitos). */
const DESDE = `FROM ${FIN} f
  LEFT JOIN flesan_rrhh.sap_maestro_colaborador m ON m.user_id = f.numero_de_personal::integer
  LEFT JOIN flesan_rrhh.sap_maestro_cargos c ON c.external_code = m.external_cod_cargo
  LEFT JOIN flesan_rrhh.sap_maestro_tipo_contrato tc ON tc.external_code = m.external_cod_tipo_contrato
  LEFT JOIN jb_costo_empresa ce ON ce.numero_de_personal = f.numero_de_personal AND ce.fecha_de_pago = ${MES_PAGO} AND ce.centro_de_coste = f.centro_de_coste
  LEFT JOIN jb_imponible imp ON imp.numero_de_personal = f.numero_de_personal AND imp.marca = ${MES_PAGO}
  LEFT JOIN flesan_rrhh.sap_maestro_causales_terminos ct ON ct.externalcode = m.eventreason`;

/** Semana de pago de cada fila comparada con las elegidas, como texto («202609Semana 3»), igual que el original. */
const EN_RANGO = `f.tipo_calculo_nomina_perpara != 'A' AND replace(${MES_PAGO}, '-', '') || f.semana >= $1 AND replace(${MES_PAGO}, '-', '') || f.semana <= $2`;

// Fechas del maestro (milisegundos de época en texto), exactamente como el original.
const FECHA_INGRESO = `CASE WHEN LENGTH(m.fecha_ingreso) = 12
    THEN CAST(to_timestamp(SUBSTRING(m.fecha_ingreso, 1, 9)::bigint) + CAST('1 days' AS INTERVAL) AS DATE)
    ELSE CAST(to_timestamp(SUBSTRING(m.fecha_ingreso, 1, 10)::bigint) + CAST('1 days' AS INTERVAL) AS DATE) END`;
const FECHA_ESTIMADA_TERMINO = `CASE WHEN m.fecha_fin_contrato = '32503680000000'
    THEN CAST(to_timestamp(SUBSTRING(m.fecha_fin_contrato, 1, 11)::bigint) + CAST('1 days' AS INTERVAL) AS DATE)
    ELSE CASE WHEN m.fecha_fin_contrato <> ''
      THEN CAST(to_timestamp(SUBSTRING(m.fecha_fin_contrato, 1, 10)::bigint) + CAST('1 days' AS INTERVAL) AS DATE)
      ELSE CAST(to_timestamp(SUBSTRING('32503680000000', 1, 10)::bigint) + CAST('1 days' AS INTERVAL) AS DATE) END
  END`;
const FECHA_RETIRO = `CASE
    WHEN m.fecha_termino = '' THEN '9999-12-31'
    WHEN m.fecha_termino = '32503680000000' THEN CAST(to_timestamp(SUBSTRING(m.fecha_termino, 1, 11)::bigint) + CAST('1 days' AS INTERVAL) AS DATE)
    ELSE CAST(to_timestamp(SUBSTRING(m.fecha_termino, 1, 10)::bigint) + CAST('1 days' AS INTERVAL) AS DATE) END`;

const CC = "(f.centro_de_coste || '-' || f.denominacion)";
const CC_COLABORADOR = "(m.centro_costo || '-' || m.nombre_centro_costo)";
const DIAS = `sum(CASE WHEN f.texto_explcc_nomina = 'Horas en días calendario' THEN replace(f.cantidad, ',', '.')::double precision ELSE 0 END)`;
const DIAS_VACACIONES = `sum(CASE WHEN f.cc_nomina = '/IF2' THEN replace(f.cantidad, ',', '.')::double precision ELSE 0 END)`;
const LIQUIDO = `sum(CASE WHEN f.cc_nomina = '/559' THEN f.importe::integer ELSE 0 END)`;

/** Cada concepto con la misma expresión que el SELECT original. */
function columnaConcepto(c: ConceptoFiniquito): string {
  const en = c.codigos?.map((x) => `'${x}'`).join(", ");
  switch (c.tipo) {
    case "importe":
      return `sum(CASE WHEN f.cc_nomina IN (${en}) THEN f.importe::integer ELSE 0 END)`;
    case "horas":
      return `max(CASE WHEN f.cc_nomina IN (${en}) THEN f.cantidad ELSE '' END)`;
    case "costo_empresa":
      return "ce.valor";
    case "imponible":
      return `(imp.imponible * ${DIAS}) / 30`;
  }
}

/** Columnas de la persona (SOCIEDAD … TIPO CONTRATO y fecha de ingreso). */
const PERSONA = `f.sociedad,
  ${CC} AS cc,
  (m.last_name || ' ' || m.first_name) AS nombre_completo,
  m.national_id AS rut,
  f.numero_de_personal::integer AS np,
  (m.external_cod_cargo || '-' || c.nombre_cargo) AS cargo,
  tc.nombre AS tipo_contrato,
  ${FECHA_INGRESO} AS fecha_ingreso`;

/** Agrupación de la persona, en el orden del original. La fecha de ingreso agrupa (y ordena) por el
 * texto del maestro, no por la fecha: así lo resolvía Postgres en el GROUP BY original. */
const CLAVES_PERSONA = [CC, "(m.last_name || ' ' || m.first_name)", "m.national_id", "f.numero_de_personal::integer", "(m.external_cod_cargo || '-' || c.nombre_cargo)", "tc.nombre", "m.fecha_ingreso"];

export type FilaFiniquito = Record<string, string | null>;

/** Las tres hojas del Excel: el detalle de cada finiquito, el resumen por persona y el resumen por obra. */
export interface Finiquitos {
  detalle: FilaFiniquito[];
  resumen: FilaFiniquito[];
  obra: FilaFiniquito[];
}

/**
 * Los finiquitos de las semanas elegidas, con las mismas reglas que el original según el rol:
 * - Administrador: todas las empresas (getLibroREMvalidacion, p2 y p3).
 * - RRHH: todas menos NFG (getLibroREM, p22 y p33 sin encargado).
 * - Administrativo RRHH y Administrador OBRA: las personas cuyo CC actual (maestro) tiene su correo como
 *   encargado o visitador; nunca NFG; sin el personal de planta de los CC donde figura como
 *   administrativo sin «administrador». La razón social es opcional, como en el antiguo.
 * - La excepción GGO (tchahuan@dvc.cl): igual, pero con los CC donde figura como GGO.
 * El original cruzaba con la tabla de encargados y contaba dos o tres veces a las personas de los CC que
 * están repetidos en ella; aquí cada persona cuenta una vez (decisión del 2026-10-07; hoy no cambia nada).
 * La empresa filtra por la sociedad del finiquito y el CC, por su sociedad y CC. El orden es el que daba
 * el original (agrupaba ordenando por estas columnas); el detalle de RRHH y los encargados además
 * separaba por área de nómina.
 */
export async function consultarFiniquitos(f: FiltrosFiniquitos, acceso: AccesoLibro): Promise<Finiquitos> {
  if (!veFiniquitos(acceso)) return { detalle: [], resumen: [], obra: [] };
  const params: unknown[] = [f.desde, f.hasta, CODIGOS_IMPONIBLE];
  let where = "";
  if (f.empresa) {
    params.push(f.empresa);
    where += ` AND f.sociedad = $${params.length}`;
  }
  if (f.cc) {
    params.push(codigoCc(f.cc));
    where += ` AND (f.sociedad || f.centro_de_coste) = $${params.length}`;
  }
  if (acceso.rol !== "administrador") {
    // Lo que el original armaba en el navegador: «Administrativo» = correo de quien genera (RRHH
    // mandaba «0»: sin filtro de encargado).
    if (acceso.rol !== "rrhh") {
      params.push(acceso.correo);
      const n = params.length;
      const funcion = acceso.rol === "ggo" ? `strpos(lower(e.correo_ggo), $${n}) > 0` : `(lower(trim(e.correo)) = $${n} OR strpos(lower(e.visitador), $${n}) > 0)`;
      where += ` AND EXISTS (SELECT 1 FROM flesan_rrhh.tabla_encargados_cc e WHERE e.centro_coto = ${CC_COLABORADOR} AND ${funcion})`;
      // CC donde figura como administrativo sin «administrador»: sin su personal de planta. El original
      // los buscaba antes y agregaba una condición por cada uno (un centro_coto nulo quedaba como texto vacío).
      where += ` AND NOT (${CC_COLABORADOR} IN (
        SELECT COALESCE(a.centro_coto, '') FROM flesan_rrhh.tabla_encargados_cc a WHERE lower(trim(a.administrativo)) = $${n} AND a.administrador IS NULL
      ) AND COALESCE(c.planta_noplanta, 'PL') = 'PL')`;
    }
    // NFG: nunca, como en los libros (la lista fija de quienes la veían se quitó el 2026-10-06).
    where += ` AND NOT (f.sociedad = 'NFG')`;
  }

  const porArea = acceso.rol !== "administrador" && acceso.rol !== "ggo";
  const hoja = (select: string, claves: string[]) => {
    const orden = claves.join(", ");
    return `WITH ${CTE}
SELECT ${select}
${DESDE}
WHERE ${EN_RANGO}${where}
GROUP BY ${orden}
ORDER BY ${orden}`;
  };

  const detalle = hoja(
    `${PERSONA},
  ${FECHA_ESTIMADA_TERMINO} AS fecha_estimada_termino,
  ${FECHA_RETIRO} AS fecha_retiro,
  ${DIAS} AS dias,
  ${DIAS_VACACIONES} AS dias_vacaciones,
  ct.name AS causal_termino,
  ${CONCEPTOS.map((c) => `${columnaConcepto(c)} AS ${c.clave}`).join(",\n  ")},
  ${MES_PAGO} AS ames,
  f.semana`,
    [
      "f.sociedad",
      ...CLAVES_PERSONA,
      FECHA_ESTIMADA_TERMINO,
      FECHA_RETIRO,
      "ce.valor",
      MES_PAGO,
      "f.semana",
      "c.planta_noplanta",
      "imp.imponible",
      ...(porArea ? ["f.area_calculo_nomina_perpara"] : []),
      "ct.name",
    ],
  );
  const resumen = hoja(
    `${PERSONA},
  ${FECHA_RETIRO} AS fecha_retiro,
  ${DIAS} AS dias,
  ${DIAS_VACACIONES} AS dias_vacaciones,
  ct.name AS causal_termino,
  ${LIQUIDO} AS liquido_pago,
  ${MES_PAGO} AS ames,
  f.semana`,
    ["f.sociedad", ...CLAVES_PERSONA, FECHA_RETIRO, MES_PAGO, "f.semana", "c.planta_noplanta", "imp.imponible", "ct.name"],
  );
  const obra = hoja(`f.sociedad, ${CC} AS cc, ${LIQUIDO} AS liquido_pago, ${MES_PAGO} AS ames, f.semana`, ["f.sociedad", CC, MES_PAGO, "f.semana"]);

  // Las tres a la vez, cada una en su conexión.
  const [d, r, o] = await Promise.all([detalle, resumen, obra].map((sql) => consultar<FilaFiniquito>(sql, params, "memoria")));
  return { detalle: d, resumen: r, obra: o };
}
