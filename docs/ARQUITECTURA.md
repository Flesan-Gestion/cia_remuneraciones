# Arquitectura — Remuneraciones SAP

Referencia técnica para quien vaya a tocar backend/datos/auth de este proyecto. Para stack y cómo
correr el proyecto, ver el [`README.md`](../README.md); lo decidido al migrar los aplicativos
antiguos está en [`DECISIONES.md`](DECISIONES.md).

## Modelo de datos

**Lectura** (`DATABASE_URL`, `lib/db.ts`, base `flesan` del DW): las tablas de RR.HH. que usaban
`liquidaciones_sap_g2` y `libro_rem_g2`. Las consultas están en `lib/liquidaciones/consultas.ts` y
`lib/libro/consultas.ts`, portadas desde el PHP con las mismas reglas. La tabla de liquidaciones
(~5 millones de filas) no tiene índices y la base es Postgres 10: el detalle se pide en lote, con
`WITH` (Postgres 10 los calcula una vez) y `enable_nestloop = off` solo en esa transacción, porque
el planificador subestima los `WITH`. La consulta del libro además sube `work_mem` a 32 MB en su
transacción (la base trae 1,5 MB y ordenaba en disco).

**Escritura** (`DATABASE_URL_PLATAFORMA` + `ESQUEMA_PLATAFORMA=cia_liquidaciones`, QA `srvpd_bd`):

| Archivo | Tablas |
|---|---|
| `db/001_usuarios_roles.sql` | `usuarios` (rol admin/member) |
| `db/002_configuracion.sql` | `preferencias_usuario`, `avisos` |
| `db/004_liquidaciones.sql` | `usuarios.perfil` y `usuarios.empresas`, `registro_actividad`, `envio_configuracion`, `envio_lotes`, `envio_detalle`; además migra las listas de correos del aplicativo antiguo |
| `db/005_remuneraciones.sql` | `usuarios.rol_remuneraciones` y `usuarios.ve_nfg`; copia los 124 roles de `flesan_rrhh.tabla_mantendor_rol_encargados_cc` |

### SQL aplicado en QA

| Archivo | Esquema | Fecha |
|---|---|---|
| `db/001_usuarios_roles.sql` | `cia_liquidaciones` | 2026-10-06 |
| `db/002_configuracion.sql` | `cia_liquidaciones` | 2026-10-06 |
| `db/004_liquidaciones.sql` | `cia_liquidaciones` | 2026-10-06 |
| `db/005_remuneraciones.sql` | `cia_liquidaciones` | 2026-10-06 |

Sin `db/005` aplicado nadie entra al libro (la columna no existe: `resolverAccesoLibro` responde
sin acceso) y Usuarios y roles muestra la columna de libros deshabilitada.

`db/003_notificaciones.sql` (campanita) no se aplica: la plataforma no usa notificaciones.

## Autenticación y autorización

Auth.js v5 heredado de `servicios-compartidos/login-estandar/nextjs` (plantilla compartida de
login CIA):

- **`auth.config.ts`** (edge-safe): provider Google, callback `signIn` rechaza emails fuera de
  `CIA_ALLOWED_DOMAINS`. `pages.signIn`/`pages.error` → `/login`.
- **`auth.ts`** (runtime Node, importa `auth.config.ts`): resuelve el rol en el callback
  `session` (no `jwt`, para que un cambio de rol tenga efecto sin re-login) — si el email está en
  `CIA_ADMIN_EMAILS` → `role: "admin"`; si no, busca el rol en `cia_liquidaciones.usuarios` vía
  `lib/usuarios-db.ts`; sin fila o sin base, queda `"member"` (ver `lib/roles.ts`).
- **`middleware.ts`**: protege *todas* las rutas excepto `api/auth/*`, `api/health`, `/login`,
  estáticos de Next y `/brand/*`. Sin sesión, redirige a `/login?callbackUrl=<ruta original>`.
- Secciones `adminOnly` (ver `lib/nav.ts` y `app/(dashboard)/configuracion/layout.tsx`): el gate
  vive en un `layout.tsx` propio de la sección, no en el middleware, porque necesita el rol ya
  resuelto en la sesión (el middleware corre en Edge y no puede consultar BBDD).
- **Gestión de usuarios** (`/configuracion/usuarios`, solo `adminOnly`): asigna/revoca el rol
  `admin`/`member` de cualquier colaborador de Flesan, buscándolo en el maestro corporativo
  (`lib/colaboradores-db.ts` + `maestro_colaborador.sql`) y persistiendo en la tabla de arriba.
  Requiere `DATABASE_URL` — sin BBDD, el rol solo se administra por `CIA_ADMIN_EMAILS`.
