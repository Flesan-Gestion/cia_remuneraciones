import type { QueryResultRow } from "pg";
import { pool } from "@/lib/db";
import { conEncargados, leerEncargados } from "@/lib/encargados-cc";
import { CONCEPTOS, type Concepto } from "@/lib/libro/conceptos";
import type { AccesoLibro, EmpresaLibro, FiltrosLibro } from "@/lib/libro/tipos";

/**
 * Consultas del Libro de Remuneraciones a la base transaccional (DATABASE_URL, solo lectura),
 * portadas desde el aplicativo antiguo libro_rem_g2 (class_libro_rem.php). Las reglas son las
 * mismas; cambia que todo va con parámetros y que la tabla de liquidaciones se recorre una sola
 * vez: el original calculaba el costo empresa y el imponible de todos los meses de la historia
 * (tres pasadas completas, ~14 s en la base) para usar solo los del rango pedido. Solo runtime Node.
 */

const LIQ = "flesan_rrhh.sap_liquidaciones_grupo_flesan_g2";
const HORA = 3_600_000;

/** Mes de pago «AAAA-MM», calculado igual que el original (fecha_de_pago es texto tipo «Mon Sep 28 00:00:00 CLST 2026»). */
const MES_PAGO = "SUBSTRING(CAST(l.fecha_de_pago AS date)::varchar, 1, 7)";

/** CC de nómina que suman al imponible (jb_imponible del original). */
const CODIGOS_IMPONIBLE = [
  "MI54", "MI55", "MI56", "MI52", "M020", "MI11", "1060", "1003", "1008", "1009", "1014", "1016", "1035", "1036",
  "1042", "1015", "1031", "1050", "1051", "/IF6", "1010", "1011", "1013", "1012", "1019", "1043", "1024", "1025",
];

/** El original no cuenta en el costo empresa del GGO estos CC (préstamos, colectas, devoluciones). */
const EXCLUIDOS_COSTO_GGO = ["1041", "1006", "1022", "1023", "1021", "/IF2"];

/** El código del CC OYM0000755501 no calza con el de las liquidaciones (excepción del original,
 * también en el libro prorrateado). */
export function codigoCc(cc: string) {
  return cc === "OYM0000755501" ? "OYM755501" : cc;
}

/**
 * Ajustes de la transacción: «pesada» para la consulta del libro (Postgres 10 estima mal las filas
 * de un WITH y elegiría ciclos anidados, y con el work_mem de la base, 1,5 MB, ordenaría en disco:
 * cruces por hash y más memoria) y «memoria» solo para más memoria (libro prorrateado, que sí
 * aprovecha los ciclos anidados por el índice de np_cc_nuevo).
 */
export type AjusteConsulta = "pesada" | "memoria";

const AJUSTES: Record<AjusteConsulta, string[]> = {
  pesada: ["SET LOCAL enable_nestloop = off", "SET LOCAL work_mem = '32MB'"],
  memoria: ["SET LOCAL work_mem = '32MB'"],
};

