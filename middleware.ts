import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

/**
 * Instancia propia (no importa "@/auth"): el middleware corre en runtime Edge, que no
 * soporta `pg` u otros drivers de Node. La resolución de rol con BBDD (si la plataforma
 * la necesita) vive en auth.ts y solo se usa desde Server Components / route handlers
 * (runtime Node) — ver app/(dashboard)/configuracion/layout.tsx para el gate de
 * /configuracion por rol.
 */
const { auth } = NextAuth(authConfig);

/**
 * Bypass de login SOLO para desarrollo/pruebas en VM local — nunca en producción
 * (protegido también por NODE_ENV; ver auth.ts para el bypass equivalente de
 * auth() en Server Components/route handlers). Con AUTH_DISABLED=true el
 * middleware deja pasar todo sin redirigir a /login.
 */
const AUTH_DISABLED = process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";

/**
 * Protege toda la app. Sin sesión válida → redirige a /login conservando la ruta
 * original como callbackUrl. (El redirect es explícito: en Auth.js v5 el callback
 * `authorized` solo gatea con `export { auth as middleware }`; con un callback
 * propio hay que redirigir a mano.)
 *
 * El matcher deja FUERA del gate: los endpoints de Auth.js (/api/auth/*), el
 * healthcheck de Docker (/api/health), la página de login, los estáticos de
 * Next, los iconos y la carpeta /brand.
 */
/** Rutas que aceptan Authorization: Bearer <token de servicio> en vez de sesión. */
const RUTAS_TOKEN = new Set(["/api/liquidaciones/filtros", "/api/liquidaciones/buscar", "/api/liquidaciones/pdf"]);

export default AUTH_DISABLED
  ? () => NextResponse.next()
  : auth((req) => {
      // Token de servicio: la ruta lo valida (lib/liquidaciones/token-servicio.ts); el Edge no lee la base.
      if (RUTAS_TOKEN.has(req.nextUrl.pathname) && /^Bearer\s/i.test(req.headers.get("authorization") ?? "")) {
        return NextResponse.next();
      }
      if (!req.auth) {
        const url = new URL("/login", req.nextUrl.origin);
        url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(url);
      }
    });

export const config = {
  matcher: [
    "/((?!api/auth|api/health|login|_next/static|_next/image|favicon.ico|icon.svg|brand/).*)",
  ],
};
