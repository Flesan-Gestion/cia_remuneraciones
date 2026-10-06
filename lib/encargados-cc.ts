import { poolPlataforma, tablaPlataforma } from "@/lib/configuracion-db";

/**
 * Copia de flesan_rrhh.tabla_encargados_cc en el esquema propio (db/006_encargados_cc.sql): quién
 * es encargado, visitador, administrativo o GGO de cada centro de costo, y las marcas ver_planta y
 * administrador. Las consultas de Liquidaciones y de los libros son las mismas de los aplicativos
 * antiguos; solo cambia que, en vez de la tabla de la base transaccional, cruzan con esta copia,
 * que viaja a la consulta como un WITH (`conEncargados`). Así se ve exactamente lo mismo que en el
 * PHP y se administra desde la plataforma. Solo runtime Node.
 */
const TABLA = tablaPlataforma("encargados_cc");

export const COLUMNAS_ENCARGADOS = [
  "llave",
  "sociedad",
  "centro_coto",
  "administrativo",
  "correo",
  "ver_planta",
  "administrador",
  "correo_administrador",
  "visitador",
  "correo_visitador",
  "gerente",
  "correo_gerente",
  "correo_ggo",
  "division",
] as const;

type Columna = (typeof COLUMNAS_ENCARGADOS)[number];
export type FilaEncargados = Record<Columna, string | null> & { id: number };

declare global {
  var _encargadosCc: { filas: FilaEncargados[]; en: number } | undefined;
}

/** Se relee cada minuto (y al instante tras editar desde la plataforma). */
const VIGENCIA = 60_000;
let avisadoSinTabla = false;

function esTablaInexistente(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "42P01";
}

/**
 * Todas las filas de la copia, en su orden original. null = sin base o sin db/006 aplicado: las
 * consultas cruzan entonces con una tabla vacía (nadie es encargado de nada; ante la duda, nada).
 */
export async function leerEncargados(): Promise<FilaEncargados[] | null> {
  const cache = globalThis._encargadosCc;
  if (cache && Date.now() - cache.en < VIGENCIA) return cache.filas;
  if (!poolPlataforma || !TABLA) return null;
  try {
    const { rows } = await poolPlataforma.query<FilaEncargados>(`SELECT id, ${COLUMNAS_ENCARGADOS.join(", ")} FROM ${TABLA} ORDER BY id`);
    globalThis._encargadosCc = { filas: rows, en: Date.now() };
    return rows;
  } catch (error) {
    if (esTablaInexistente(error)) {
      if (!avisadoSinTabla) console.warn("Encargados de CC sin base: falta aplicar db/006_encargados_cc.sql.");
      avisadoSinTabla = true;
      return null;
    }
    throw error;
  }
}

/**
 * Hace que una consulta escrita contra flesan_rrhh.tabla_encargados_cc cruce con la copia: agrega
 * las columnas como parámetros (arreglos) y antepone un WITH «encargados_cc» con las mismas
 * columnas y tipos. El resto del SQL no cambia.
 */
export function conEncargados(sql: string, params: unknown[], filas: FilaEncargados[] | null): string {
  const lista = filas ?? [];
  const desde = params.length + 1;
  for (const c of COLUMNAS_ENCARGADOS) params.push(lista.map((f) => f[c]));
  const cte = `encargados_cc AS (
  SELECT * FROM unnest(${COLUMNAS_ENCARGADOS.map((_, i) => `$${desde + i}::varchar[]`).join(", ")})
    AS x(${COLUMNAS_ENCARGADOS.join(", ")})
)`;
  const cuerpo = sql.replaceAll("flesan_rrhh.tabla_encargados_cc", "encargados_cc");
  const conWith = cuerpo.trimStart();
  return /^WITH\s/i.test(conWith) ? `WITH ${cte},\n${conWith.slice(5)}` : `WITH ${cte}\n${conWith}`;
}

// ---------------------------------------------------------------- administración

/** Centro de costo de la copia, como lo elegía «Configurar Centros de Costos» (sociedad + centro_coto). */
export interface CentroEncargados {
  sociedad: string;
  centroCoto: string;
}

export type Funcion = "encargado" | "visitador" | "ggo";

const COLUMNA_DE: Record<Exclude<Funcion, "ggo">, "correo" | "visitador"> = { encargado: "correo", visitador: "visitador" };

