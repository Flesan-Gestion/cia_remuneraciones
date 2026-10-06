import { Pool } from "pg";

/** Runtime Node únicamente (route handlers, Server Components, auth.ts) — nunca
 * importar desde un client component ni desde auth.config.ts (edge, ver middleware.ts).
 * Inerte si no hay DATABASE_URL: el constructor de Pool no conecta hasta la primera
 * query, así que este archivo se puede importar siempre sin costo cuando la plataforma
 * no usa Postgres — ver docs/ARQUITECTURA.md. */
declare global {
  var _pgPool: Pool | undefined;
}

// Cacheado en globalThis para no abrir un pool nuevo en cada hot-reload de Next en dev.
export const pool =
  globalThis._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis._pgPool = pool;
}
