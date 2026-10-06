import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "@/lib/db";

/** Runtime Node únicamente — nunca importar desde un client component. Solo aplica si
 * esta plataforma activa roles persistidos en BBDD (ver docs/ARQUITECTURA.md). */

export interface Colaborador {
  nombre: string;
  correo: string;
  rut: string;
  cargo: string | null;
  empresa: string | null;
  departamento: string | null;
}

interface FilaMaestroColaborador {
  nombre_sap: string;
  rut: string;
  correo_flesan: string | null;
  nombre_cargo: string | null;
  empresa: string | null;
  nombre_departamento: string | null;
}

// El SQL vive en el repo (maestro_colaborador.sql, raíz) en vez de embebido en código:
// actualizar la consulta de RR.HH. es editar ese archivo, no tocar TypeScript.
let sqlCache: string | null = null;
async function leerSql(): Promise<string> {
  if (!sqlCache) {
    sqlCache = await readFile(path.join(process.cwd(), "maestro_colaborador.sql"), "utf-8");
  }
  return sqlCache;
}

/** Placeholder que usa SAP cuando a un colaborador le falta correo corporativo. */
const SIN_CORREO = "sincorreo@flesan.cl";

/** Lista de colaboradores activos para el buscador de /configuracion/usuarios. Dedupe
 * por correo (en minúsculas, que es la clave que usa la tabla de roles en lib/usuarios-db.ts). */
export async function listarColaboradores(): Promise<Colaborador[]> {
  const sql = await leerSql();
  const { rows } = await pool.query<FilaMaestroColaborador>(sql);

  const porCorreo = new Map<string, Colaborador>();
  for (const r of rows) {
    const correo = r.correo_flesan?.trim().toLowerCase();
    if (!correo || correo === SIN_CORREO) continue;
    if (porCorreo.has(correo)) continue;
    porCorreo.set(correo, {
      nombre: r.nombre_sap,
      correo,
      rut: r.rut,
      cargo: r.nombre_cargo,
      empresa: r.empresa,
      departamento: r.nombre_departamento,
    });
  }
  return [...porCorreo.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
