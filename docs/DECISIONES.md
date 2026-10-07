# Decisiones — Remuneraciones SAP

Resumen de arranque (docs/ARRANQUE.md, bloque I) y lo decidido al migrar los aplicativos antiguos
de RR.HH. (PHP, controlflujo): `liquidaciones_sap_g2` (PHP + FPDF), `libro_rem_g2`, `libro_rem_dis`
(libro prorrateado) y `finiquito_rem` (los tres PHP + PhpSpreadsheet). La plataforma nació como
«Liquidaciones SAP» y desde el 2026-10-06 se llama «Remuneraciones SAP»: al entrar se elige el módulo.

```
Plataforma:   Remuneraciones SAP (liquidaciones) · para RR.HH. y jefaturas de obra
Naturaleza:   reportería (búsqueda + PDF, libros y finiquitos en Excel) y proceso con flujo (envío mensual con aprobación)
Acceso:       login Google · rol admin/member + perfil de liquidaciones rrhh / jefatura / sin_acceso
              + rol en los libros administrador / rrhh / administrativo_rrhh / administrador_obra / ggo
Lee:          DW flesan (DATABASE_URL, solo lectura): flesan_rrhh.sap_liquidaciones_grupo_flesan_g2
              (una fila por concepto, persona y periodo), sap_tabla_paso_liquidaciones,
              sap_maestro_colaborador, sap_maestro_historial_eventos, sap_maestro_cargos,
              sap_maestro_empresa_dep_un_cc, sap_maestro_ubicacion, sap_maestro_tipo_contrato,
              sap_maestro_clasificacion_gasto, cc_nomina, tabla_encargados_cc, public.maestro_rut,
              flesan_procesos.api_uf_utm; para el prorrateado, libro_rem_nuevo_g2, distribucion_sap
              y np_cc_nuevo; para finiquitos, sap_finiquito_grupo_flesan_g2 y sap_maestro_causales_terminos
Escribe:      cia_liquidaciones (QA srvpd_bd): usuarios, preferencias_usuario, avisos,
              registro_actividad, envio_configuracion, envio_lotes, envio_detalle
Módulos:      sí: avisos, buzón CIA, registro de actividad, usuarios y roles, correos
              no: notificaciones (campanita), presentaciones, estado de los datos, fuentes de datos
Pantallas:    Inicio (elegir módulo), Liquidaciones (filtros + vista previa + PDF), Envío por correo
              (programación + lotes), Envío de un periodo (revisión, prueba, aprobación, reenvío),
              Libro de remuneraciones (filtros + Excel), Libro prorrateado (filtros + Excel),
              Finiquitos (filtros + Excel de tres hojas)
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
- 2026-10-07, decisión del usuario: **la copia es la única fuente.** Ningún proceso vuelve a copiar
  desde `flesan_rrhh.tabla_encargados_cc` ni escribe en ella; lo que se cambie en el aplicativo
  antiguo no llega a la plataforma. Toda consulta que nombre la tabla original cruza con la copia
  (`conEncargados`, o `consultar()` de los libros, que lo hace solo).
- «Empresas completas» (`usuarios.empresas`) solo aplica a Liquidaciones (perfil Jefatura); no
  cambia los libros.
- NFG ya no es del grupo: se quitó la marca «Ve NFG». Único cambio de visibilidad aprobado:
  manuel.hidalgo y yiturra dejan de ver NFG en los libros. La columna `usuarios.ve_nfg` queda sin uso.
- 2026-10-06: «Administrador OBRA» (rol 4) se unió a «Administrativo RRHH» (rol 3): en los tres PHP
  veían exactamente lo mismo (solo cambiaba la columna en que «Configurar Centros de Costos»
  dejaba a la persona). UPDATE en usuarios: 46 personas. El valor `administrador_obra` sigue siendo
  válido y se trata igual. Ningún texto de la plataforma menciona NFG.

## Libro de remuneraciones prorrateado (`libro_rem_dis`, 2026-10-06)

### Igual que el aplicativo antiguo

- Datos: `flesan_rrhh.libro_rem_nuevo_g2`, una tabla que arma un proceso externo con el libro de
  remuneraciones de cada mes de pago (una fila por persona y mes, con los mismos montos del libro de
  remuneraciones). Cada fila se reparte entre los CC de la distribución de la persona en SAP
  (`distribucion_sap`, por NP y mes) o, si no tiene, va entera (100 %) a su CC del mes
  (`np_cc_nuevo`). Cada concepto se prorratea con `CEIL(monto × % / 100)`, también las horas extra
  (que así quedan redondeadas hacia arriba, no truncadas como en el otro libro); los días
  trabajados, sin redondear.
- Filtros: razón social (la de la persona), centro de costo (el de la distribución), mes desde y
  hasta (mes de pago). Los meses son los periodos de nómina hasta el mes anterior, con la fecha de Chile.
- Roles (`usuarios.rol_remuneraciones`, el mismo de los otros libros):
  - Administrador: todas las empresas; la razón social es opcional.
  - RRHH: todas menos NFG; razón social obligatoria.
  - GGO: los CC de la distribución cuyo nombre está en una fila de la tabla de encargados con su
    correo en `correo_ggo` (coincidencia parcial, como el original), con **todos** los conceptos (en
    el libro de remuneraciones el GGO ve solo el costo empresa).
  - Administrativo RRHH y Administrador OBRA: sin acceso (ver decisiones).
- Listas de empresas y CC: las tres del original (getCentrosGestion1 para Administrador y RRHH,
  getCentrosGestion2 para quien figura como GGO y la de encargado para el resto), solo CC de Chile.
  Las empresas van en el orden del antiguo (el de la consulta, por nombre del CC).
- Consulta: mismas columnas, cruces, agrupación y orden que `class_libro_rem_dist.php`. Comparado
  el 2026-10-06 contra el original en 120 casos (Administrador con cada empresa y CC, RRHH con cada
  empresa, los 17 GGO con y sin empresa y CC, listas de las 18 personas GGO, meses, rangos de 3 a 21
  meses con hasta 18.759 filas): mismas filas, orden y valores, salvo la corrección del GGO.
- Excel: el de `libro_rem_dist_excel.php`. Hoja «libro_rem»; logo «Grupo Flesan» en A1:C3
  combinadas (filas de 25 puntos; imagen de 100 px de alto corrida 80 × 10 px); en A4 «Informe de
  Costos Distribuido Septiembre 2026» (o «… Enero 2026 a Septiembre 2026»), con «Preliminar»
  mientras la fecha de hace un mes no pasa del día 10 del mes hasta; en A5:A6 el código de empresa
  y CC; encabezados grises en la fila 8 desde la columna B, con DIAS TRABAJADOS, PORCENTAJE
  PRORRATEO, CLASIFICACION DE GASTO, AMES y PLANTA; solo los conceptos con algún valor (109
  posibles, en el orden y con los títulos del original, incluido «COTIZACION SALud»); COSTO EMPRESA
  suma las vacaciones proporcionales; bordes finos y `#,##0` en los conceptos. Comparado celda a
  celda con lo que escribe el PHP (tres casos, hasta 4.378 filas).

