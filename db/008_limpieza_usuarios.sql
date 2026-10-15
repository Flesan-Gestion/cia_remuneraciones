-- Remuneraciones G2: «Usuarios y roles» queda solo con personas activas del grupo 2.
-- Clasificación del 2026-10-07 (solo lectura) contra flesan_rrhh:
--   - Desvinculado: en sap_maestro_colaborador solo tiene registros 41119 (ninguno 41111).
--   - Grupo: el CC actual de su registro activo en sap_maestro_empresa_dep_un_cc.external_code_pais
--     (10000004 «Minería, Vialidad e Inmobiliaria» = grupo 2; 10000001 = grupo 1).
-- Se borran 65 personas del grupo 1 y 15 desvinculadas (lista explícita, revisada).
-- No se tocan: los 41 activos del grupo 2 (incluido el administrador) ni las 33 personas que no aparecen en el maestro.
-- Respaldo: la tabla completa queda en usuarios_respaldo_20261007 (para deshacer: reinsertar desde ahí).

BEGIN;

CREATE TABLE cia_liquidaciones.usuarios_respaldo_20261007 AS
  SELECT * FROM cia_liquidaciones.usuarios;

-- Grupo 1 (65)
DELETE FROM cia_liquidaciones.usuarios WHERE correo IN (
  'aalvarez@flesan.cl',
  'a.aravenaj@flesan.cl',
  'aldo.rios@flesan.cl',
  'alejandro.nunez@dvc.cl',
  'alexis.parra@flesan.cl',
  'andres.bravo@flesan.cl',
  'antonio.munoz@flesan.cl',
  'bastian.gutierrez@flesan.cl',
  'benjamin.catalan@dvc.cl',
  'beverly.barahona@flesan.cl',
  'carlos.reyes@dvc.cl',
  'carlos.zamora@flesan.cl',
  'carmen.ruiz@flesan.cl',
  'carolina.alvarez@flesan.cl',
  'carolina.rojas@flesan.cl',
  'carolina.zavala@flesan.cl',
  'catalina.fuentes@flesan.cl',
  'cecilia.silva@flesan.cl',
  'cesar.leiva@dvc.cl',
  'cesar.silva@flesan.cl',
  'claudia.mejias@dvc.cl',
  'cmachado@flesan.cl',
  'cojeda@dvc.cl',
  'cperez@dvc.cl',
  'cristobal.figueroa@flesan.cl',
  'darling.acuna@flesan.cl',
  'diego.carcamo@flesan.cl',
  'dreidy.contreras@flesan.cl',
  'eduardo.schwaner@dvc.cl',
  'erna.matus@flesan.cl',
  'fernando.david@flesan.cl',
  'frida.morales@flesan.cl',
  'gabriel.mora@flesan.cl',
  'hector.duran@flesan.cl',
  'ignacio.pena@difai.cl',
  'jaime.morales@flesan.cl',
  'jcaceres@dvc.cl',
  'jlizana@dvc.cl',
  'jocelyn.espinoza@flesan.cl',
  'jorge.barrozo@flesan.cl',
  'jorge.salinas@flesan.cl',
  'josmary.arreaza@flesan.cl',
  'jpechague@dvc.cl',
  'juan.vergara@flesan.cl',
  'jvenegas@dvc.cl',
  'leonardo.pape@flesan.cl',
  'manuel.pacha@flesan.cl',
  'maria.marin@flesan.cl',
  'mario.ponce@dvc.cl',
  'maximo.bardet@dvc.cl',
  'mchahuan@dvc.cl',
  'mperez@dvc.cl',
  'mqueralto@dvc.cl',
  'mvenegas@dvc.cl',
  'oscar.benavides@flesan.cl',
  'paloma.ruiz@flesan.cl',
  'paola.gomez@dvc.cl',
  'pnormandin@flesan.cl',
  'ricardo.acunapalma@dvc.cl',
  'rodrigo.ruz@flesan.cl',
  'rsalinas@flesan.cl',
  'sebastian.orellana@flesan.cl',
  'tchahuan@dvc.cl',
  'ycornejo@flesan.cl',
  'yiturra@flesan.cl'
);

-- Desvinculados (15)
DELETE FROM cia_liquidaciones.usuarios WHERE correo IN (
  'aracelli.cabello@flesan.cl',
  'camilo.vasquez@flesan.cl',
  'david.vilugron@flesan.cl',
  'diego.aguero@flesan.cl',
  'eduardo.medina@flesan.cl',
  'francisca.espindola@flesan.cl',
  'francisco.degregorio@flesan.cl',
  'javiera.hernandez@flesan.cl',
  'julio.ramos@flesan.cl',
  'manuel.aguayo@flesan.cl',
  'raul.montenegro@flesan.cl',
  'ricardo.medel@flesan.cl',
  'rigoberto.vidal@flesan.cl',
  'veronica.perez@flesan.cl',
  'wanda.cabrera@inexchile.cl'
);

COMMIT;