/** Todo en una transacción de solo lectura; los ajustes van solo en ella. */
export async function consultar<T extends QueryResultRow>(sqlOriginal: string, paramsOriginales: unknown[], ajuste?: AjusteConsulta): Promise<T[]> {
  // Las consultas nombran flesan_rrhh.tabla_encargados_cc como el original; cruzan con su copia
  // del esquema propio (db/006), con las mismas filas.
  const params = [...paramsOriginales];
  const sql = sqlOriginal.includes("flesan_rrhh.tabla_encargados_cc") ? conEncargados(sqlOriginal, params, await leerEncargados()) : sqlOriginal;
  const cliente = await pool.connect();
  try {
    // Una sola ida a la base para abrir la transacción y aplicar los ajustes.
    await cliente.query(["BEGIN READ ONLY", ...(ajuste ? AJUSTES[ajuste] : [])].join("; "));
    // Como pg_fetch_assoc de PHP: todo llega como texto (también un booleano: «t» / «f») y se
    // convierte al armar el Excel.
    const { rows } = await cliente.query<T>({ text: sql, values: params, types: { getTypeParser: () => (v: string) => v } });
    await cliente.query("COMMIT");
    return rows;
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

// ---------------------------------------------------------------- empresas y CC del filtro

export interface FilaCentro {
  external_code_empresa: string | null;
  nombre_empresa: string | null;
  external_code_cc: string | null;
  nombre_cc: string | null;
  administrador?: string | null;
}

/** Agrupa como el PHP: por código de empresa (con trim), CC en el orden de la consulta. El
 * ver_planta de la empresa es el de su última fila (el PHP lo sobrescribía en cada CC). */
export function agrupar(filas: FilaCentro[]): EmpresaLibro[] {
  const porCodigo = new Map<string, EmpresaLibro>();
  for (const f of filas) {
    const codigo = (f.external_code_empresa ?? "").trim();
    let empresa = porCodigo.get(codigo);
    if (!empresa) {
      empresa = { codigo, nombre: "", centros: [], verPlanta: "" };
      porCodigo.set(codigo, empresa);
    }
    empresa.nombre = (f.nombre_empresa ?? "").trim();
    if (f.administrador !== undefined) empresa.verPlanta = (f.administrador ?? "").trim();
    const cc = { codigo: (f.external_code_cc ?? "").trim(), nombre: (f.nombre_cc ?? "").trim() };
    if (!empresa.centros.some((c) => c.codigo === cc.codigo && c.nombre === cc.nombre)) empresa.centros.push(cc);
  }
  return [...porCodigo.values()];
}

declare global {
  var _empresasLibro: { valor: EmpresaLibro[]; en: number } | undefined;
}

/**
 * getCentrosGestion1 (Administrador y RRHH): la empresa y el CC actuales (maestro de
 * colaboradores) de toda persona con alguna liquidación, con el nombre de empresa de su
 * liquidación más reciente. El original recorría y ordenaba la tabla entera dos veces (~34 s al
 * abrir la pantalla); aquí es una pasada agrupada y se guarda una hora en memoria.
 */
async function empresasConLiquidaciones(): Promise<EmpresaLibro[]> {
  const cache = globalThis._empresasLibro;
  if (cache && Date.now() - cache.en < HORA) return cache.valor;
  const filas = await consultar<FilaCentro>(
    `WITH personas AS (
       SELECT numero_de_personal, nombre_de_la_empresa, max(CAST(fecha_de_pago AS date)) AS ultima
       FROM ${LIQ} GROUP BY 1, 2
     ),
     con_maestro AS (
       SELECT m.empresa, m.centro_costo, m.nombre_centro_costo, p.nombre_de_la_empresa, p.ultima
       FROM personas p
       JOIN flesan_rrhh.sap_maestro_colaborador m ON m.user_id = p.numero_de_personal::integer
       WHERE m.empresa IS NOT NULL
     ),
     nombre_vigente AS (
       SELECT DISTINCT ON (empresa) empresa, nombre_de_la_empresa AS nombre_empresa
       FROM con_maestro
       WHERE nombre_de_la_empresa IS NOT NULL AND nombre_de_la_empresa <> ''
       ORDER BY empresa, ultima DESC, nombre_de_la_empresa
     )
     SELECT c.empresa AS external_code_empresa, n.nombre_empresa, c.centro_costo AS external_code_cc, c.nombre_centro_costo AS nombre_cc
     FROM con_maestro c
     JOIN nombre_vigente n ON n.empresa = c.empresa
     GROUP BY 1, 2, 3, 4
     ORDER BY n.nombre_empresa, c.nombre_centro_costo`,
    [],
    "pesada",
  );
  const valor = agrupar(filas);
  globalThis._empresasLibro = { valor, en: Date.now() };
  return valor;
}

/** Si el correo figura como GGO en algún centro (ggo() del original: correo_ggo like '%correo%'). */
export async function esGgo(correo: string): Promise<boolean> {
  const filas = await consultar(`SELECT 1 FROM flesan_rrhh.tabla_encargados_cc WHERE strpos(lower(correo_ggo), $1) > 0 LIMIT 1`, [correo]);
  return filas.length > 0;
}

/**
 * Empresas y CC que muestra el filtro, según el rol (libro_rem.php):
 * - Administrador y RRHH: todas (getCentrosGestion1).
 * - Quien aparece como GGO de algún CC: esos CC (getCentrosGestion2).
 * - El resto: los CC donde es encargado o visitador (getCentrosGestion), con su ver_planta.
 * La tabla de encargados es la copia del esquema propio (db/006), con las mismas filas.
 */
export async function listarEmpresasLibro(acceso: AccesoLibro): Promise<EmpresaLibro[]> {
  if (acceso.rol === "administrador" || acceso.rol === "rrhh") return empresasConLiquidaciones();
  const LLAVE = "t.llave = (e.external_code_empresa || '-' || e.nombre_empresa || e.external_code_cc || '-' || e.nombre_cc)";
  if (await esGgo(acceso.correo)) {
    // Sin ver_planta (el original no lo traía en esta lista).
    return agrupar(
      await consultar<FilaCentro>(
        `SELECT e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc
         FROM flesan_rrhh.sap_maestro_empresa_dep_un_cc e
         LEFT JOIN flesan_rrhh.tabla_encargados_cc t ON ${LLAVE}
         WHERE e.external_code_cc NOT LIKE 'FL%' AND strpos(lower(t.correo_ggo), $1) > 0
         GROUP BY e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc, t.correo_ggo
         ORDER BY e.nombre_empresa, e.nombre_cc`,
        [acceso.correo],
      ),
    );
  }
  return agrupar(
    await consultar<FilaCentro>(
      `SELECT e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc, t.administrador
       FROM flesan_rrhh.sap_maestro_empresa_dep_un_cc e
       LEFT JOIN flesan_rrhh.tabla_encargados_cc t ON ${LLAVE}
       WHERE e.external_code_cc NOT LIKE 'FL%' AND (lower(trim(t.correo)) = $1 OR lower(trim(t.visitador)) = $1)
       GROUP BY e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc, t.correo, t.administrador
       ORDER BY e.nombre_empresa, e.nombre_cc`,
      [acceso.correo],
    ),
  );
}

// ---------------------------------------------------------------- consulta del libro

const MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Abreviaturas (en inglés, como vienen en fecha_de_pago) de los meses del rango AAAAMM. */
function mesesDelRango(desde: string, hasta: string): string[] {
  const meses = new Set<string>();
  let a = Number(desde.slice(0, 4));
  let m = Number(desde.slice(4, 6));
  const fin = Number(hasta.slice(0, 4)) * 12 + Number(hasta.slice(4, 6));
  while (a * 12 + m <= fin && meses.size < 12) {
    meses.add(MESES_EN[m - 1]);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return [...meses];
}

/**
 * Las filas de liquidaciones que usa el libro, en una sola pasada por la tabla: las pagadas en el
 * rango (el libro filtra por mes de pago, no por periodo de nómina) y las del imponible cuya marca
 * cae en el rango. fecha_de_pago es texto («Mon Sep 28 00:00:00 CLST 2026»): el mes y el año del
 * texto descartan las filas de otros meses sin convertirlas a fecha; la conversión exacta (la del
 * original) se hace solo con las que quedan, y con todas si el texto viniera en otro formato.
 * $1/$2 = AAAAMM desde/hasta, $3 = CC del imponible, $4 = meses del rango.
 */
const LIQ_DEL_RANGO = `liq AS (
  SELECT l.numero_de_personal, l.sociedad, l.centro_de_coste, l.denominacion, l.cc_nomina, l.texto_explcc_nomina,
    l.cantidad, l.importe, l.marca, l.tipo_calculo_nomina_perpara, l.area_calculo_nomina_perpara,
    ${MES_PAGO} AS mes_pago
  FROM ${LIQ} l
  WHERE ((substring(l.fecha_de_pago, 4, 1) <> ' ' OR substring(l.fecha_de_pago, 8, 1) <> ' '
          OR (substring(l.fecha_de_pago, 5, 3) = ANY($4::text[]) AND right(l.fecha_de_pago, 4) BETWEEN left($1, 4) AND left($2, 4)))
         AND replace(${MES_PAGO}, '-', '') BETWEEN $1 AND $2)
     OR (l.cc_nomina = ANY($3::text[]) AND replace(l.marca, '-', '') BETWEEN $1 AND $2)
)`;

/** Costo empresa por persona, mes de pago y CC (jb_costo_empresa del original). */
function costoEmpresa(excluir: string[]) {
  return `costo_empresa AS (
  SELECT ccnomina, CASE WHEN cuadratura = 'Costo Empresa (-)' THEN -1 ELSE 1 END AS multiplicador
  FROM flesan_rrhh.cc_nomina
  WHERE cuadratura IN ('Costo Empresa', 'Costo Empresa (-)', 'Previred-Costo Empresa')
    ${excluir.length ? `AND NOT ccnomina IN (${excluir.map((x) => `'${x}'`).join(", ")})` : ""}
),
jb_costo_empresa AS (
  SELECT l.numero_de_personal, sum(l.importe::integer * ce.multiplicador) AS valor, l.mes_pago, l.centro_de_coste
  FROM liq l
  JOIN costo_empresa ce ON ce.ccnomina = l.cc_nomina
  WHERE replace(l.mes_pago, '-', '') BETWEEN $1 AND $2
  GROUP BY l.numero_de_personal, l.mes_pago, l.centro_de_coste
)`;
}

/** Imponible por persona y marca, con tope de 81,6 UF del último día con UF de ese mes (jb_imponible). */
const IMPONIBLE = `jb_uf AS (
  WITH base AS (
    SELECT max(fecha) AS fecha FROM flesan_procesos.api_uf_utm GROUP BY extract(year FROM fecha), extract(month FROM fecha)
  )
  SELECT to_char(base.fecha, 'yyyy-MM') AS ames, valor_uf
  FROM base LEFT JOIN flesan_procesos.api_uf_utm u ON u.fecha = base.fecha
),
jb_imponible AS (
  SELECT l.numero_de_personal, l.marca,
    CASE WHEN sum(l.importe::double precision) > jb_uf.valor_uf::double precision * 81.6
      THEN round(jb_uf.valor_uf::double precision * 81.6)
      ELSE sum(l.importe::double precision) END AS imponible
  FROM liq l
  LEFT JOIN jb_uf ON jb_uf.ames = l.marca
  WHERE l.cc_nomina = ANY($3::text[]) AND replace(l.marca, '-', '') BETWEEN $1 AND $2
  GROUP BY l.numero_de_personal, l.marca, jb_uf.valor_uf
)`;

const DIAS = `sum(CASE WHEN l.texto_explcc_nomina = 'Horas en días calendario' THEN replace(l.cantidad, ',', '.')::double precision ELSE 0 END)`;

/** Suma de un concepto sobre las filas de liquidaciones (las mismas expresiones que el SELECT original). */
function sumaConcepto(c: Concepto): string {
  const en = c.codigos?.map((x) => `'${x}'`).join(", ");
  switch (c.tipo) {
    case "importe":
      return `sum(CASE WHEN l.cc_nomina IN (${en}) THEN l.importe::integer ELSE 0 END)`;
    case "cantidad":
      return `sum(CASE WHEN l.cc_nomina IN (${en}) THEN replace(l.cantidad, ',', '.')::double precision ELSE 0 END)`;
    case "horas":
      return `max(CASE WHEN l.cc_nomina IN (${en}) THEN l.cantidad ELSE '' END)`;
    case "costo_empresa":
      // Las vacaciones proporcionales (/IF2); el costo empresa del mes se suma después.
      return `sum(CASE WHEN l.cc_nomina = '/IF2' THEN l.importe::integer ELSE 0 END)`;
    case "imponible":
      return "";
  }
}

/** El concepto ya sumado por persona, CC y área, vuelto a agrupar con las columnas del original. */
function totalConcepto(c: Concepto): string {
  switch (c.tipo) {
    case "horas":
      return `max(p.${c.clave})`;
    case "costo_empresa":
      return `COALESCE(ce.valor, 0) + sum(p.${c.clave})`;
    case "imponible":
      return "imp.imponible";
    default:
      return `sum(p.${c.clave})`;
  }
}

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

const CC_COLABORADOR = "(m.centro_costo || '-' || m.nombre_centro_costo)";

/** Maestro, cargo, tipo de contrato, costo empresa y administrativo de cada fila (alias `x`: liq o pre). */
function joinsMaestro(x: string) {
  return `LEFT JOIN flesan_rrhh.sap_maestro_colaborador m ON m.user_id = ${x}.numero_de_personal::integer
  LEFT JOIN flesan_rrhh.sap_maestro_cargos c ON c.external_code = m.external_cod_cargo
  LEFT JOIN flesan_rrhh.sap_maestro_tipo_contrato tc ON tc.external_code = m.external_cod_tipo_contrato
  LEFT JOIN jb_costo_empresa ce
    ON ce.numero_de_personal = ${x}.numero_de_personal AND ce.mes_pago = ${x}.mes_pago AND ce.centro_de_coste = ${x}.centro_de_coste
  LEFT JOIN (SELECT centro_coto, max(administrativo) AS administrativo FROM flesan_rrhh.tabla_encargados_cc GROUP BY centro_coto) t
    ON t.centro_coto = ${CC_COLABORADOR}`;
}

/** Columnas del inicio (SOCIEDAD … TIPO CONTRATO y fechas), con los mismos nombres que el original. */
function columnasPersona(x: string) {
  return `${x}.sociedad,
  (${x}.centro_de_coste || '-' || ${x}.denominacion) AS cc,
  (m.last_name || ' ' || m.first_name) AS nombre_completo,
  m.national_id AS rut,
  ${x}.numero_de_personal::integer AS np,
  m.external_cod_cargo || '-' || c.nombre_cargo AS cargo,
  tc.nombre AS tipo_contrato,
  ${FECHA_INGRESO} AS fecha_ingreso,
  ${FECHA_ESTIMADA_TERMINO} AS fecha_estimada_termino,
  ${FECHA_RETIRO} AS fecha_retiro`;
}

/** Variante según el rol: «todo» (getLibroREMvalidacion), «ggo» (getLibroREMGGO) o «normal» (getLibroREM). */
export type VarianteLibro = "todo" | "ggo" | "normal";

export function varianteDe(acceso: AccesoLibro): VarianteLibro {
  if (acceso.rol === "administrador") return "todo";
  if (acceso.rol === "ggo") return "ggo";
  return "normal";
}

/**
 * Con el ver_planta de la empresa elegida y si la persona es «Administrador» (el visitador que
 * devolvía Administrativ()): el encargado de una empresa con ver_planta = 'x' que no es su
 * visitador ve solo personal no planta (libro_rem.php, generarEXCEL).
 */
async function soloNoPlanta(acceso: AccesoLibro, verPlanta: string | undefined): Promise<boolean> {
  if (verPlanta !== "x") return false;
  const filas = await consultar<{ visitador: string | null }>(
    `SELECT DISTINCT visitador FROM flesan_rrhh.tabla_encargados_cc WHERE strpos(lower(visitador), $1) > 0 ORDER BY visitador LIMIT 1`,
    [acceso.correo],
  );
  return (filas[0]?.visitador ?? "").trim().toLowerCase() !== acceso.correo;
}

export type FilaLibro = Record<string, string | null>;

/**
 * El libro: una fila por persona, CC de la liquidación y mes de pago, con los conceptos en
 * columnas. Mismas reglas que el original según el rol:
 * - Administrador: todas las empresas (incluida NFG), con los filtros de empresa y CC.
 * - RRHH: todas menos NFG.
 * - Administrativo RRHH y Administrador OBRA: los CC actuales de las personas donde es encargado
 *   (correo) o visitador; nunca NFG; solo no planta si su empresa tiene
 *   ver_planta y no es el visitador; sin el personal de planta de los CC donde figura como
 *   administrativo sin «administrador».
 * - GGO: los CC donde figura como GGO, con solo costo empresa (consulta propia del original).
 * La tabla de encargados es la copia del esquema propio (db/006), con las mismas filas.
 */
export async function consultarLibro(f: FiltrosLibro, acceso: AccesoLibro): Promise<FilaLibro[]> {
  if (!acceso.rol) return [];
  const variante = varianteDe(acceso);
  const params: unknown[] = [f.desde, f.hasta, CODIGOS_IMPONIBLE, mesesDelRango(f.desde, f.hasta)];
  // Condiciones sobre las liquidaciones (l) y sobre el maestro y el cargo (m, c).
  let whereLiq = "";
  let whereMaestro = "";
  if (f.empresa) {
    params.push(f.empresa);
    whereLiq += ` AND l.sociedad = $${params.length}`;
  }
  if (f.cc) {
    params.push(codigoCc(f.cc));
    whereLiq += ` AND (l.sociedad || l.centro_de_coste) = $${params.length}`;
  }

  if (variante === "ggo") {
    params.push(acceso.correo);
    const sql = `WITH ${LIQ_DEL_RANGO},
${costoEmpresa(EXCLUIDOS_COSTO_GGO)}
SELECT ${columnasPersona("l")},
  ${DIAS} AS dias,
  c.planta_noplanta AS planta,
  COALESCE(ce.valor, 0) + sum(CASE WHEN l.cc_nomina = '/IF2' THEN l.importe::integer ELSE 0 END) AS costo_empresa,
  replace(l.mes_pago, '-', '') AS ames,
  cg.nombre_clasificacion_gasto
FROM liq l
  ${joinsMaestro("l")}
  LEFT JOIN flesan_rrhh.sap_maestro_clasificacion_gasto cg ON cg.id_clasificacion_gasto::varchar = m.id_clasificacion_gasto::varchar
WHERE EXISTS (
    SELECT 1 FROM flesan_rrhh.tabla_encargados_cc e
    WHERE e.centro_coto = ${CC_COLABORADOR} AND strpos(lower(e.correo_ggo), $${params.length}) > 0
  )
  AND l.tipo_calculo_nomina_perpara != 'A' AND replace(l.mes_pago, '-', '') BETWEEN $1 AND $2${whereLiq}
GROUP BY m.fecha_termino, tc.nombre, m.fecha_fin_contrato, m.fecha_ingreso, l.sociedad, cc, nombre_completo, rut, np, cargo,
  ce.valor, l.mes_pago, t.administrativo, c.planta_noplanta, cg.nombre_clasificacion_gasto
ORDER BY replace(l.mes_pago, '-', ''), nombre_completo`;
    return consultar<FilaLibro>(sql, params, "pesada");
  }

  if (variante === "normal") {
    // Lo que el original armaba en el navegador: «Administrativo» = correo del encargado (RRHH
    // mandaba «0»: sin filtro de encargado) y «NP» = solo no planta.
    const encargado = acceso.rol === "rrhh" ? null : acceso.correo;
    if (encargado) {
      // La razón social tiene que ser una de su lista (en el antiguo solo la elegía de ahí, pero la
      // URL se podía editar): de ella sale el ver_planta.
      const empresa = (await listarEmpresasLibro(acceso)).find((e) => e.codigo === f.empresa);
      if (!empresa) return [];
      params.push(encargado);
      const n = params.length;
      whereMaestro += ` AND EXISTS (
    SELECT 1 FROM flesan_rrhh.tabla_encargados_cc e
    WHERE e.centro_coto = ${CC_COLABORADOR} AND (lower(trim(e.correo)) = $${n} OR strpos(lower(e.visitador), $${n}) > 0)
  )`;
      if (await soloNoPlanta(acceso, empresa.verPlanta)) whereMaestro += ` AND c.planta_noplanta = 'NP'`;
      // CC donde figura como administrativo sin «administrador»: sin su personal de planta.
      const sinPlanta = await consultar<{ centro_coto: string }>(
        `SELECT centro_coto FROM flesan_rrhh.tabla_encargados_cc WHERE lower(trim(administrativo)) = $1 AND administrador IS NULL`,
        [encargado],
      );
      if (sinPlanta.length) {
        params.push(sinPlanta.map((s) => s.centro_coto));
        whereMaestro += ` AND NOT (${CC_COLABORADOR} = ANY($${params.length}::text[]) AND COALESCE(c.planta_noplanta, 'PL') = 'PL')`;
      }
    }
    // NFG: nunca para RRHH ni para el encargado. Antes, una lista fija de encargados (ve_nfg) la
    // veía; NFG ya no es del grupo y la marca se quitó (2026-10-06, decisión del usuario).
    whereLiq += ` AND NOT (l.sociedad = 'NFG')`;
  }

  // Primero se suma cada concepto por persona, mes, CC y área de nómina sin cruzar nada (de
  // ~150.000 filas por mes a ~2.000); después se cruza con el maestro y se agrupa con las
  // columnas del original. El resultado es el mismo y se evita ordenar y cruzar todas las filas.
  // El orden es el que daba el original (agrupaba ordenando por estas columnas); en «normal» el
  // original además separaba por área de nómina.
  const agrupacion = `p.sociedad, cc, nombre_completo, rut, np, cargo, tipo_contrato, fecha_ingreso, fecha_estimada_termino, fecha_retiro,
  ce.valor, p.mes_pago, t.administrativo, c.planta_noplanta, imp.imponible${variante === "normal" ? ", p.area_calculo_nomina_perpara" : ""}`;
  const conceptos = CONCEPTOS.filter((c) => c.tipo !== "imponible");
  const sql = `WITH ${LIQ_DEL_RANGO},
${costoEmpresa([])},
${IMPONIBLE},
pre AS (
  SELECT l.numero_de_personal, l.mes_pago, l.sociedad, l.centro_de_coste, l.denominacion, l.area_calculo_nomina_perpara,
    ${DIAS} AS dias,
    ${conceptos.map((c) => `${sumaConcepto(c)} AS ${c.clave}`).join(",\n    ")}
  FROM liq l
  WHERE l.tipo_calculo_nomina_perpara != 'A' AND replace(l.mes_pago, '-', '') BETWEEN $1 AND $2${whereLiq}
  GROUP BY 1, 2, 3, 4, 5, 6
)
SELECT ${columnasPersona("p")},
  sum(p.dias) AS dias,
  ${CONCEPTOS.map((c) => `${totalConcepto(c)} AS ${c.clave}`).join(",\n  ")},
  p.mes_pago AS ames,
  t.administrativo,
  c.planta_noplanta AS planta
FROM pre p
  ${joinsMaestro("p")}
  LEFT JOIN jb_imponible imp ON imp.numero_de_personal = p.numero_de_personal AND imp.marca = p.mes_pago
WHERE true${whereMaestro}
GROUP BY ${agrupacion}
ORDER BY ${agrupacion}`;
  return consultar<FilaLibro>(sql, params, "pesada");
}