- Cierre de sesión: Server Action `cerrarSesion()` en `lib/auth-actions.ts`.
- Si la plataforma necesita más de 2 roles (más allá de `admin`/`member`) o alcance granular por
  usuario (ej. acceso solo a un subconjunto de proyectos/empresas), extiende `Rol` en
  `lib/roles.ts` y `lib/usuarios-db.ts` — `plataforma_auditorias` (3 roles) y
  `seguimiento_proyectos_fai` (roles + acceso por proyecto) lo hicieron así y sirven de
  referencia.
- **Bypass de desarrollo**: `AUTH_DISABLED=true` (+ `DEV_ROLE=admin|member` opcional) en `.env`
  hace que `auth()` devuelva una sesión falsa y que `middleware.ts` no redirija a `/login` —
  pensado para iterar rápido en local/VM de pruebas sin pasar por Google. Solo tiene efecto si
  `NODE_ENV !== "production"`; en un build de producción se ignora aunque el `.env` lo traiga.

## API routes

| Ruta | Método | Qué hace |
|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | Handlers estándar de Auth.js. |
| `/api/health` | GET | Healthcheck de Docker, sin auth. |
| `/api/feedback` | POST | BFF del widget CIA — reenvía el feedback del usuario autenticado al servicio central. |
| `/api/feedback/mios` | GET | BFF del widget CIA — lista el feedback enviado por el usuario actual. |
| `/api/configuracion/usuarios` | GET, POST | `adminOnly` — lista y asigna/actualiza rol de usuarios (requiere `DATABASE_URL`). |
| `/api/configuracion/usuarios/[correo]` | DELETE | `adminOnly` — revoca el rol administrado (vuelve al default `member`). |
| `/api/configuracion/colaboradores` | GET | `adminOnly` — busca colaboradores en el maestro corporativo para asignarles rol. |

| `/api/liquidaciones/filtros` | GET | Empresas y CC que el usuario puede ver, y periodos con datos. |
| `/api/liquidaciones/buscar` | POST | Vista previa: liquidaciones que calzan con los filtros (con RUT, CC y líquido). |
| `/api/liquidaciones/pdf` | POST | PDF de las claves elegidas; recalcula el permiso con los filtros y registra la descarga. |
| `/api/envios` | GET, POST | Solo RR.HH. — programación y lotes; preparar un lote a mano. |
| `/api/envios/configuracion` | PUT | Solo RR.HH. — día del mes y si se prepara solo. |
| `/api/envios/[id]` | GET, POST | Solo RR.HH. — un lote; aprobar, cancelar, pausar, reanudar, reintentar errores, prueba. |
| `/api/envios/[id]/detalle/[detalleId]` | POST | Solo RR.HH. — excluir, incluir o reenviar a una persona. |
| `/api/configuracion/actividad` | GET | `adminOnly` — registro de actividad. |
| `/api/libro/filtros` | GET | Rol en los libros, empresas y CC que puede elegir, y periodos. |
| `/api/libro/excel` | POST | Excel del libro; calcula el alcance del rol en el servidor y registra la descarga. |

## Perfiles de acceso a las liquidaciones

`lib/liquidaciones/acceso.ts` lee `usuarios.perfil` del esquema propio: `rrhh`, `jefatura` (sin
fila) o `sin_acceso`. Si la base o la tabla no responden, el perfil es `sin_acceso`. El perfil va
en `UsuarioActual.perfil` para el menú (`perfiles` en `lib/nav.ts`), y cada API y layout lo vuelve
a validar. En desarrollo, `DEV_EMAIL` y `DEV_PERFIL` simulan a una persona (solo con
`AUTH_DISABLED=true`).

## Rol en los libros y finiquitos

`lib/libro/acceso.ts` lee `usuarios.rol_remuneraciones` y `usuarios.ve_nfg`: los cinco roles de
los aplicativos antiguos (`lib/libro/tipos.ts`), independientes del perfil de liquidaciones. Sin
fila o sin rol: sin acceso. Sirve para el libro de remuneraciones y servirá para el libro
prorrateado y finiquitos, que usaban la misma tabla de roles. El menú filtra con un solo texto de
perfil: el layout le pasa `perfilMenu()` (`lib/nav.ts`), el perfil de liquidaciones más
«+libros» si tiene rol. En desarrollo, `DEV_ROL_LIBRO` simula un rol (solo con `AUTH_DISABLED=true`).

## Libro de remuneraciones

`lib/libro/consultas.ts` (consultas), `lib/libro/conceptos.ts` (las 114 columnas posibles, en el
orden del Excel antiguo) y `lib/libro/excel.ts` (el Excel).

1. Una sola pasada por la tabla de liquidaciones (`liq`): las filas pagadas en el rango y las del
   imponible cuya marca cae en el rango. `fecha_de_pago` es texto («Mon Sep 28 00:00:00 CLST
   2026»): el mes y el año del texto descartan las demás filas antes de convertirlas a fecha.
