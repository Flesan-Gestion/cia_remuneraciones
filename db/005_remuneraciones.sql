-- Remuneraciones SAP: rol en los libros de remuneraciones y finiquitos, en cia_liquidaciones
-- (QA, srvpd_bd). Se aplica una vez, después de db/004_liquidaciones.sql. QA es productiva en la
-- práctica: revisar y aprobar antes de ejecutar. Todo es aditivo.
--
-- Qué guarda:
--   1. usuarios.rol_remuneraciones: el rol de cada persona en los aplicativos antiguos
--      libro_rem_g2, libro_rem_dis y finiquito_rem, que lo leían de
--      flesan_rrhh.tabla_mantendor_rol_encargados_cc (base transaccional, que la plataforma solo
--      lee). Se copia una vez (124 correos al 2026-10-06) y desde aquí se administra en
--      Configuración › Usuarios y roles.
--   2. usuarios.ve_nfg: quienes ven la sociedad NFG con rol de encargado (lista fija en el código
--      de los tres aplicativos antiguos).

BEGIN;

-- 1. Rol en los libros y finiquitos ---------------------------------------------------------
-- administrador       (1) = todas las empresas, incluida NFG.
-- rrhh                (2) = todas las empresas menos NFG.
-- administrativo_rrhh (3) = los CC donde es encargado (tabla_encargados_cc.correo).
-- administrador_obra  (4) = los CC donde es visitador (tabla_encargados_cc.visitador).
-- ggo                 (5) = los CC donde figura como GGO; solo costo empresa.
-- NULL                    = sin acceso a los libros ni a finiquitos.
-- Es independiente del perfil de liquidaciones (usuarios.perfil), como en los aplicativos antiguos.
ALTER TABLE cia_liquidaciones.usuarios
  ADD COLUMN IF NOT EXISTS rol_remuneraciones VARCHAR(20)
    CHECK (rol_remuneraciones IN ('administrador', 'rrhh', 'administrativo_rrhh', 'administrador_obra', 'ggo')),
  ADD COLUMN IF NOT EXISTS ve_nfg BOOLEAN NOT NULL DEFAULT false;

