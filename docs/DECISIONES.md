# Decisiones — Remuneraciones SAP

Resumen de arranque (docs/ARRANQUE.md, bloque I) y lo decidido al migrar los aplicativos antiguos
de RR.HH. (PHP, controlflujo): `liquidaciones_sap_g2` (PHP + FPDF) y `libro_rem_g2`
(PHP + PhpSpreadsheet). Faltan `libro_rem_dis` (libro prorrateado) y `finiquito_rem`, que se
migran uno a uno. La plataforma nació como «Liquidaciones SAP» y desde el 2026-10-06 se llama
«Remuneraciones SAP»: al entrar se elige el módulo.

```
Plataforma:   Remuneraciones SAP (liquidaciones) · para RR.HH. y jefaturas de obra
Naturaleza:   reportería (búsqueda + PDF, libro en Excel) y proceso con flujo (envío mensual con aprobación)
Acceso:       login Google · rol admin/member + perfil de liquidaciones rrhh / jefatura / sin_acceso
              + rol en los libros administrador / rrhh / administrativo_rrhh / administrador_obra / ggo
Lee:          DW flesan (DATABASE_URL, solo lectura): flesan_rrhh.sap_liquidaciones_grupo_flesan_g2
              (una fila por concepto, persona y periodo), sap_tabla_paso_liquidaciones,
              sap_maestro_colaborador, sap_maestro_historial_eventos, sap_maestro_cargos,
              sap_maestro_empresa_dep_un_cc, sap_maestro_ubicacion, sap_maestro_tipo_contrato,
              sap_maestro_clasificacion_gasto, cc_nomina, tabla_encargados_cc, public.maestro_rut,
              flesan_procesos.api_uf_utm
Escribe:      cia_liquidaciones (QA srvpd_bd): usuarios, preferencias_usuario, avisos,
              registro_actividad, envio_configuracion, envio_lotes, envio_detalle
Módulos:      sí: avisos, buzón CIA, registro de actividad, usuarios y roles, correos
              no: notificaciones (campanita), presentaciones, estado de los datos, fuentes de datos
Pantallas:    Inicio (elegir módulo), Liquidaciones (filtros + vista previa + PDF), Envío por correo
              (programación + lotes), Envío de un periodo (revisión, prueba, aprobación, reenvío),
              Libro de remuneraciones (filtros + Excel)
Despliegue:   VM servidor_flesan (puerto por definir) · ENVIO_HABILITADO=true solo en producción
```

## Igual que el aplicativo antiguo

- Filtros: razón social, centro de costo, periodo desde/hasta, número de personal, planta/no planta.
- Reglas de la consulta: nóminas fuera de ciclo (periodo 000000, tipo B) con la marca como periodo;
  se excluye el tipo de cálculo A; cargo vigente antes del inicio del periodo; días trabajados
  (posición 700) con tope 30; total a pagar = posición 800 de SAP.
- Permisos efectivos de hoy:
  - RR.HH. total: los 11 correos que llevaban el código `d6a7ec08-…`. Ven todo, incluida NFG.
  - Jefatura: cualquier otro correo. Ve los CC donde es encargado o visitador; personal no
    planta, y de planta solo si el CC no tiene `ver_planta`; nunca NFG.
  - Sin acceso: 17 correos que hoy siempre reciben «Sin resultados». Decisión del 2026-10-05:
    se mantienen sin acceso.
  - manuel.hidalgo: como hoy, jefatura con el filtro de empresas limitado a Inex (IX).
  - 2026-10-06: las empresas asignadas a una jefatura (`usuarios.empresas`) dan acceso real: ve todas
    las liquidaciones de esas empresas (nunca NFG) y filtra planta/no planta. En el PHP esa rama existía
    pero no se ejecutaba (solo cambiaba la lista de CC y los resultados salían vacíos fuera de sus CC).
- PDF: mismas coordenadas, textos y cálculos que `liquidaciones_pdf_new.php`. La letra Calibri
  del título se reemplaza por Carlito (mismas métricas, licencia OFL). Comparado el 2026-10-06
  con un PDF del sistema antiguo (NP 112791, septiembre 2026): las 944 letras quedan en la misma
  posición (diferencia < 0,01 pt). Dos detalles del antiguo que se replican a propósito: el PHP
  corre en PHP 7, donde `MultiCell(..., 0)` alinea a la derecha (`0 == 'R'`), y FPDF no aplica
  kerning.
