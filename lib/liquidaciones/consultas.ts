import type { QueryResultRow } from "pg";
import { pool } from "@/lib/db";
import { normalizar } from "@/lib/liquidaciones/formato";
import type { Acceso, Empresa, FilaVista, Filtros } from "@/lib/liquidaciones/tipos";
import { conEncargados, leerEncargados } from "@/lib/encargados-cc";

/**
 * Consultas a la base transaccional (DATABASE_URL, solo lectura), portadas desde el aplicativo
 * antiguo liquidaciones_sap_g2 (class_liquidaciones.php y liquidaciones_pdf_new.php). Las reglas
 * de negocio son las mismas; cambia que todo va con parámetros y que el detalle se pide en lote
 * (una consulta para todas las personas, no una por persona). Solo runtime Node.
 */

const LIQ = "flesan_rrhh.sap_liquidaciones_grupo_flesan_g2";

// ---------------------------------------------------------------- periodos (getfecha)

const HORA = 3_600_000;
declare global {
  var _periodosLiquidaciones: { valor: string[]; en: number } | undefined;
}

/** Periodos con liquidaciones, del más reciente al más antiguo. La consulta recorre toda la tabla
 * (varios segundos, no tiene índices), así que se guarda una hora en memoria. */
export async function listarPeriodos(): Promise<string[]> {
  const cache = globalThis._periodosLiquidaciones;
  if (cache && Date.now() - cache.en < HORA) return cache.valor;
  const { rows } = await pool.query<{ periodo_para_nomina: string }>(
    `SELECT DISTINCT periodo_para_nomina FROM ${LIQ}
     WHERE NOT (periodo_para_nomina = '000000') ORDER BY periodo_para_nomina DESC`,
  );
  const valor = rows.map((r) => r.periodo_para_nomina).filter((p) => /^\d{6}$/.test(p));
  globalThis._periodosLiquidaciones = { valor, en: Date.now() };
  return valor;
}

// ---------------------------------------------------------------- empresas y CC (getCentrosGestion*)

interface FilaCentro {
  external_code_empresa: string;
  nombre_empresa: string;
  external_code_cc: string;
  nombre_cc: string;
}

/**
 * Empresas y centros de costo del filtro, según el perfil:
 * - RR.HH.: todas las CC activas (getCentrosGestion1).
 * - Con empresas fijas (manuel.hidalgo → IX): todas las CC activas de esas empresas (getCentrosGestion2).
 * - Jefatura: las CC donde es encargado o visitador en tabla_encargados_cc (getCentrosGestion), hoy
 *   la copia del esquema propio (db/006).
 */
export async function listarEmpresas(acceso: Acceso): Promise<Empresa[]> {
  let filas: FilaCentro[];
  if (acceso.perfil === "rrhh" || acceso.empresas) {
    const { rows } = await pool.query<FilaCentro>(
      `SELECT e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc
       FROM flesan_rrhh.sap_maestro_empresa_dep_un_cc e
       WHERE e.external_code_cc NOT LIKE 'FL%' AND e.status_cc = 'A'
         AND ($1::text[] IS NULL OR e.external_code_empresa = ANY($1::text[]))
       GROUP BY 1, 2, 3, 4
       ORDER BY e.nombre_empresa, e.nombre_cc`,
      [acceso.perfil === "rrhh" ? null : acceso.empresas],
    );
    filas = rows;
  } else {
    const params: unknown[] = [acceso.correo];
    const sql = conEncargados(
      `SELECT e.external_code_empresa, e.nombre_empresa, e.external_code_cc, e.nombre_cc
       FROM flesan_rrhh.sap_maestro_empresa_dep_un_cc e
       LEFT JOIN flesan_rrhh.tabla_encargados_cc t
         ON t.llave = (e.external_code_empresa || '-' || e.nombre_empresa || e.external_code_cc || '-' || e.nombre_cc)
       WHERE e.external_code_cc NOT LIKE 'FL%' AND e.status_cc = 'A'
         AND (lower(trim(t.correo)) = $1 OR lower(trim(t.visitador)) = $1)
       GROUP BY 1, 2, 3, 4
       ORDER BY e.nombre_empresa, e.nombre_cc`,
      params,
      await leerEncargados(),
    );
    const { rows } = await pool.query<FilaCentro>(sql, params);
    filas = rows;
  }

  const porCodigo = new Map<string, Empresa>();
  for (const f of filas) {
    const codigo = (f.external_code_empresa ?? "").trim();
    let empresa = porCodigo.get(codigo);
    if (!empresa) {
      empresa = { codigo, nombre: (f.nombre_empresa ?? "").trim(), centros: [] };
      porCodigo.set(codigo, empresa);
    }
    empresa.centros.push({ codigo: (f.external_code_cc ?? "").trim(), nombre: (f.nombre_cc ?? "").trim() });
  }
  return [...porCodigo.values()];
}

