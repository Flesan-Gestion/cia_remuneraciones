import { createHash } from "node:crypto";
import { poolPlataforma, tablaPlataforma } from "@/lib/configuracion-db";
import type { Rol } from "@/lib/roles";
import type { Acceso } from "@/lib/liquidaciones/tipos";

/**
 * Acceso por token de servicio (Authorization: Bearer) a la API de liquidaciones, para un externo
 * sin sesión (db/011_tokens_servicio.sql, scripts/token-servicio.mjs). El token ve todo: perfil
 * rrhh sin empresas fijas. Token inexistente, vencido o revocado = null. Solo runtime Node.
 */
const TABLA = tablaPlataforma("tokens_servicio");

export async function sesionServicio(request: Request): Promise<{ email: string; role: Rol; acceso: Acceso } | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!m || !poolPlataforma || !TABLA) return null;
  const hash = createHash("sha256").update(m[1]).digest("hex");
  try {
    const { rows } = await poolPlataforma.query<{ nombre: string }>(
      `SELECT nombre FROM ${TABLA} WHERE hash_token = $1 AND revocado_en IS NULL AND expira_en > now()`,
      [hash],
    );
    if (!rows[0]) return null;
    const email = `servicio:${rows[0].nombre}`;
    return { email, role: "member", acceso: { correo: email, perfil: "rrhh", empresas: null } };
  } catch (error) {
    console.error("Error al validar el token de servicio:", error);
    return null;
  }
}