/**
 * Asigna o quita a una persona en un centro, como insertColaborador() del PHP (libro_rem_g2):
 * encargado → columna correo, visitador → columna visitador (reemplaza al anterior), GGO → se
 * agrega a la lista correo_ggo (separada por comas). Toca todas las filas con esa sociedad y
 * centro_coto, igual que el UPDATE del original. Quitar deja la columna en NULL (o saca el correo
 * de la lista de GGO).
 */
export async function cambiarFuncion(params: {
  centro: CentroEncargados;
  funcion: Funcion;
  correo: string;
  asignar: boolean;
  por: string;
}): Promise<number> {
  if (!poolPlataforma || !TABLA) throw new Error("La plataforma no tiene base propia configurada.");
  const { centro, funcion, correo, asignar, por } = params;
  const donde = `sociedad = $1 AND centro_coto = $2`;
  let resultado;
  if (funcion === "ggo") {
    // Al quitar se rearma la lista sin ese correo (sin importar mayúsculas ni espacios); si queda
    // vacía, NULL. Al agregar, igual que el PHP: lo anterior + «,» + el correo.
    resultado = asignar
      ? await poolPlataforma.query(
          `UPDATE ${TABLA} SET correo_ggo = CASE WHEN correo_ggo IS NULL OR correo_ggo = '' THEN $3 ELSE correo_ggo || ',' || $3 END,
             actualizado_por = $4, updated_at = now()
           WHERE ${donde} AND NOT (lower($3) = ANY(string_to_array(lower(replace(COALESCE(correo_ggo, ''), ' ', '')), ',')))`,
          [centro.sociedad, centro.centroCoto, correo, por],
        )
      : await poolPlataforma.query(
          `UPDATE ${TABLA} SET correo_ggo = NULLIF(array_to_string(ARRAY(
               SELECT x FROM unnest(string_to_array(correo_ggo, ',')) AS x WHERE lower(trim(x)) <> lower($3)
             ), ','), ''),
             actualizado_por = $4, updated_at = now()
           WHERE ${donde} AND lower($3) = ANY(string_to_array(lower(replace(COALESCE(correo_ggo, ''), ' ', '')), ','))`,
          [centro.sociedad, centro.centroCoto, correo, por],
        );
  } else {
    const col = COLUMNA_DE[funcion];
    resultado = asignar
      ? await poolPlataforma.query(`UPDATE ${TABLA} SET ${col} = $3, actualizado_por = $4, updated_at = now() WHERE ${donde}`, [
          centro.sociedad,
          centro.centroCoto,
          correo,
          por,
        ])
      : await poolPlataforma.query(
          `UPDATE ${TABLA} SET ${col} = NULL, actualizado_por = $4, updated_at = now() WHERE ${donde} AND lower(trim(${col})) = lower($3)`,
          [centro.sociedad, centro.centroCoto, correo, por],
        );
  }
  globalThis._encargadosCc = undefined;
  return resultado.rowCount ?? 0;
}

/** Funciones de un correo en cada centro, con la misma comparación que usan las consultas. */
export function funcionesDe(filas: FilaEncargados[], correo: string) {
  const c = correo.trim().toLowerCase();
  const porCentro = new Map<string, { sociedad: string; centroCoto: string; funciones: Set<Funcion>; verPlanta: boolean; administrador: boolean }>();
  for (const f of filas) {
    const funciones: Funcion[] = [];
    if ((f.correo ?? "").trim().toLowerCase() === c) funciones.push("encargado");
    if ((f.visitador ?? "").trim().toLowerCase() === c) funciones.push("visitador");
    if ((f.correo_ggo ?? "").split(",").some((g) => g.trim().toLowerCase() === c)) funciones.push("ggo");
    if (!funciones.length || !f.sociedad || !f.centro_coto) continue;
    const clave = `${f.sociedad}|${f.centro_coto}`;
    const actual = porCentro.get(clave) ?? {
      sociedad: f.sociedad,
      centroCoto: f.centro_coto,
      funciones: new Set<Funcion>(),
      verPlanta: Boolean((f.ver_planta ?? "").trim()),
      administrador: Boolean((f.administrador ?? "").trim()),
    };
    for (const x of funciones) actual.funciones.add(x);
    porCentro.set(clave, actual);
  }
  return [...porCentro.values()].map((x) => ({ ...x, funciones: [...x.funciones] }));
}
