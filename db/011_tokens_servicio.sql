-- Tokens de servicio para consumir por API /api/liquidaciones/{filtros,buscar,pdf} sin sesión
-- (2026-11-09). Aprobado por RR.HH. Se guarda solo el SHA-256 del token; el token en claro se
-- entrega una vez (scripts/token-servicio.mjs genera el token y el INSERT).
-- El token tiene perfil rrhh sin empresas fijas (ve todas las liquidaciones).
-- Reemplazar el esquema: cia_liquidaciones (QA) / remuneracionesg2 (PD).
CREATE TABLE IF NOT EXISTS cia_liquidaciones.tokens_servicio (
  id          serial PRIMARY KEY,
  nombre      text        NOT NULL UNIQUE,
  hash_token  char(64)    NOT NULL UNIQUE,
  expira_en   timestamptz NOT NULL,
  revocado_en timestamptz,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE cia_liquidaciones.tokens_servicio IS
  'Tokens de servicio (Authorization: Bearer) para la API de liquidaciones. Solo el hash SHA-256.';

-- Revocar: UPDATE cia_liquidaciones.tokens_servicio SET revocado_en = now() WHERE nombre = '<nombre>';
