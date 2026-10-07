-- Remuneraciones G2: limpieza de la copia de encargados de CC (cia_liquidaciones.encargados_cc).
-- Se aplica una vez, después de db/006. QA es productiva en la práctica: revisar y aprobar antes de
-- ejecutar. Desde 2026-10-07 la copia es la única fuente (docs/DECISIONES.md).
--
-- 1. Filas duplicadas exactas: 16 centros de costo aparecen 2 a 4 veces con la misma llave y los
--    mismos datos (22 filas de más). Se deja la de menor id. Los CC con el mismo nombre en empresas
--    distintas (llave distinta) NO se tocan: son filas legítimas.
-- 2. Lista de GGO (correo_ggo): se quitan los vacíos (",,", coma inicial), los correos repetidos
--    (sin distinguir mayúsculas) y los espacios o saltos de línea sobrantes. Se conserva el orden y
--    la escritura de la primera aparición.
--
-- No se tocan las mayúsculas de «administrativo» ni de «visitador»: algunas consultas originales las
-- comparan tal cual y cambiarlas cambiaría lo que ven esas personas.

BEGIN;

-- 1. Duplicados exactos (las 14 columnas de la tabla original iguales, NULL incluido).
DELETE FROM cia_liquidaciones.encargados_cc a
USING cia_liquidaciones.encargados_cc b
WHERE a.id > b.id
  AND a.llave                IS NOT DISTINCT FROM b.llave
  AND a.sociedad             IS NOT DISTINCT FROM b.sociedad
  AND a.centro_coto          IS NOT DISTINCT FROM b.centro_coto
  AND a.administrativo       IS NOT DISTINCT FROM b.administrativo
  AND a.correo               IS NOT DISTINCT FROM b.correo
  AND a.ver_planta           IS NOT DISTINCT FROM b.ver_planta
  AND a.administrador        IS NOT DISTINCT FROM b.administrador
  AND a.correo_administrador IS NOT DISTINCT FROM b.correo_administrador
  AND a.visitador            IS NOT DISTINCT FROM b.visitador
  AND a.correo_visitador     IS NOT DISTINCT FROM b.correo_visitador
  AND a.gerente              IS NOT DISTINCT FROM b.gerente
  AND a.correo_gerente       IS NOT DISTINCT FROM b.correo_gerente
  AND a.correo_ggo           IS NOT DISTINCT FROM b.correo_ggo
  AND a.division             IS NOT DISTINCT FROM b.division;

-- 2. Lista de GGO sin vacíos ni repetidos.
WITH partes AS (
  SELECT e.id, btrim(p.correo, E' \t\r\n') AS correo, p.orden
    FROM cia_liquidaciones.encargados_cc e,
         unnest(string_to_array(e.correo_ggo, ',')) WITH ORDINALITY AS p(correo, orden)
   WHERE e.correo_ggo IS NOT NULL
),
primeras AS (
  SELECT DISTINCT ON (id, lower(correo)) id, correo, orden
    FROM partes
   WHERE correo <> ''
   ORDER BY id, lower(correo), orden
),
limpia AS (
  SELECT e.id, (SELECT string_agg(p.correo, ',' ORDER BY p.orden) FROM primeras p WHERE p.id = e.id) AS correo_ggo
    FROM cia_liquidaciones.encargados_cc e
   WHERE e.correo_ggo IS NOT NULL
)
UPDATE cia_liquidaciones.encargados_cc e
   SET correo_ggo = l.correo_ggo,
       actualizado_por = 'limpieza db/007',
       updated_at = now()
  FROM limpia l
 WHERE e.id = l.id
   AND e.correo_ggo IS DISTINCT FROM l.correo_ggo;

COMMIT;