- Se mantiene la dirección fija «Avenida Apoquindo # 6550 P. 10 LAS CONDES» y la ausencia de la
  leyenda «preliminar» (su condición estaba amarrada a 2022 y ya no se cumplía).

## Mejoras aprobadas (2026-10-05)

1. Permisos en la base (`usuarios.perfil`, `usuarios.empresas`) y validados en el servidor; se
   eliminan las listas de correos y el código en el navegador.
2. Registro de actividad: cada descarga guarda quién descargó y la lista de personas.
3. Vista previa antes de descargar, con selección y descarga individual.
4. Periodos legibles («Septiembre 2026») y búsqueda por número de personal, RUT o nombre.

Además, sin cambio visible: consultas con parámetros (el antiguo era vulnerable a inyección SQL)
y el detalle en lote (el antiguo hacía una consulta de ~1 s por persona).

## Envío por correo (2026-10-05)

- Con aprobación de RR.HH.; el lote del mes anterior se prepara el día 5 (configurable).
- Clave del PDF: RUT completo sin dígito verificador (AES-256).
- Correo: **solo el personal** registrado en SAP (`correo_gmail`), nunca el corporativo (decisión
  del 2026-10-06, reemplaza a la de usar primero el corporativo). Si en ese campo hay un correo
  @flesan.cl, la persona queda sin correo. Septiembre de 2026: 1.724 de 1.731 personas con correo
  personal; 6 tienen un @flesan.cl en ese campo y 1 no tiene ninguno.
- Administrador de la plataforma: solo martin.norambuena@flesan.cl (`CIA_ADMIN_EMAILS`).
- Tope diario configurable (`ENVIO_MAX_DIA`, 1.500 por defecto) por el límite de Gmail.

## Queda fuera

- ZIP con un PDF por persona y el reemplazo de la dirección fija (propuestos, no aprobados).
- «Mis liquidaciones» para que cada colaborador vea las suyas (propuesta para después).

## Libro de remuneraciones (`libro_rem_g2`, 2026-10-06)

### Igual que el aplicativo antiguo

- Filtros: razón social, centro de costo, mes desde y hasta. El mes es el de **pago**
  (`fecha_de_pago`), no el periodo de nómina, aunque la lista de meses sale de los periodos.
- Roles (tabla `tabla_mantendor_rol_encargados_cc`, la misma de `libro_rem_dis` y `finiquito_rem`):
  - Administrador (1): todas las empresas, incluida NFG; la razón social es opcional.
  - RRHH (2): todas menos NFG; razón social obligatoria.
  - Administrativo RRHH (3) y Administrador OBRA (4): las personas cuyo CC actual (maestro) tiene
    su correo como encargado o visitador; razón social obligatoria; nunca NFG salvo la lista fija
    (ahora la marca `ve_nfg`); solo no planta si la última CC de esa empresa en su lista tiene
    `administrador = 'x'` y no es visitador; sin el personal de planta de los CC donde figura como
    `administrativo` sin `administrador`.
  - GGO (5): los CC donde su correo aparece en `correo_ggo` (coincidencia parcial, como el
    original: hay listas con comas faltantes); consulta propia que solo trae costo empresa.
  - Sin rol: sin acceso.
- Consultas: mismas columnas, cruces y agrupación que `class_libro_rem.php` (las tres variantes).
  Comparado el 2026-10-06 contra el original en más de 20 casos (los cinco roles, filtros de
  empresa y CC, rango de 9 meses con 15.312 filas): mismas filas, mismo orden y mismos valores.
- Excel: el de `export_excel_libro.php`. Hoja «libro_rem», logo en A1, títulos en A4:A6 (con el
  código de empresa y CC), encabezados grises en la fila 8 desde la columna B, solo los conceptos
  con algún valor (en el orden de la lista), bordes finos y `#,##0` en todos los conceptos.
  Se replican a propósito las conversiones de PHP: las horas extra pierden los decimales
  (37,04 → 37; decisión del 2026-10-06 de no corregirlo) y un texto como «2.5» quedaría 25.
