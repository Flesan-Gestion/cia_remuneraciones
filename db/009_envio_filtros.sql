-- Envío por correo: centro de costo y planta / no planta de cada persona del lote (2026-10-19),
-- para filtrar la revisión por razón social, centro de costo y planta y excluir en bloque. Se fijan
-- al preparar el lote, como el correo. Los lotes ya preparados quedan sin estos datos: para
-- tenerlos en uno por aprobar, cancelarlo y prepararlo de nuevo a mano.
-- Se aplica una vez, después de db/004_liquidaciones.sql y ANTES de desplegar el código que las
-- usa. QA es productiva en la práctica: revisar y aprobar antes de ejecutar. Todo es aditivo.
-- Producción: el mismo bloque con el esquema remuneracionesg2 (al final de
-- db/produccion_remuneracionesg2.sql).

BEGIN;

ALTER TABLE cia_liquidaciones.envio_detalle
  ADD COLUMN IF NOT EXISTS centro_costo    TEXT,
  ADD COLUMN IF NOT EXISTS nombre_cc       TEXT,
  ADD COLUMN IF NOT EXISTS planta_noplanta TEXT;

COMMIT;
