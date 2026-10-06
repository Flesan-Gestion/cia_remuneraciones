-- Liquidaciones SAP: tablas propias de la plataforma en cia_liquidaciones (QA, srvpd_bd).
-- Se aplica una vez, después de db/001_usuarios_roles.sql y db/002_configuracion.sql. QA es
-- productiva en la práctica: revisar y aprobar antes de ejecutar. Todo es aditivo.
--
-- Qué guarda:
--   1. usuarios.perfil / usuarios.empresas: perfil de acceso a las liquidaciones, que en el
--      aplicativo antiguo (liquidaciones_sap_g2) eran listas de correos escritas en el código.
--   2. registro_actividad: quién descargó la liquidación de quién, y las acciones de envío.
--   3. envio_configuracion, envio_lotes, envio_detalle: envío mensual por correo con
--      aprobación de RR.HH.

BEGIN;

-- 1. Perfil de acceso ------------------------------------------------------------------------
-- rrhh       = ve todas las empresas (incluida NFG) y filtra planta/no planta; aprueba envíos.
-- jefatura   = ve solo los centros de costo donde es encargado o visitador en
--              flesan_rrhh.tabla_encargados_cc (no planta, y planta si el CC no tiene ver_planta).
--              Es el perfil de quien no está en esta tabla.
-- sin_acceso = no ve liquidaciones.
-- empresas   = si tiene valor, el filtro «Razón social» muestra todas las CC de esas empresas
--              en vez de solo las suyas (caso manuel.hidalgo: Inex). No amplía lo que puede ver.
ALTER TABLE cia_liquidaciones.usuarios
  ADD COLUMN IF NOT EXISTS perfil   VARCHAR(12) NOT NULL DEFAULT 'jefatura'
    CHECK (perfil IN ('rrhh', 'jefatura', 'sin_acceso')),
  ADD COLUMN IF NOT EXISTS empresas TEXT[];

-- Migración de las listas del aplicativo antiguo (liquidaciones.php / liquidaciones_pdf_new.php).
-- RR.HH. con acceso total (los correos que llevaban el código d6a7ec08-…).
INSERT INTO cia_liquidaciones.usuarios (correo, rol, perfil) VALUES
  ('nicolas.toro@flesan.cl', 'member', 'rrhh'),
  ('claudia.lagos@flesan.cl', 'member', 'rrhh'),
  ('aileen.quilaqueo@flesan.cl', 'member', 'rrhh'),
  ('maria.cayuqueo@flesan.cl', 'member', 'rrhh'),
  ('nelson.aravena@flesan.cl', 'member', 'rrhh'),
  ('brenda.hualpa@flesan.cl', 'member', 'rrhh'),
  ('jorge.barrozo@flesan.cl', 'member', 'rrhh'),
  ('carolina.zavala@flesan.cl', 'member', 'rrhh'),
  ('cristobal.figueroa@flesan.cl', 'member', 'rrhh'),
  ('cesar.munoz@flesan.cl', 'member', 'rrhh'),
  ('maria.marin@flesan.cl', 'member', 'rrhh')
ON CONFLICT (correo) DO NOTHING;

-- Correos que hoy quedan siempre en «Sin resultados» (estaban en una lista y no en la otra).
-- Decisión 2026-10-05: se mantienen sin acceso.
INSERT INTO cia_liquidaciones.usuarios (correo, rol, perfil) VALUES
  ('jocelyn.espinoza@flesan.cl', 'member', 'sin_acceso'),
  ('evelyn.navarrete@flesan.cl', 'member', 'sin_acceso'),
  ('cecilia.silva@flesan.cl', 'member', 'sin_acceso'),
  ('javiera.hernandez@flesan.cl', 'member', 'sin_acceso'),
  ('david.vilugron@flesan.cl', 'member', 'sin_acceso'),
  ('francisca.espindola@flesan.cl', 'member', 'sin_acceso'),
  ('diana.munoz@flesan.cl', 'member', 'sin_acceso'),
  ('manuel.pacha@flesan.cl', 'member', 'sin_acceso'),
  ('marco.martinez@flesan.cl', 'member', 'sin_acceso'),
  ('homero.chavez@flesan.cl', 'member', 'sin_acceso'),
  ('practica_rrhh@flesan.cl', 'member', 'sin_acceso'),
  ('adriana.bulnes@flesan.cl', 'member', 'sin_acceso'),
  ('sofia.figueroa@flesan.cl', 'member', 'sin_acceso'),
  ('lorena.faray@flesan.cl', 'member', 'sin_acceso'),
  ('catalina.fuentes@flesan.cl', 'member', 'sin_acceso'),
  ('practica.rrhh2@flesan.cl', 'member', 'sin_acceso'),
  ('alejandro.jara@flesan.cl', 'member', 'sin_acceso')