- Quedan iguales la excepción del CC OYM0000755501 y el orden de las filas (el que daba la
  agrupación del original; ahora explícito).

### Mejoras aprobadas (2026-10-06)

1. Roles en la base: los 124 correos se copian a `usuarios.rol_remuneraciones`
   (`db/005_remuneraciones.sql`) y se administran en Configuración › Usuarios y roles. La lista
   fija de NFG pasa a `usuarios.ve_nfg` (solo manuel.hidalgo y yiturra tienen rol en los libros;
   los otros nueve de la lista no entran a los libros).
2. Registro de descargas: quién descargó el libro, con qué filtros, cuántas filas y personas.
3. Correos sin distinguir mayúsculas (RENE.GODOY@FLESAN.CL estaba en mayúsculas en la tabla de roles).

Además, sin cambio visible: consultas con parámetros (el antiguo armaba el SQL con texto del
navegador), permisos calculados en el servidor (el antiguo los mandaba en la URL; la razón social
de un encargado ahora tiene que ser una de las suyas), una sola pasada por la tabla de
liquidaciones (el antiguo calculaba costo empresa e imponible de toda la historia: ~14 s en la
base; ahora ~4 s un mes completo), la lista de empresas y CC de RR.HH. en ~3 s una vez por hora (el
antiguo, ~34 s cada vez que se abría la pantalla) y un Excel escrito por partes (15.000 filas en
~1,5 s y ~40 MB de memoria). Detalles de forma: meses legibles («Septiembre 2026») y, si no hay
filas, el aviso «Sin resultados» en vez de un Excel vacío.

### Queda fuera

- «Configurar Centros de Costos» (`repositorio_libro_rem.php`) sigue en el aplicativo antiguo:
  escribe en `tabla_encargados_cc`, de la base transaccional, que la plataforma solo lee.
- En el antiguo, cualquiera con rol Administrador podía agregar o quitar roles («Configurar Rol»);
  aquí lo hace un administrador de la plataforma en Usuarios y roles.
- El nombre del remitente de los correos de liquidaciones sigue en `SMTP_FROM_NAME` (`.env`).

## 2026-10-06 · Encargados de centros de costo administrados en la plataforma

- Regla: **todos ven exactamente lo mismo que en los aplicativos antiguos.**
- `flesan_rrhh.tabla_encargados_cc` se copia fiel (mismas 14 columnas y valores, mismo orden) a
  `cia_liquidaciones.encargados_cc` (db/006). Las consultas de Liquidaciones y de los libros son
  las originales; solo cruzan con la copia, que viaja a la consulta como un WITH
  (`lib/encargados-cc.ts`, `conEncargados`). Verificado persona por persona contra la tabla original.
- Se descartó un modelo simplificado («ve este CC» + una marca de planta): cambiaba lo que ven
  personas (los GGO habrían visto liquidaciones; Liquidaciones y el libro usan marcas de planta
  distintas; 592 filas calzan por el nombre del CC y no por el código).
- Se edita en Configuración › Usuarios y roles (columna «Centros de costo»), como «Configurar
  Centros de Costos» del PHP: asignar a una persona como encargado (columna correo) o visitador
  (reemplaza al anterior) o agregarla a la lista de GGO, o quitarla. ver_planta, administrador y
  administrativo no se editan (el PHP tampoco). Los PHP siguen con su tabla; ya no se sincronizan.
- «Empresas completas» (`usuarios.empresas`) solo aplica a Liquidaciones (perfil Jefatura); no
  cambia los libros.
- NFG ya no es del grupo: se quitó la marca «Ve NFG». Único cambio de visibilidad aprobado:
  manuel.hidalgo y yiturra dejan de ver NFG en los libros. La columna `usuarios.ve_nfg` queda sin uso.
- 2026-10-06: «Administrador OBRA» (rol 4) se unió a «Administrativo RRHH» (rol 3): en los tres PHP
  veían exactamente lo mismo (solo cambiaba la columna en que «Configurar Centros de Costos»
  dejaba a la persona). UPDATE en usuarios: 46 personas. El valor `administrador_obra` sigue siendo
  válido y se trata igual. Ningún texto de la plataforma menciona NFG.