### Decisiones (2026-10-06)

1. Administrativo RRHH (88 personas, incluidos los ex «Administrador OBRA») y tchahuan@dvc.cl
   siguen sin el prorrateado: en el antiguo su consulta nombraba la tabla de encargados sin
   cruzarla (error «missing FROM-clause entry»), siempre recibían «LA OBRA NO TIENE TRABAJADORES»,
   y nadie debe cambiar lo que ve. Darles sus centros se puede evaluar después, persona por
   persona. La excepción de tchahuan@dvc.cl (GGO) está en `lib/libro-prorrateado/tipos.ts`.
2. GGO: cada persona cuenta una vez. El original cruzaba con la tabla de encargados (INNER JOIN) y
   los 11 CC ACA110xxx que están dos veces en ella (Andes Siete y Flesan Anclajes) les salían con
   días y montos al doble a jorge.miranda y renato.zamora (septiembre de 2026: 10 personas; enero a
   septiembre, 64 y 65 filas). Ahora coinciden con lo que ve RR.HH.
3. El archivo se sigue llamando «Libro_remuneraciones.xlsx» (el nombre con que lo guardaba el
   navegador; se descartó agregar «prorrateado» y la fecha).

### Mejoras (las aprobadas para el libro de remuneraciones)

- Roles en la base y permisos calculados en el servidor (el antiguo los mandaba en la URL),
  consultas con parámetros, registro de cada descarga («Descargó el libro prorrateado», con filtros,
  filas y personas), meses legibles y el aviso «Sin resultados» en vez de un Excel con «LA OBRA NO
  TIENE TRABAJADORES».

Además, sin cambio visible: viaja solo lo que el Excel usa. La consulta original calculaba 34
columnas que el Excel nunca mostraba y mandaba cada concepto por separado (8 de cada 10 en cero);
ahora van juntos y solo los distintos de cero. La base resuelve un mes en ~0,3 s y lo que demora es
traer las filas: desde la oficina, un mes completo ~2,8 s en vez de ~3,7 s y nueve meses ~21 s en
vez de ~39 s. Para GGO, la consulta original contra la copia de encargados llegaba a tardar
minutos; la nueva, segundos. La lista de empresas de Administrador y RRHH (recorre toda la tabla de
liquidaciones) se guarda una hora y el Excel se escribe por partes, como el del libro.

## Finiquitos (`finiquito_rem`, 2026-10-07)

### Igual que el aplicativo antiguo

- Datos: `flesan_rrhh.sap_finiquito_grupo_flesan_g2`, una fila por concepto, persona y semana de pago,
  como la tabla de liquidaciones (desde julio de 2026; ~7.000 filas en octubre).
- Filtros: razón social y centro de costo (los del finiquito) y semana de pago desde y hasta. Las
  semanas son las de la tabla, del periodo de la marca y la semana de SAP («Septiembre 2026 Semana 3»;
  por dentro, «202609Semana 3»), y se comparan como texto con el mes de pago y la semana de cada fila.
  La razón social es opcional para todos los roles (en el antiguo esa validación estaba comentada).
