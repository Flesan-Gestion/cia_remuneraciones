-- Notificaciones (campanita de la barra superior y bandeja /notificaciones). Ver docs/SHELL.md.
-- Se aplica a mano, una vez por plataforma, en la BBDD de QA de DATABASE_URL_PLATAFORMA
-- (srvpd_bd), dentro del esquema propio de la plataforma. Reemplaza «cia_<slug>» por ese
-- esquema (ej. cia_plataforma_auditorias). QA es productiva en la práctica: revisar antes.
--
-- Todo es aditivo (CREATE ... IF NOT EXISTS): no modifica ni borra tablas existentes.
-- Solo hace falta si la plataforma tiene login y declara tipos en lib/notificaciones-plataforma.ts.

BEGIN;

-- Una fila por notificación y destinatario. El tipo es texto libre: cada plataforma declara
-- los suyos (ícono, color, etiqueta) en lib/notificaciones-plataforma.ts, sin CHECK acá, para
-- sumar tipos sin migración. El enlace es la ruta interna a la que lleva (ej. /checklists/12#item-4);
-- lo propio de cada tipo (motivo de un rechazo, texto de un comentario) va en datos.
CREATE TABLE IF NOT EXISTS cia_<slug>.notificaciones (
  id                   BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  destinatario_correo  VARCHAR(255) NOT NULL CHECK (destinatario_correo = lower(destinatario_correo)),
  tipo                 VARCHAR(40)  NOT NULL CHECK (tipo ~ '^[a-z_]{1,40}$'),
  titulo               TEXT         NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 200),
  cuerpo               TEXT         NOT NULL DEFAULT '' CHECK (char_length(cuerpo) <= 1000),
  enlace               TEXT         CHECK (enlace IS NULL OR enlace LIKE '/%'),
  datos                JSONB        NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(datos) = 'object'),
  actor_correo         VARCHAR(255),
  leida_en             TIMESTAMPTZ,
  creada_en            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE cia_<slug>.notificaciones IS
  'Notificaciones por usuario: campanita de la barra superior y bandeja /notificaciones.';

-- La campanita pide las últimas de un usuario y cuenta sus no leídas cada minuto.
CREATE INDEX IF NOT EXISTS notificaciones_destinatario_idx
  ON cia_<slug>.notificaciones (destinatario_correo, creada_en DESC);
CREATE INDEX IF NOT EXISTS notificaciones_no_leidas_idx
  ON cia_<slug>.notificaciones (destinatario_correo)
  WHERE leida_en IS NULL;

COMMIT;
