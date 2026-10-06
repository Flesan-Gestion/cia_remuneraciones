-- Maestro de colaboradores activos de Grupo Flesan (fuente: flesan_rrhh, SAP), de solo
-- lectura. Alimenta el buscador de /configuracion/usuarios (lib/colaboradores-db.ts) para
-- asignar rol sin mantener una tabla de personas duplicada. Vive en el repo como .sql (no
-- embebido en TypeScript) para que actualizar la query sea editar este archivo, sin tocar
-- código — mismo patrón en seguimiento_proyectos_fai y plataforma_auditorias.
--
-- Solo aplica si esta plataforma activa roles persistidos en BBDD (ver
-- docs/ARQUITECTURA.md) y necesita Postgres con acceso a flesan_rrhh. Si no, borra este
-- archivo y lib/colaboradores-db.ts.

SELECT DISTINCT
  regexp_replace(trim(m.first_name) || ' ' || trim(m.last_name), '\s+', ' ', 'g') AS nombre_sap,
  m.national_id AS rut,
  m.correo_flesan,
  c.nombre_cargo,
  m.empresa,
  m.nombre_departamento
FROM flesan_rrhh.sap_maestro_colaborador AS m
LEFT JOIN flesan_rrhh.sap_maestro_cargos AS c
  ON m.external_cod_cargo = c.external_code
WHERE right(m.empl_status, 1) = '1'
ORDER BY 1