- Roles (`usuarios.rol_remuneraciones`, el mismo de los libros):
  - Administrador: todas las empresas.
  - RRHH: todas menos NFG (hoy no hay finiquitos de NFG).
  - Administrativo RRHH y Administrador OBRA: las personas cuyo CC actual (maestro) tiene su correo
    como encargado o visitador; nunca NFG; sin el personal de planta de los CC donde figura como
    `administrativo` sin `administrador`. El «solo no planta» del libro no existe aquí: el antiguo
    nunca llenaba ese dato.
  - GGO: sin acceso (ver decisiones), salvo tchahuan@dvc.cl: las personas de los CC donde figura
    como GGO, por una rama propia del antiguo.
- Listas de empresas y CC: Administrador y RRHH, la de getCentrosGestion1 (la empresa y el CC actuales
  de quien tiene algún finiquito; una entrada por código y nombre de la empresa del finiquito, y se
  filtra por el código); el resto, las mismas listas del libro de remuneraciones (el PHP las copiaba
  tal cual). Sin lista, los filtros se muestran solo a quien es encargado de algún CC o figura como GGO.
- Consultas: mismas columnas, cruces, agrupación y orden que `class_finiquito_rem.php` para las tres
  hojas (getLibroREMvalidacion/p2/p3 y getLibroREM/p22/p33; el detalle de RRHH y encargados además
  separa por área de nómina). El orden es el que daba la agrupación del original, ahora explícito.
  Comparado el 2026-10-07 contra el original en 399 casos (Administrador con cada semana, empresa y
  CC; RRHH con cada empresa; los 88 Administrativo RRHH con y sin empresa y CC; tchahuan@dvc.cl; los
  17 GGO; las listas de empresas y CC de las 107 personas con rol; las semanas): mismas filas, orden y
  valores, salvo lo de abajo. Además, con una copia de encargados modificada solo en memoria, los CC de
  «administrativo» sin planta (incluido un centro nulo), un visitador dentro de una lista y la rama
  de tchahuan@dvc.cl.
- Excel: el de `export_excel_finiquito.php`. Tres hojas sin cuadrícula: «Finiquito_rem» (las columnas
  fijas con algún dato, los conceptos con algún valor en el orden de la lista —las cantidades de horas
  sin formato de miles—, AMES y SEMANA), «RESUMEN FINIQUITOS» (una fila por persona, CC y semana, con
  el líquido a pago) y «RESUMEN OBRA» (el líquido a pago por empresa, CC y semana). En cada una: logo en
  A1:C3, título en A4, empresa y CC en A5:A6, encabezados grises en la fila 8 desde la columna B y
  bordes finos. Se replican las conversiones de PHP (las horas extra pierden los decimales). Comparado
  celda a celda con lo que escribe el PHP en cinco casos (hasta 520 filas). El archivo se sigue
  llamando «Finiquito_remuneraciones.xlsx» (el nombre con que lo guardaba el navegador).

### Decisiones (2026-10-07)

1. GGO sin finiquitos (17 personas): en el antiguo su Excel llamaba a una función que no existe
   (getLibroREMvalidacionp3ggo) y se descargaba un archivo dañado. tchahuan@dvc.cl mantiene su acceso:
   su correo iba por otra rama que sí funcionaba (hoy sin filas). La excepción está en
   `lib/finiquitos/tipos.ts`.
2. Título de la primera hoja corregido: el antiguo buscaba el mes en los dos últimos caracteres de la
   semana y salía «Finiquito Remuneraciones  2026» (sin mes). Ahora «Finiquito Remuneraciones Septiembre
   2026 Semana 1» o «… Agosto 2026 Semana 4 a Septiembre 2026 Semana 3», con «Preliminar» hasta el día
   10 del mes siguiente al de «hasta», como el libro prorrateado.
3. Cada persona cuenta una vez: el original cruzaba con la tabla de encargados (49 CC repetidos, hasta
   tres veces) y multiplicaba los montos de quien tuviera uno de esos CC. Hoy no afecta a ningún finiquito.

Por la mejora de los libros «correos sin distinguir mayúsculas», rene.godoy@flesan.cl (en mayúsculas en
las tablas antiguas; en el PHP no tenía rol) ve los 4 finiquitos de la obra San Gerónimo I, donde es
visitador, como ya la ve en el libro de remuneraciones.

### Mejoras (las aprobadas para los libros)

- Roles en la base y permisos calculados en el servidor (el antiguo los mandaba en la URL), consultas
  con parámetros, registro de cada descarga («Descargó los finiquitos», con filtros, filas y personas),
  semanas legibles y el aviso «Sin resultados» en vez de un Excel con «LA OBRA NO TIENE TRABAJADORES
  FINIQUITADOS».

Además, sin cambio visible: viaja solo lo que el Excel usa (la consulta original calculaba 35 columnas
que el Excel nunca mostraba), las tres hojas se piden a la vez, el costo empresa y el imponible se
calculan solo para los meses elegidos y la búsqueda de los CC de «administrativo» va en la misma
consulta. Todo el periodo (520 filas) ~2 s desde la oficina.
