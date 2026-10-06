import { NextResponse } from "next/server";
import { asignarUsuario, listarUsuariosAsignados } from "@/lib/usuarios-db";
import { esAdmin, type Rol } from "@/lib/roles";
import { respuestaNoAutorizado, sesionConRol } from "@/lib/auth-guard";
import { registrarActividad } from "@/lib/actividad-db";
import { listarEmpresas } from "@/lib/liquidaciones/consultas";
import { funcionesDe, leerEncargados } from "@/lib/encargados-cc";
import type { Perfil } from "@/lib/liquidaciones/tipos";
import { ROLES_LIBRO, type RolLibro } from "@/lib/libro/tipos";

const ROLES_ASIGNABLES = new Set<Rol>(["admin", "member"]);
const PERFILES = new Set<Perfil>(["rrhh", "jefatura", "sin_acceso"]);
const ROLES_REMUNERACIONES = new Set<RolLibro>(ROLES_LIBRO.map((r) => r.valor));

/** Administradores fijos por CIA_ADMIN_EMAILS (no se editan desde la plataforma). */
function adminsFijos() {
  return (process.env.CIA_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET() {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();

  try {
    const [{ usuarios, libros }, empresas, encargados] = await Promise.all([
      listarUsuariosAsignados(),
      listarEmpresas({ correo: sesion.email, perfil: "rrhh", empresas: null }).catch(() => []),
      leerEncargados(),
    ]);
    return NextResponse.json({
      usuarios,
      // false mientras no esté aplicado db/005_remuneraciones.sql: la columna de libros no se edita.
      libros,
      adminsFijos: adminsFijos(),
      empresas: empresas.map((e) => ({ codigo: e.codigo, nombre: e.nombre })),
      // En cuántos centros es encargado o visitador (los que ve) y GGO cada usuario; null mientras no
      // esté aplicado db/006_encargados_cc.sql.
      centros:
        encargados &&
        Object.fromEntries(
          usuarios.map((u) => {
            const fs = funcionesDe(encargados, u.correo);
            return [
              u.correo,
              {
                centros: fs.filter((f) => f.funciones.includes("encargado") || f.funciones.includes("visitador")).length,
                ggo: fs.filter((f) => f.funciones.includes("ggo")).length,
              },
            ];
          }),
        ),
    });
  } catch (error) {
    console.error("Error al leer usuarios:", error);
    return NextResponse.json({ error: "Error al leer la base de datos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sesion = await sesionConRol();
  if (!sesion || !esAdmin(sesion.role)) return respuestaNoAutorizado();

  let body: { correo?: string; nombre?: string; rol?: string; perfil?: string; empresas?: unknown; rolRemuneraciones?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const correo = (body.correo ?? "").trim().toLowerCase();
  const nombre = (body.nombre ?? "").trim();
  const rol = body.rol as Rol;
  const perfil = body.perfil as Perfil;
  const empresas = Array.isArray(body.empresas)
    ? body.empresas.filter((e): e is string => typeof e === "string" && /^[A-Za-z0-9_-]{1,20}$/.test(e))
    : [];
  // Sin el campo, el rol de libros no se toca (pantalla sin db/005 aplicado).
  const conLibros = "rolRemuneraciones" in body;
  const rolRemuneraciones = body.rolRemuneraciones === null ? null : (body.rolRemuneraciones as RolLibro);

  if (!correo || !ROLES_ASIGNABLES.has(rol) || !PERFILES.has(perfil) || (conLibros && rolRemuneraciones !== null && !ROLES_REMUNERACIONES.has(rolRemuneraciones))) {
    return NextResponse.json({ error: "Correo, rol o perfil inválidos." }, { status: 400 });
  }

  try {
    await asignarUsuario({
      correo,
      nombre: nombre || null,
      rol,
      perfil,
      empresas: perfil === "jefatura" && empresas.length ? empresas : null,
      ...(conLibros ? { rolRemuneraciones } : {}),
    });
    await registrarActividad({
      correo: sesion.email,
      accion: "Cambió acceso",
      entidad: "Usuario",
      entidadId: correo,
      detalle: { rol, perfil, empresas, ...(conLibros ? { rol_remuneraciones: rolRemuneraciones } : {}) },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al guardar usuario:", error);
    return NextResponse.json({ error: "Error al guardar en la base de datos." }, { status: 500 });
  }
}
