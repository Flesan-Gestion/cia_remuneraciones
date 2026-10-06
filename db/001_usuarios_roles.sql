-- Roles persistidos para /configuracion/usuarios (opcional): solo si la plataforma administra
-- roles desde la UI en vez de solo CIA_ADMIN_EMAILS. Se aplica a mano, una vez, en el esquema
-- propio de la plataforma en QA (DATABASE_URL_PLATAFORMA + ESQUEMA_PLATAFORMA), nunca en la base
-- transaccional, que es solo lectura. Esquema de esta plataforma: cia_liquidaciones. QA es productiva en
-- la práctica: revisar y aprobar antes de ejecutar.
--
-- Filas ausentes = usuario no administrado desde el panel: entra como "member" (ver
-- lib/usuarios-db.ts). CIA_ADMIN_EMAILS sigue siendo el bootstrap de administrador, fijo por env
-- y nunca editable desde esta tabla.

CREATE TABLE IF NOT EXISTS cia_liquidaciones.usuarios (
  correo      VARCHAR(255) PRIMARY KEY,
  nombre      TEXT,
  rol         VARCHAR(20) NOT NULL DEFAULT 'member'
                CHECK (rol IN ('admin', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
