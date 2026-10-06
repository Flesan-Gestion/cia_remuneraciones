-- Configuración, paso 2: preferencias de usuario y avisos (ver docs/SHELL.md, «Plan de tablas»).
-- Se aplica a mano, una vez por plataforma, en la BBDD de QA de DATABASE_URL_PLATAFORMA
-- (srvpd_bd), dentro del esquema propio de la plataforma (aquí, cia_liquidaciones). QA es
-- productiva en la práctica: revisar antes.
--
-- Todo es aditivo (CREATE ... IF NOT EXISTS): no modifica ni borra tablas existentes.

BEGIN;

-- Mi personalización: una fila por usuario. Las preferencias van en jsonb para sumar
-- opciones nuevas sin migración; la app valida las claves (tema, texto, densidad,
-- reducirAnimaciones, inicio, portales, presentaciones, correos…).
CREATE TABLE IF NOT EXISTS cia_liquidaciones.preferencias_usuario (
  correo          VARCHAR(255) PRIMARY KEY CHECK (correo = lower(correo)),
  preferencias    JSONB        NOT NULL DEFAULT '{}'::jsonb
                    CHECK (jsonb_typeof(preferencias) = 'object'),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE cia_liquidaciones.preferencias_usuario IS
  'Mi personalización (Configuración): preferencias de cada usuario en jsonb.';

-- Avisos: franja para toda la plataforma mientras esté vigente (desde <= ahora < hasta).
-- hasta NULL = sin término. Los crea un administrador desde Configuración › Avisos.
CREATE TABLE IF NOT EXISTS cia_liquidaciones.avisos (
  id              BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mensaje         TEXT         NOT NULL CHECK (char_length(mensaje) BETWEEN 1 AND 500),
  nivel           VARCHAR(10)  NOT NULL DEFAULT 'info'
                    CHECK (nivel IN ('info', 'atencion', 'critico')),
  desde           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  hasta           TIMESTAMPTZ  CHECK (hasta IS NULL OR hasta > desde),
  creado_por      VARCHAR(255) NOT NULL,
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE cia_liquidaciones.avisos IS
  'Avisos (Configuración): franja visible para todos entre desde y hasta.';

-- La consulta de la franja pide los avisos vigentes ahora.
CREATE INDEX IF NOT EXISTS avisos_vigencia_idx ON cia_liquidaciones.avisos (desde, hasta);

COMMIT;
