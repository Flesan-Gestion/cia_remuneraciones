/**
 * Tipo de rol compartido entre server (auth.ts, route handlers) y client components
 * (sidebar/topbar). Si la plataforma necesita más de 2 roles o roles persistidos en
 * BBDD (no solo por email vía env CIA_ADMIN_EMAILS), extiende esta unión y el
 * callback `session` en auth.ts — ver docs/ARQUITECTURA.md.
 */
export type Rol = "admin" | "member";

export function esAdmin(role?: Rol | null): boolean {
  return role === "admin";
}

export function etiquetaRol(role?: Rol | null): string {
  return role === "admin" ? "Administrador" : "Miembro";
}