2. Costo empresa (`cc_nomina`) e imponible (tope 81,6 UF de `api_uf_utm`) solo del rango.
3. `pre` suma cada concepto por persona, mes, CC y área de nómina sin cruzar nada; después se
   cruza con el maestro y se agrupa con las mismas columnas del original (y en el mismo orden).
4. Tres variantes, como el PHP: Administrador (todo), GGO (solo costo empresa) y el resto (RRHH
   sin NFG; encargados con su filtro de CC, no planta y NFG).
5. El Excel lo escribe `lib/exportar/xlsx-servidor.ts`: un .xlsx mínimo (una hoja, logo, cinco
   estilos) que se comprime a medida que se escriben las filas. ExcelJS en memoria necesitaba
   ~2 GB para un libro de 15.000 filas; así son ~40 MB.

La lista de empresas y CC de Administrador y RRHH recorre la tabla de liquidaciones completa: se
guarda una hora en memoria, igual que los periodos (compartidos con liquidaciones).

## Envío por correo

`lib/liquidaciones/envios.ts` (lógica), `envios-db.ts` (tablas), `programador.ts` (arranca desde
`instrumentation.ts`) y `correo.ts` (textos).

1. El día configurado (hora de Chile), si el periodo anterior no tiene lote, se prepara uno con una
   fila por persona y se avisa a quienes tienen perfil RR.HH. Un lote cancelado no se vuelve a
   preparar solo.
2. RR.HH. revisa, excluye, prueba con su correo y aprueba. Nada sale antes.
3. El proceso envía de a 25 con pausa entre correos y un tope diario (`ENVIO_MAX_DIA`); las filas
   se toman con `FOR UPDATE SKIP LOCKED` para que nadie envíe dos veces. Si el servidor se
   reinicia, lo que quedó «enviando» pasa a error («revisar si llegó») y no se reenvía solo.
4. Cada persona recibe un PDF con todas sus liquidaciones del periodo (normal y fuera de ciclo),
   cifrado AES-256 con su RUT sin dígito verificador como clave.

Solo la instancia de producción lleva `ENVIO_HABILITADO=true` (prepara y envía): dev y producción
comparten la base de QA.

## Widget de feedback CIA

`app/layout.tsx` carga un Web Component externo (`<cia-feedback>`, Shadow DOM) que muestra el
badge "Desarrollado por CIA" + un buzón de sugerencias. Es compartido entre todas las plataformas
CIA — el código fuente vive en el repo hermano `servicios-compartidos`
(`servicios/widget-cia/` + `servicios/feedback-api/`), no en este proyecto.

Patrón BFF: el widget hace `fetch` same-origin a `/api/feedback` (este proyecto, con la sesión del
usuario), y ese route handler reenvía al servicio central con `CIA_SERVICE_TOKEN` vía header
`X-CIA-Service-Token`.

**Antes de ir a producción**: reemplaza `data-plataforma="nombre-plataforma"` en `app/layout.tsx`
por el slug real de esta plataforma, y coordina con el equipo CIA para registrar
`<slug>:<token>` en `CIA_SERVICE_TOKENS` del `feedback-api` central — si no, el widget se ve pero
el envío de feedback falla en silencio.

## Docker

`Dockerfile` multi-stage (deps → builder → runner), output `standalone` de Next
(`next.config.ts`), usuario no-root, healthcheck contra `/api/health`. `docker-compose.yml` levanta
solo el servicio `web`; si la plataforma necesita Postgres u otro servicio, agrégalo ahí.

## Estado conocido / pendientes

- `npm run dev` / `npm run start` pasan por `scripts/next.mjs`, que agrega `--use-system-ca`
  (certificados de Windows) solo si la versión de Node lo admite (22.15+); en Node 20 corre sin él.
- Falta el Client ID de Google (`AUTH_GOOGLE_ID/SECRET`) y el puerto de la VM.
- En desarrollo (`AUTH_DISABLED=true`) la sesión es `DEV_EMAIL`, y lo que se haga queda en el
  registro de actividad a ese nombre: debe ser el correo de quien prueba. `DEV_PERFIL=rrhh` da el
  perfil RR.HH. solo en desarrollo.
- El 2026-10-06 se preparó a mano, para probar, el lote de septiembre 2026 (id 1, 1.731 personas)
  y se canceló el mismo día; el usuario lo vuelve a preparar desde la plataforma.
- Riesgo latente heredado: `sap_maestro_empresa_dep_un_cc` (CC 10000222) y `sap_maestro_ubicacion`
  (3 códigos) tienen filas duplicadas; el detalle duplicaría montos de quien esté en ellos. Hoy no
  afecta a nadie (CC inactivo y ubicaciones de Perú y NFG).
