import NextAuth, { type DefaultSession } from "next-auth";

import { authConfig } from "./auth.config";
import { estaRegistrado, resolverRol as resolverRolPersistido } from "@/lib/usuarios-db";
import type { Rol } from "@/lib/roles";

/**
 * Runtime Node (no edge). Aquí va el rol.
 *
 * - CIA_ADMIN_EMAILS: bootstrap de administrador fijo por env — nunca editable
 *   desde la UI de /configuracion.
 * - Si además hay DATABASE_URL configurado, el resto de los correos puede tener
 *   rol persistido en BBDD (tabla en lib/usuarios-db.ts, gestionable desde
 *   /configuracion/usuarios — ver db/001_usuarios_roles.sql). Sin DATABASE_URL,
 *   todo lo que no esté en CIA_ADMIN_EMAILS queda como "member". Ver
 *   docs/ARQUITECTURA.md.
 *
 * El rol se resuelve en el callback `session` (no `jwt`) para que un cambio de rol
 * hecho desde /configuracion tenga efecto de inmediato, sin esperar a que la
 * persona vuelva a loguearse.
 */
const CIA_ADMINS = (process.env.CIA_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

declare module "next-auth" {
  interface Session {
    user: {
      role: Rol;
    } & DefaultSession["user"];
  }
}

async function resolverRol(email: string): Promise<Rol> {
  if (CIA_ADMINS.includes(email)) return "admin";
  const { rol } = await resolverRolPersistido(email);
  return rol;
}

const { handlers, signIn, signOut, auth: authOriginal } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /** Solo entra quien es de un dominio permitido (auth.config.ts) y está en «Usuarios y roles»
     * (o en CIA_ADMIN_EMAILS). Si no, Auth.js vuelve a /login con error=AccessDenied. */
    async signIn(params) {
      if (!authConfig.callbacks.signIn(params)) return false;
      const email = params.profile?.email?.toLowerCase() ?? "";
      return CIA_ADMINS.includes(email) || (await estaRegistrado(email));
    },
    async session({ session, token }) {
      if (session.user) {
        const email = String(token.email ?? session.user.email ?? "").toLowerCase();
        session.user.role = email ? await resolverRol(email) : "member";
      }
      return session;
    },
  },
});

/**
 * Bypass de login SOLO para desarrollo/pruebas en VM local — nunca en producción
 * (el `&& NODE_ENV !== "production"` protege aunque el .env de la VM traiga
 * AUTH_DISABLED=true por error). Con AUTH_DISABLED=true, `auth()` devuelve una
 * sesión falsa en vez de consultar Google: se navega el dashboard completo
 * —incluidas las secciones adminOnly— sin pasar por el login. Rol configurable
 * con DEV_ROLE=admin|member (default admin). middleware.ts tiene el bypass
 * equivalente para no redirigir a /login.
 */
const AUTH_DISABLED = process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";

const FAKE_SESSION = {
  user: {
    name: "Usuario de prueba",
    // DEV_EMAIL permite probar cómo ve la plataforma una persona concreta (perfil RR.HH., jefatura…).
    email: process.env.DEV_EMAIL ?? "dev@flesan.cl",
    image: null,
    role: (process.env.DEV_ROLE === "member" ? "member" : "admin") as "admin" | "member",
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export async function auth() {
  if (AUTH_DISABLED) return FAKE_SESSION;
  return authOriginal();
}

export { handlers, signIn, signOut };
