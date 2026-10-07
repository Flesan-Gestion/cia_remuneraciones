import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Config EDGE-SAFE de Auth.js (la importa middleware.ts): nada de Prisma/pg ni
 * dependencias de Node aquí. Los callbacks que necesiten BBDD van en auth.ts.
 * Fuente: servicios-compartidos/login-estandar/nextjs — plantilla compartida
 * de login CIA (Google Workspace) para todas las plataformas internas.
 */
export const DOMINIOS_PERMITIDOS = (process.env.CIA_ALLOWED_DOMAINS ?? "flesan.cl")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const authConfig = {
  // Servido por IP/host interno (no Vercel): confiar en el Host.
  trustHost: true,
  providers: [
    Google({
      authorization: {
        params: {
          // Con un solo dominio, «hd» deja solo ese Workspace en el selector; con varios no se usa
          // (dejaría fuera a los demás). El callback signIn igual valida dominio y usuario.
          ...(DOMINIOS_PERMITIDOS.length === 1 ? { hd: DOMINIOS_PERMITIDOS[0] } : {}),
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    /** Bloquea cualquier login que no sea de un dominio permitido. */
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      const domain = email.split("@")[1] ?? "";
      return DOMINIOS_PERMITIDOS.includes(domain);
    },
    /** Middleware: sin sesión → redirige a /login (conserva callbackUrl). */
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