ON CONFLICT (correo) DO NOTHING;

-- manuel.hidalgo: como hoy, jefatura con el filtro de empresas limitado a Inex.
INSERT INTO cia_liquidaciones.usuarios (correo, rol, perfil, empresas) VALUES
  ('manuel.hidalgo@flesan.cl', 'member', 'jefatura', ARRAY['IX'])
ON CONFLICT (correo) DO NOTHING;

-- 2. Registro de actividad (columnas del plan estándar, docs/SHELL.md) ------------------------
CREATE TABLE IF NOT EXISTS cia_liquidaciones.registro_actividad (
  id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ocurrido_en TIMESTAMPTZ  NOT NULL DEFAULT now(),
  correo      VARCHAR(255) NOT NULL,
  accion      VARCHAR(60)  NOT NULL,
  entidad     VARCHAR(60)  NOT NULL,
  entidad_id  VARCHAR(100),
  detalle     JSONB        NOT NULL DEFAULT '{}'::jsonb
);
COMMENT ON TABLE cia_liquidaciones.registro_actividad IS
  'Quién hizo qué y cuándo: descargas de liquidaciones (con la lista de personas), envíos, perfiles.';
CREATE INDEX IF NOT EXISTS registro_actividad_fecha_idx ON cia_liquidaciones.registro_actividad (ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS registro_actividad_correo_idx ON cia_liquidaciones.registro_actividad (correo);

-- 3. Envío por correo ------------------------------------------------------------------------
-- Una sola fila: el día del mes en que se prepara el lote del mes anterior.
CREATE TABLE IF NOT EXISTS cia_liquidaciones.envio_configuracion (
  id              SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dia_mes         SMALLINT     NOT NULL DEFAULT 5 CHECK (dia_mes BETWEEN 1 AND 28),
  activo          BOOLEAN      NOT NULL DEFAULT true,
  actualizado_por VARCHAR(255),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO cia_liquidaciones.envio_configuracion (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Un lote por periodo (AAAAMM). Se prepara solo el día configurado (o a mano) y no sale nada
-- hasta que RR.HH. lo aprueba. «pausado» detiene un envío en curso sin perder lo pendiente.
CREATE TABLE IF NOT EXISTS cia_liquidaciones.envio_lotes (
  id            BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periodo       CHAR(6)      NOT NULL CHECK (periodo ~ '^[0-9]{6}$'),
  estado        VARCHAR(12)  NOT NULL DEFAULT 'por_aprobar'
                  CHECK (estado IN ('por_aprobar', 'enviando', 'pausado', 'enviado', 'cancelado')),
  creado_por    VARCHAR(255) NOT NULL,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  aprobado_por  VARCHAR(255),
  aprobado_en   TIMESTAMPTZ,
  terminado_en  TIMESTAMPTZ,
  cancelado_por VARCHAR(255),
  cancelado_en  TIMESTAMPTZ
);
-- Nunca dos lotes vivos para el mismo periodo (uno cancelado se puede volver a preparar).
CREATE UNIQUE INDEX IF NOT EXISTS envio_lotes_periodo_vivo_idx
  ON cia_liquidaciones.envio_lotes (periodo) WHERE estado <> 'cancelado';

-- Una fila por persona del lote: un correo con un PDF que trae todas sus liquidaciones del
-- periodo (normal y fuera de ciclo). El correo se fija al preparar el lote: es lo que RR.HH.
-- revisa y aprueba.
CREATE TABLE IF NOT EXISTS cia_liquidaciones.envio_detalle (
  id                 BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_id            BIGINT       NOT NULL REFERENCES cia_liquidaciones.envio_lotes (id),
  numero_de_personal VARCHAR(20)  NOT NULL,
  nombre             TEXT         NOT NULL,
  sociedad           VARCHAR(10),
  correo             VARCHAR(255),
  origen_correo      VARCHAR(12)  CHECK (origen_correo IN ('corporativo', 'personal')),
  liquidaciones      JSONB        NOT NULL,
  estado             VARCHAR(12)  NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente', 'enviando', 'enviado', 'error', 'sin_correo', 'excluido')),
  intentos           SMALLINT     NOT NULL DEFAULT 0,
  ultimo_error       TEXT,
  enviado_en         TIMESTAMPTZ,
  actualizado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (lote_id, numero_de_personal)
);
CREATE INDEX IF NOT EXISTS envio_detalle_estado_idx ON cia_liquidaciones.envio_detalle (lote_id, estado);
CREATE INDEX IF NOT EXISTS envio_detalle_enviado_idx ON cia_liquidaciones.envio_detalle (enviado_en);

COMMIT;