-- Copia de flesan_rrhh.tabla_mantendor_rol_encargados_cc, con el correo en minúsculas (uno estaba
-- en mayúsculas: RENE.GODOY@FLESAN.CL). Quien ya tiene fila conserva su rol de la plataforma y su
-- perfil de liquidaciones; quien no, entra con los valores por defecto (miembro, jefatura), que
-- son los mismos que tiene hoy sin fila.
INSERT INTO cia_liquidaciones.usuarios (correo, rol_remuneraciones) VALUES
  -- 1 · Administrador (12)
  ('aileen.quilaqueo@flesan.cl', 'administrador'),
  ('brenda.hualpa@flesan.cl', 'administrador'),
  ('carlos.lizana@flesan.cl', 'administrador'),
  ('carolina.zavala@flesan.cl', 'administrador'),
  ('cesar.munoz@flesan.cl', 'administrador'),
  ('cristobal.figueroa@flesan.cl', 'administrador'),
  ('jorge.barrozo@flesan.cl', 'administrador'),
  ('maria.cayuqueo@flesan.cl', 'administrador'),
  ('maria.marin@flesan.cl', 'administrador'),
  ('nelson.aravena@flesan.cl', 'administrador'),
  ('nicolas.toro@flesan.cl', 'administrador'),
  ('serodriguez@flesan.com.pe', 'administrador'),
  -- 2 · RRHH (6)
  ('alejandro.jara@flesan.cl', 'rrhh'),
  ('catalina.fuentes@flesan.cl', 'rrhh'),
  ('cecilia.silva@flesan.cl', 'rrhh'),
  ('lorena.faray@flesan.cl', 'rrhh'),
  ('manuel.pacha@flesan.cl', 'rrhh'),
  ('nagely.henriquez@flesan.cl', 'rrhh'),
  -- 3 · Administrativo RRHH (43)
  ('alejandro.nunez@dvc.cl', 'administrativo_rrhh'),
  ('andres.bravo@flesan.cl', 'administrativo_rrhh'),
  ('antonio.munoz@flesan.cl', 'administrativo_rrhh'),
  ('aracelli.cabello@flesan.cl', 'administrativo_rrhh'),
  ('bastian.gutierrez@flesan.cl', 'administrativo_rrhh'),
  ('beverly.barahona@flesan.cl', 'administrativo_rrhh'),
  ('carmen.ruiz@flesan.cl', 'administrativo_rrhh'),
  ('caterin.estrada@flesan.cl', 'administrativo_rrhh'),
  ('cesar.leiva@dvc.cl', 'administrativo_rrhh'),
  ('cesar.silva@flesan.cl', 'administrativo_rrhh'),
  ('cindy.ahumada@flesan.cl', 'administrativo_rrhh'),
  ('cojeda@dvc.cl', 'administrativo_rrhh'),
  ('cperez@dvc.cl', 'administrativo_rrhh'),
  ('darling.acuna@flesan.cl', 'administrativo_rrhh'),
  ('david.godoy@flesan.cl', 'administrativo_rrhh'),
  ('dreidy.contreras@dvc.cl', 'administrativo_rrhh'),
  ('dreidy.contreras@flesan.cl', 'administrativo_rrhh'),
  ('evelyn.navarrete@flesan.cl', 'administrativo_rrhh'),
  ('frida.morales@flesan.cl', 'administrativo_rrhh'),
  ('gabriel.mora@flesan.cl', 'administrativo_rrhh'),
  ('genesis.caceres@flesan.cl', 'administrativo_rrhh'),
  ('hcoyul@flesan.cl', 'administrativo_rrhh'),
  ('jaime.morales@flesan.cl', 'administrativo_rrhh'),
  ('jcaceres@dvc.cl', 'administrativo_rrhh'),
  ('jennifer.escudero@flesan.cl', 'administrativo_rrhh'),
  ('joselin.valdes@flesan.cl', 'administrativo_rrhh'),
  ('juan.rubio@flesan.cl', 'administrativo_rrhh'),
  ('karolin.stange@flesan.cl', 'administrativo_rrhh'),
  ('manuel.aguayo@flesan.cl', 'administrativo_rrhh'),
  ('marcos.gallardo@flesan.cl', 'administrativo_rrhh'),
  ('mario.ponce@dvc.cl', 'administrativo_rrhh'),
  ('nicole.velasquez@flesan.cl', 'administrativo_rrhh'),
  ('paola.gomez@dvc.cl', 'administrativo_rrhh'),
  ('paulina.gutierrez@flesan.cl', 'administrativo_rrhh'),
  ('paulina.molina@flesan.cl', 'administrativo_rrhh'),
  ('raul.montenegro@flesan.cl', 'administrativo_rrhh'),
  ('ricardo.godoy@flesan.cl', 'administrativo_rrhh'),
  ('ricardo.medel@flesan.cl', 'administrativo_rrhh'),
  ('rodrigo.pardo@flesan.cl', 'administrativo_rrhh'),
  ('wanda.cabrera@inexchile.com', 'administrativo_rrhh'),
  ('yanela.catalan@flesan.cl', 'administrativo_rrhh'),
  ('yasmin.castro@dvc.cl', 'administrativo_rrhh'),
  ('ycornejo@flesan.cl', 'administrativo_rrhh'),
  -- 4 · Administrador OBRA (46)
  ('a.aravenaj@flesan.cl', 'administrador_obra'),
  ('adrian.araya@flesan.cl', 'administrador_obra'),
  ('alejandro.cifuentes@flesan.cl', 'administrador_obra'),
  ('alexis.parra@flesan.cl', 'administrador_obra'),
  ('ariel.ruiz@dvc.cl', 'administrador_obra'),
  ('benjamin.catalan@dvc.cl', 'administrador_obra'),
  ('carlos.reyes@dvc.cl', 'administrador_obra'),
  ('carlos.zamora@flesan.cl', 'administrador_obra'),
  ('carolina.alvarez@flesan.cl', 'administrador_obra'),
  ('carolina.rojas@flesan.cl', 'administrador_obra'),
  ('claudia.mejias@dvc.cl', 'administrador_obra'),
  ('cmachado@flesan.cl', 'administrador_obra'),
  ('cmandiola@flesan.cl', 'administrador_obra'),
  ('diego.carcamo@flesan.cl', 'administrador_obra'),
  ('eduardo.aguilar@flesan.cl', 'administrador_obra'),
  ('eduardo.schwaner@dvc.cl', 'administrador_obra'),
  ('emanriquez@dvc.cl', 'administrador_obra'),
  ('fabian.herreros@flesan.cl', 'administrador_obra'),
  ('fernando.david@flesan.cl', 'administrador_obra'),
  ('francisco.marin@flesan.cl', 'administrador_obra'),
  ('hanz.barraza@flesan.cl', 'administrador_obra'),
  ('hector.duran@flesan.cl', 'administrador_obra'),
  ('ignacio.pena@difai.cl', 'administrador_obra'),
  ('jaime.molina@flesan.cl', 'administrador_obra'),
  ('jaroslav.blaha@flesan.cl', 'administrador_obra'),
  ('jlizana@dvc.cl', 'administrador_obra'),
  ('jorge.salinas@flesan.cl', 'administrador_obra'),
  ('jpechague@dvc.cl', 'administrador_obra'),
  ('juan.vergara@flesan.cl', 'administrador_obra'),
  ('juan.villegas@flesan.cl', 'administrador_obra'),
  ('jvenegas@dvc.cl', 'administrador_obra'),
  ('leonardo.pape@flesan.cl', 'administrador_obra'),
  ('lgonzalez@dvc.cl', 'administrador_obra'),
  ('manuel.hidalgo@flesan.cl', 'administrador_obra'),
  ('manuel.vivar@flesan.cl', 'administrador_obra'),
  ('maximo.bardet@dvc.cl', 'administrador_obra'),
  ('mperez@dvc.cl', 'administrador_obra'),
  ('mvenegas@dvc.cl', 'administrador_obra'),
  ('oscar.benavides@flesan.cl', 'administrador_obra'),
  ('osvaldo.guzman@flesan.cl', 'administrador_obra'),
  ('pnormandin@flesan.cl', 'administrador_obra'),
  ('rene.godoy@flesan.cl', 'administrador_obra'),
  ('ricardo.acunapalma@dvc.cl', 'administrador_obra'),
  ('rodolfo.yanez@flesan.cl', 'administrador_obra'),
  ('rodrigo.ruz@flesan.cl', 'administrador_obra'),
  ('yiturra@flesan.cl', 'administrador_obra'),
  -- 5 · GGO (17)
  ('aalvarez@flesan.cl', 'ggo'),
  ('aldo.rios@flesan.cl', 'ggo'),
  ('eca@flesan.cl', 'ggo'),
  ('erna.matus@flesan.cl', 'ggo'),
  ('francisco.degregorio@flesan.cl', 'ggo'),
  ('jorge.miranda@flesan.cl', 'ggo'),
  ('josmary.arreaza@flesan.cl', 'ggo'),
  ('marcelo.zagal@dvc.cl', 'ggo'),
  ('mauricio.alcaino@flesan.cl', 'ggo'),
  ('mchahuan@dvc.cl', 'ggo'),
  ('mqueralto@dvc.cl', 'ggo'),
  ('paloma.ruiz@flesan.cl', 'ggo'),
  ('renato.zamora@flesan.cl', 'ggo'),
  ('rsalinas@flesan.cl', 'ggo'),
  ('sebastian.orellana@flesan.cl', 'ggo'),
  ('tchahuan@dvc.cl', 'ggo'),
  ('veronica.fereira@flesan.cl', 'ggo')
ON CONFLICT (correo) DO UPDATE SET rol_remuneraciones = EXCLUDED.rol_remuneraciones, updated_at = now();

-- 2. NFG con rol de encargado ---------------------------------------------------------------
-- La lista fija de los aplicativos antiguos tiene 11 correos; solo estos dos tienen rol en los
-- libros (los otros nueve no entran a los libros, así que la marca no les cambia nada).
UPDATE cia_liquidaciones.usuarios SET ve_nfg = true, updated_at = now()
WHERE correo IN ('manuel.hidalgo@flesan.cl', 'yiturra@flesan.cl');

COMMIT;
