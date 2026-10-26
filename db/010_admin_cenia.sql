-- Acceso total para diego.arredondo@cenia.cl (2026-10-26).
-- Rol admin (Configuración), perfil rrhh sin empresas fijas (todas las liquidaciones) y
-- rol «administrador» en libros G2, prorrateado y finiquitos (todas las empresas).
-- Reemplazar el esquema: cia_liquidaciones (QA) / remuneracionesg2 (PD).
INSERT INTO cia_liquidaciones.usuarios (correo, nombre, rol, perfil, empresas, rol_remuneraciones, ve_nfg)
VALUES ('diego.arredondo@cenia.cl', 'Diego Arredondo', 'admin', 'rrhh', NULL, 'administrador', true)
ON CONFLICT (correo) DO UPDATE
   SET rol = 'admin', perfil = 'rrhh', empresas = NULL, rol_remuneraciones = 'administrador', ve_nfg = true;