// ---------------------------------------------------------------- listado (query0 del PDF)

export interface FilaListado {
  apellido_nombre: string;
  numero_de_personal: string;
  periodo_para_nomina: string;
  periodo_efectivo: string;
  tipo_calculo: string;
  sociedad: string;
  centro_costo: string | null;
  planta_noplanta: string | null;
  nombre_cc: string | null;
  /** Si la liquidación solo trae el total a pagar (posición 800); null si no trae conceptos del PDF. */
  solo_total: boolean | null;
}

/** Arma el filtro «persona»: número de personal exacto (como el original), RUT o nombre. */
function condicionPersona(texto: string, params: unknown[]) {
  const partes: string[] = [];
  const limpio = texto.trim();
  if (/\d/.test(limpio)) {
    params.push(limpio);
    partes.push(`l.numero_de_personal = $${params.length}`);
    // RUT con o sin puntos, guion y dígito verificador.
    const sinPuntos = limpio.replace(/[.\s]/g, "");
    const cuerpo = sinPuntos.includes("-") ? [sinPuntos.split("-")[0]] : [sinPuntos, sinPuntos.slice(0, -1)];
    const ruts = cuerpo.map((c) => c.replace(/\D/g, "").replace(/^0+/, "")).filter((c) => c.length >= 7);
    if (ruts.length) {
      params.push(ruts);
      partes.push(`ltrim(split_part(m.national_id, '-', 1), '0') = ANY($${params.length}::text[])`);
    }
  }
  const palabras = normalizar(limpio)
    .split(/\s+/)
    .filter((p) => /[a-zñ]/.test(p))
    .map((p) => `%${p.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (palabras.length) {
    params.push(palabras);
    partes.push(`translate(lower(l.apellido_nombre), 'áéíóúüñàèìòù', 'aeiouunaeiou') LIKE ALL ($${params.length}::text[])`);
  }
  return partes.length ? ` AND (${partes.join(" OR ")})` : " AND false";
}

/**
 * Liquidaciones que calzan con los filtros y que el usuario puede ver. Es el query0 de
 * liquidaciones_pdf_new.php con las mismas ramas:
 * - RR.HH. (código d6a7ec08-…): filtros de empresa, CC, persona y planta; ve NFG.
 * - Jefatura con empresas asignadas (usuarios.empresas): todas las liquidaciones de esas empresas,
 *   con los filtros de RR.HH.; nunca NFG. En el original esta rama (la de manuel.hidalgo) existía
 *   pero nunca se ejecutaba; desde 2026-10-06 sí da acceso (decisión del usuario).
 * - Jefatura: CC donde es encargado o visitador; personal no planta, y de planta solo si el CC no
 *   tiene ver_planta; nunca NFG. El filtro de planta no aplica (el original lo ignoraba). La tabla
 *   de encargados es la copia del esquema propio (db/006), con las mismas filas.
 * Incluye las nóminas fuera de ciclo (periodo 000000, tipo de cálculo B) con la marca como periodo.
 */
export async function listarLiquidaciones(f: Filtros, acceso: Acceso): Promise<FilaListado[]> {
  if (acceso.perfil === "sin_acceso") return [];
  const params: unknown[] = [f.desde, f.hasta];
  let where = "";
  // Solo la jefatura por CC cruza con la tabla de encargados: en las otras ramas el cruce no
  // cambiaba el resultado (no se filtra por ella y el GROUP BY quita las filas repetidas).
  const porEncargados = acceso.perfil === "jefatura" && !acceso.empresas;
  if (acceso.perfil === "rrhh") {
    if (f.empresa) {
      params.push(f.empresa);
      where += ` AND l.sociedad = $${params.length}`;
    }
    if (f.cc) {
      params.push(f.cc);
      where += ` AND m.centro_costo = $${params.length}`;
    }
    if (f.persona) where += condicionPersona(f.persona, params);
    if (f.planta) {
      params.push(f.planta);
      where += ` AND c.planta_noplanta = $${params.length}`;
    }
  } else if (acceso.empresas) {
    params.push(acceso.empresas);
    where += ` AND l.sociedad = ANY($${params.length}::text[]) AND l.sociedad <> 'NFG'`;
    if (f.empresa) {
      params.push(f.empresa);
      where += ` AND l.sociedad = $${params.length}`;
    }
    if (f.cc) {
      params.push(f.cc);
      where += ` AND m.centro_costo = $${params.length}`;
    }
    if (f.persona) where += condicionPersona(f.persona, params);
    if (f.planta) {
      params.push(f.planta);
      where += ` AND c.planta_noplanta = $${params.length}`;
    }
  } else {
    if (f.empresa && f.empresa !== "NFG") {
      params.push(f.empresa);
      where += ` AND l.sociedad = $${params.length}`;
    }
    if (f.cc) {
      params.push(f.cc);
      where += ` AND m.centro_costo = $${params.length}`;
    }
    if (f.persona) where += condicionPersona(f.persona, params);
    params.push(acceso.correo);
    where += ` AND (lower(trim(t.correo)) = $${params.length} OR lower(trim(t.visitador)) = $${params.length})
      AND (c.planta_noplanta = 'NP' OR ((t.ver_planta IS NULL OR t.ver_planta = '') AND c.planta_noplanta = 'PL'))
      AND l.sociedad <> 'NFG'`;
  }

  const sql = `SELECT l.apellido_nombre, l.numero_de_personal, l.periodo_para_nomina,
       CASE WHEN l.periodo_para_nomina = '000000' THEN REPLACE(l.marca, '-', '') ELSE l.periodo_para_nomina END AS periodo_efectivo,
       COALESCE(l.tipo_calculo_nomina_perpara, '') AS tipo_calculo,
       l.sociedad, m.centro_costo, c.planta_noplanta, MAX(m.nombre_centro_costo) AS nombre_cc,
       -- Si solo trae el total a pagar, con los mismos conceptos que el PDF (ver reliquidaciones()).
       bool_and(p.posicion = 800) FILTER (WHERE p.tipo IS NOT NULL AND l.tipo_calculo_nomina_perpara <> 'A') AS solo_total
     FROM ${LIQ} l
     INNER JOIN flesan_rrhh.sap_tabla_paso_liquidaciones p ON p.cc_nimina_sap = l.cc_nomina
     LEFT JOIN flesan_rrhh.sap_maestro_colaborador m
       ON m.user_id = l.numero_de_personal::integer AND m.empresa = l.sociedad
     LEFT JOIN flesan_rrhh.sap_maestro_cargos c ON c.external_code = m.external_cod_cargo${
       porEncargados ? "\n     LEFT JOIN flesan_rrhh.tabla_encargados_cc t ON t.centro_coto = m.centro_costo || '-' || m.nombre_centro_costo" : ""
     }
     WHERE (
       (l.periodo_para_nomina >= $1 AND l.periodo_para_nomina <= $2)
       OR (
         l.periodo_para_nomina = '000000'
         AND l.tipo_calculo_nomina_perpara = 'B'
         AND REPLACE(l.marca, '-', '') >= $1
         AND REPLACE(l.marca, '-', '') <= $2
       )
     )${where}
     GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
     ORDER BY l.apellido_nombre`;
  const { rows } = await pool.query<FilaListado>(porEncargados ? conEncargados(sql, params, await leerEncargados()) : sql, params);
  return rows;
}

// ---------------------------------------------------------------- pedidos en lote

/** Una liquidación: persona + periodo de nómina + periodo efectivo (la marca, en fuera de ciclo). */
export interface ClaveLiquidacion {
  numero_de_personal: string;
  periodo_para_nomina: string;
  periodo_efectivo: string;
}

export function claveDe(l: ClaveLiquidacion) {
  return `${l.numero_de_personal}|${l.periodo_para_nomina}|${l.periodo_efectivo}`;
}

/** Una fila por liquidación: el listado repite la liquidación de quien aparece con dos sociedades o CC. */
export function unaPorClave<T extends ClaveLiquidacion>(filas: T[]): T[] {
  const vistas = new Set<string>();
  return filas.filter((f) => {
    const clave = claveDe(f);
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

const esFueraDeCiclo = (l: ClaveLiquidacion) => l.periodo_para_nomina === "000000";

/**
 * Reliquidaciones (2026-10-21): la fuera de ciclo que se suma a una liquidación normal, por la clave de
 * cada normal. Se suman si son del mismo NP, mes y sociedad y la fuera de ciclo solo trae el total a
 * pagar (posición 800): el detalle de la normal ya la incluye y su total no (jul-sep 2026: 263 casos,
 * todos cuadran al sumar). Quien fue finiquitado y recontratado el mismo mes tiene otro NP: no se suma.
 */
export function reliquidaciones<T extends ClaveLiquidacion & { sociedad: string | null; solo_total: boolean | null }>(filas: T[]): Map<string, T> {
  const personaMes = (l: T) => `${l.numero_de_personal}|${l.periodo_efectivo}|${l.sociedad ?? ""}`;
  const sumables = new Map(filas.filter((l) => esFueraDeCiclo(l) && l.solo_total).map((l) => [personaMes(l), l]));
  const pares = new Map<string, T>();
  for (const l of filas) {
    const fueraDeCiclo = esFueraDeCiclo(l) ? undefined : sumables.get(personaMes(l));
    if (fueraDeCiclo) pares.set(claveDe(l), fueraDeCiclo);
  }
  return pares;
}

/** $1-$3: las liquidaciones pedidas; $4: sus periodos de nómina sin repetir. Postgres 10 recorre
 * un ANY(arreglo) elemento por elemento: con miles de personas, el número de personal se filtra
 * con IN (subconsulta), que usa una tabla hash, y el ANY queda solo para los pocos periodos. */
function arreglos(pedidos: ClaveLiquidacion[]) {
  return [
    pedidos.map((p) => p.numero_de_personal),
    pedidos.map((p) => p.periodo_para_nomina),
    pedidos.map((p) => p.periodo_efectivo),
    [...new Set(pedidos.map((p) => p.periodo_para_nomina))],
  ];
}

// En Postgres 10 (la base transaccional) cada WITH se calcula una vez: «liq» recorre la tabla de
// liquidaciones (sin índices, ~5 millones de filas) una sola vez, ya filtrada por persona y periodo.
/** Postgres 10 estima que un WITH trae muy pocas filas y elige ciclos anidados (con miles de
 * personas, decenas de segundos). En las consultas en lote se le piden cruces por hash. */
async function consultaEnLote<T extends QueryResultRow>(sql: string, params: unknown[]): Promise<T[]> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN READ ONLY");
    await cliente.query("SET LOCAL enable_nestloop = off");
    const { rows } = await cliente.query<T>(sql, params);
    await cliente.query("COMMIT");
    return rows;
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

const PEDIDOS = `pedidos AS (
  SELECT DISTINCT np, pn, pe FROM unnest($1::text[], $2::text[], $3::text[]) AS p(np, pn, pe)
),
liq AS (
  SELECT * FROM ${LIQ}
  WHERE periodo_para_nomina = ANY($4::text[]) AND numero_de_personal IN (SELECT np FROM pedidos)
)`;

// ---------------------------------------------------------------- resumen para la vista previa

export interface ResumenLiquidacion {
  np: string;
  pn: string;
  pe: string;
  national_id: string | null;
  nombre_centro_costo: string | null;
  liquido: string | null;
}

/** RUT, nombre del CC y líquido a pagar (posición 800) de cada liquidación, para la vista previa. */
export async function resumirLiquidaciones(pedidos: ClaveLiquidacion[]): Promise<Map<string, ResumenLiquidacion>> {
  if (!pedidos.length) return new Map();
  const rows = await consultaEnLote<ResumenLiquidacion>(
    `WITH ${PEDIDOS}
     SELECT p.np, p.pn, p.pe,
       MAX(m.national_id) AS national_id,
       MAX(m.nombre_centro_costo) AS nombre_centro_costo,
       SUM(CASE WHEN t.posicion = 800 THEN l.importe::integer END)::text AS liquido
     FROM pedidos p
     JOIN liq l
       ON l.numero_de_personal = p.np AND l.periodo_para_nomina = p.pn AND REPLACE(l.marca, '-', '') = p.pe
     JOIN flesan_rrhh.sap_tabla_paso_liquidaciones t ON t.cc_nimina_sap = l.cc_nomina
     LEFT JOIN flesan_rrhh.sap_maestro_colaborador m
       ON m.user_id = l.numero_de_personal::integer AND m.empresa = l.sociedad
     WHERE t.tipo IS NOT NULL AND l.tipo_calculo_nomina_perpara <> 'A'
     GROUP BY 1, 2, 3`,
    arreglos(pedidos),
  );
  return new Map(rows.map((r) => [`${r.np}|${r.pn}|${r.pe}`, r]));
}

/** Las filas de la vista previa: una por liquidación (el original repetía la de quien aparecía con dos
 * sociedades) y cada reliquidación en una sola, la normal con el líquido de su fuera de ciclo sumado. */
export function filasVista(listado: FilaListado[], resumen: Map<string, ResumenLiquidacion>): FilaVista[] {
  const unicas = unaPorClave(listado);
  const pares = reliquidaciones(unicas);
  const sumadas = new Set([...pares.values()].map(claveDe));
  const liquido = (clave: string) => {
    const v = resumen.get(clave)?.liquido;
    return v == null ? null : Number(v);
  };
  return unicas
    .filter((l) => !sumadas.has(claveDe(l)))
    .map((l) => {
      const clave = claveDe(l);
      const r = resumen.get(clave);
      const fueraDeCiclo = pares.get(clave);
      const propio = liquido(clave);
      return {
        clave,
        nombre: l.apellido_nombre,
        numero_de_personal: l.numero_de_personal,
        rut: r?.national_id ?? null,
        sociedad: l.sociedad,
        centro_costo: l.centro_costo,
        nombre_cc: r?.nombre_centro_costo ?? null,
        periodo_para_nomina: l.periodo_para_nomina,
        periodo_efectivo: l.periodo_efectivo,
        tipo: fueraDeCiclo ? "reliquidacion" : "normal",
        liquido: fueraDeCiclo && propio !== null ? propio + (liquido(claveDe(fueraDeCiclo)) ?? 0) : propio,
      };
    });
}

/**
 * Lo que va al PDF de las claves pedidas, entre las que el usuario puede ver: `elegidas` (una por
 * clave; la de una fuera de ciclo que se suma cuenta como la de su normal) y `pedidos`, lo que hay que
 * detallar: las elegidas y, tras cada reliquidación, su fuera de ciclo, que sumarReliquidaciones()
 * junta en la misma página.
 */
export function elegirParaPdf(permitidas: FilaListado[], pedidas: Set<string>) {
  const unicas = unaPorClave(permitidas);
  const pares = reliquidaciones(unicas);
  const normalDe = new Map([...pares].map(([normal, fueraDeCiclo]) => [claveDe(fueraDeCiclo), normal]));
  const pedidasNormales = new Set([...pedidas].map((c) => normalDe.get(c) ?? c));
  const elegidas = unicas.filter((l) => pedidasNormales.has(claveDe(l)) && !normalDe.has(claveDe(l)));
  const pedidos = elegidas.flatMap((l) => {
    const fueraDeCiclo = pares.get(claveDe(l));
    return fueraDeCiclo ? [l, fueraDeCiclo] : [l];
  });
  return { elegidas, pedidos };
}

// ---------------------------------------------------------------- detalle (query del PDF)

export interface ConceptoLiquidacion {
  /** CC-nómina de SAP: el PDF ordena los conceptos de cada sección por este código, como SAP. */
  codigo: string;
  tipo: string;
  /** El texto del concepto en SAP; si no trae, el de la tabla de paso. */
  descripcion: string;
  posicion: number;
  /** Texto tal como lo devuelve Postgres (el original imprimía el valor sin formatear). */
  cantidad: string | null;
  importe: string | null;
}

export interface LiquidacionDetalle extends ClaveLiquidacion {
  nombre_completo: string | null;
  anio: string;
  mes: string | null;
  rut: string | null;
  digito: string | null;
  nombre_cargo: string | null;
  /** DD-MM-AAAA */
  fecha_ingreso: string | null;
  razon_social: string | null;
  rut_sociedad: string | null;
  /** Texto de la división de personal en SAP («Metropolitana de Santiago»). */
  ubicacion: string | null;
  /** Nombre del CC en SAP (corto, 20 letras). */
  nombre_cc: string | null;
  /** Total imponible (/314) y renta afecta a impuesto (/T23) de SAP. */
  total_imponible: number | null;
  renta_afecta: number | null;
  /** AFP y salud vigentes en el mes («AFP: Modelo», «FONASA»). */
  afp: string | null;
  salud: string | null;
  conceptos: ConceptoLiquidacion[];
}

type Encabezado = Omit<LiquidacionDetalle, keyof ClaveLiquidacion | "conceptos">;

interface FilaDetalle extends ClaveLiquidacion, ConceptoLiquidacion {
  /** Solo en la primera fila de cada liquidación (el original tomaba el encabezado de $datos[0]). */
  encabezado: Encabezado | null;
}

/**
 * Conceptos de cada liquidación pedida, con los datos del encabezado. Es la consulta por persona
 * de liquidaciones_pdf_new.php hecha para todas a la vez: el cargo es el vigente antes del inicio
 * del periodo (historial de eventos) y se excluye el tipo de cálculo A. Desde el formato de SAP
 * (2026-10-21) trae además el texto y el código SAP de cada concepto, los totales del encabezado, la
 * ubicación, el CC como lo nombra SAP y la AFP y la salud del mes. Devuelve las liquidaciones en el
 * orden pedido; las que no tienen conceptos no vienen (el original las saltaba).
 */
export async function detallarLiquidaciones(pedidos: ClaveLiquidacion[]): Promise<LiquidacionDetalle[]> {
  if (!pedidos.length) return [];
  const rows = await consultaEnLote<FilaDetalle>(
    `WITH ${PEDIDOS},
     -- CTE «base» del original, para todas las personas en una pasada: por cada cargo, el mes en
     -- que empezó (antes del inicio del periodo); gana el que empezó más tarde.
     cambios AS (
       SELECT q.np, q.pe, h.jobcode,
         to_char(MIN((to_timestamp(h.startdate::double precision / 1000.0) AT TIME ZONE 'UTC')::date), 'YYYYMM') AS cambio_fecha
       FROM (SELECT DISTINCT np, pe FROM pedidos) q
       JOIN flesan_rrhh.sap_maestro_historial_eventos h
         ON h.userid = q.np
        AND h.startdate::numeric < (EXTRACT(EPOCH FROM to_timestamp(q.pe, 'YYYYMM') AT TIME ZONE 'UTC') * 1000)
       GROUP BY q.np, q.pe, h.jobcode
     ),
     base AS (
       SELECT DISTINCT ON (np, pe) np, pe, jobcode FROM cambios ORDER BY np, pe, cambio_fecha DESC
     ),
     -- Del encabezado de SAP, en las mismas filas de la liquidación: total imponible (/314), renta
     -- afecta a impuesto (/T23), la división de personal (la «Ubicación») y el nombre corto del CC.
     sap AS (
       SELECT p.np, p.pn, p.pe,
         SUM(CASE WHEN l.cc_nomina = '/314' THEN l.importe::numeric END) AS total_imponible,
         SUM(CASE WHEN l.cc_nomina = '/T23' THEN l.importe::numeric END) AS renta_afecta,
         MAX(l.texto_division_de_personal) AS ubicacion,
         MAX(l.denominacion) AS nombre_cc
       FROM pedidos p
       JOIN liq l
         ON l.numero_de_personal = p.np AND l.periodo_para_nomina = p.pn AND REPLACE(l.marca, '-', '') = p.pe
       WHERE l.tipo_calculo_nomina_perpara <> 'A'
       GROUP BY p.np, p.pn, p.pe
     ),
     -- AFP (plan 0001) y salud (0002) del mes: la de fecha_desde más reciente hasta el último día del
     -- mes. Si todas empiezan después, la más antigua: la tabla trae lo vigente al cargarla, y casi
     -- todas las AFP parten el 01-08-2026 (sin esto, ningún mes anterior tendría AFP).
     prevision AS (
       SELECT DISTINCT ON (q.np, q.pe, x.plan) q.np, q.pe, x.plan, x.institucion
       FROM (SELECT DISTINCT np, pe, (to_date(pe, 'YYYYMM') + interval '1 month')::date AS fin FROM pedidos) q
       JOIN flesan_rrhh.xls_prevision_colaborador_g2 x ON ltrim(x.np, '0') = ltrim(q.np, '0') AND x.plan IN ('0001', '0002')
       ORDER BY q.np, q.pe, x.plan,
         (x.fecha_desde < q.fin) DESC NULLS LAST,
         CASE WHEN x.fecha_desde < q.fin THEN x.fecha_desde END DESC NULLS LAST,
         x.fecha_desde, x.modificado_el DESC NULLS LAST, x.version DESC NULLS LAST
     )
     -- El encabezado se repite en cada concepto: viaja solo en la primera fila de cada liquidación.
     SELECT d.numero_de_personal, d.periodo_para_nomina, d.periodo_efectivo, d.codigo, d.tipo, d.descripcion, d.posicion,
       d.cantidad, d.importe,
       CASE WHEN row_number() OVER (PARTITION BY d.numero_de_personal, d.periodo_para_nomina, d.periodo_efectivo ORDER BY d.posicion, d.descripcion) = 1
         THEN json_build_object(
           'nombre_completo', d.nombre_completo, 'anio', d.anio, 'mes', d.mes, 'rut', d.rut, 'digito', d.digito,
           'nombre_cargo', d.nombre_cargo, 'fecha_ingreso', d.fecha_ingreso, 'razon_social', d.razon_social,
           'rut_sociedad', d.rut_sociedad, 'ubicacion', s.ubicacion, 'nombre_cc', s.nombre_cc,
           'total_imponible', s.total_imponible, 'renta_afecta', s.renta_afecta, 'afp', afp.institucion,
           'salud', salud.institucion)
       END AS encabezado
     FROM (
     SELECT p.np AS numero_de_personal, p.pn AS periodo_para_nomina, p.pe AS periodo_efectivo,
       (m.first_name || ' ' || m.last_name) AS nombre_completo,
       SUBSTRING(p.pe FROM 1 FOR 4) AS anio,
       CASE SUBSTRING(p.pe FROM 5 FOR 2)
         WHEN '01' THEN 'Enero' WHEN '02' THEN 'Febrero' WHEN '03' THEN 'Marzo' WHEN '04' THEN 'Abril'
         WHEN '05' THEN 'Mayo' WHEN '06' THEN 'Junio' WHEN '07' THEN 'Julio' WHEN '08' THEN 'Agosto'
         WHEN '09' THEN 'Septiembre' WHEN '10' THEN 'Octubre' WHEN '11' THEN 'Noviembre' WHEN '12' THEN 'Diciembre'
       END AS mes,
       CASE
         WHEN m.national_id !~ '^[0-9]{8}' THEN NULL
         WHEN SUBSTRING(m.national_id, 1, 1) = '0' THEN SUBSTRING(m.national_id, 2, 7)::integer
         ELSE SUBSTRING(m.national_id, 1, 8)::integer
       END::text AS rut,
       SUBSTRING(m.national_id, 10, 1) AS digito,
       c.nombre_cargo,
       SUM(REPLACE(l.cantidad, ',', '.')::double precision)::text AS cantidad,
       SUM(l.importe::integer)::text AS importe,
       to_char(
         CASE
           WHEN LENGTH(m.fecha_ingreso) = 12
             THEN CAST(to_timestamp(SUBSTRING(m.fecha_ingreso, 1, 9)::bigint) + CAST('1 days' AS INTERVAL) AS DATE)
           ELSE CAST(to_timestamp(SUBSTRING(m.fecha_ingreso, 1, 10)::bigint) + CAST('1 days' AS INTERVAL) AS DATE)
         END, 'DD-MM-YYYY') AS fecha_ingreso,
       r.razon_social,
       r.rut AS rut_sociedad,
       t.cc_nimina_sap AS codigo, t.tipo, COALESCE(NULLIF(MAX(l.texto_explcc_nomina), ''), t.descripcion) AS descripcion, t.posicion
     FROM pedidos p
     JOIN liq l
       ON l.numero_de_personal = p.np AND l.periodo_para_nomina = p.pn AND REPLACE(l.marca, '-', '') = p.pe
     LEFT JOIN flesan_rrhh.sap_maestro_colaborador m
       ON m.user_id = l.numero_de_personal::integer AND m.empresa = l.sociedad
     LEFT JOIN base ON base.np = p.np AND base.pe = p.pe
     LEFT JOIN flesan_rrhh.sap_maestro_cargos c ON c.external_code = base.jobcode
     LEFT JOIN public.maestro_rut r ON r.id_sap = m.empresa
     LEFT JOIN flesan_rrhh.sap_tabla_paso_liquidaciones t ON t.cc_nimina_sap = l.cc_nomina
     WHERE t.tipo IS NOT NULL AND l.tipo_calculo_nomina_perpara <> 'A'
     GROUP BY p.np, p.pn, p.pe, nombre_completo, m.national_id, c.nombre_cargo,
       m.fecha_ingreso, r.razon_social, r.rut, t.cc_nimina_sap, t.tipo, t.descripcion, t.posicion
     ) d
     LEFT JOIN sap s ON s.np = d.numero_de_personal AND s.pn = d.periodo_para_nomina AND s.pe = d.periodo_efectivo
     LEFT JOIN prevision afp ON afp.np = d.numero_de_personal AND afp.pe = d.periodo_efectivo AND afp.plan = '0001'
     LEFT JOIN prevision salud ON salud.np = d.numero_de_personal AND salud.pe = d.periodo_efectivo AND salud.plan = '0002'
     ORDER BY d.numero_de_personal, d.periodo_para_nomina, d.periodo_efectivo, d.posicion, d.descripcion`,
    arreglos(pedidos),
  );

  const porClave = new Map<string, LiquidacionDetalle>();
  for (const { codigo, tipo, descripcion, posicion, cantidad, importe, encabezado, ...clave } of rows) {
    let liquidacion = porClave.get(claveDe(clave));
    if (!liquidacion) {
      if (!encabezado) continue;
      liquidacion = { ...clave, ...encabezado, conceptos: [] };
      porClave.set(claveDe(clave), liquidacion);
    }
    liquidacion.conceptos.push({ codigo, tipo: String(tipo).trim(), descripcion, posicion: Number(posicion), cantidad, importe });
  }
  const vistos = new Set<string>();
  const ordenadas: LiquidacionDetalle[] = [];
  for (const p of pedidos) {
    const clave = claveDe(p);
    const l = porClave.get(clave);
    if (l && !vistos.has(clave)) {
      vistos.add(clave);
      ordenadas.push(l);
    }
  }
  return ordenadas;
}

/**
 * Suma cada reliquidación en una sola página: a la liquidación normal se le agrega el total a pagar de
 * su fuera de ciclo (la misma regla que reliquidaciones(), aquí con los conceptos), y la fuera de ciclo
 * no sale aparte. El PDF muestra el detalle de la normal y como total la suma de las posiciones 800,
 * que así cuadra con el detalle. La misma sociedad se compara por su RUT.
 */
export function sumarReliquidaciones(detalles: LiquidacionDetalle[]): LiquidacionDetalle[] {
  const personaMes = (d: LiquidacionDetalle) => `${d.numero_de_personal}|${d.periodo_efectivo}|${d.rut_sociedad ?? ""}`;
  const sumables = new Map(
    detalles.filter((d) => esFueraDeCiclo(d) && d.conceptos.length && d.conceptos.every((c) => c.posicion === 800)).map((d) => [personaMes(d), d]),
  );
  const sumadas = new Set<LiquidacionDetalle>();
  const resultado = detalles.map((d) => {
    const fueraDeCiclo = esFueraDeCiclo(d) ? undefined : sumables.get(personaMes(d));
    if (!fueraDeCiclo) return d;
    sumadas.add(fueraDeCiclo);
    return { ...d, conceptos: [...d.conceptos, ...fueraDeCiclo.conceptos] };
  });
  return resultado.filter((d) => !sumadas.has(d));
}

// ---------------------------------------------------------------- correos (envío mensual)

export interface ContactoColaborador {
  numero_de_personal: string;
  sociedad: string;
  first_name: string | null;
  correo_flesan: string | null;
  correo_gmail: string | null;
}

/** Correos del maestro para cada persona (número de personal + sociedad). */
export async function contactosColaboradores(personas: { numero_de_personal: string; sociedad: string }[]) {
  if (!personas.length) return new Map<string, ContactoColaborador>();
  const { rows } = await pool.query<ContactoColaborador>(
    `SELECT p.np AS numero_de_personal, p.soc AS sociedad, m.first_name, m.correo_flesan, m.correo_gmail
     FROM unnest($1::text[], $2::text[]) AS p(np, soc)
     LEFT JOIN flesan_rrhh.sap_maestro_colaborador m ON m.user_id = p.np::integer AND m.empresa = p.soc`,
    [personas.map((p) => p.numero_de_personal), personas.map((p) => p.sociedad)],
  );
  return new Map(rows.map((r) => [`${r.numero_de_personal}|${r.sociedad}`, r]));
}
