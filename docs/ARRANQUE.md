# Arranque de una plataforma nueva

> **Borrador para revisión (2026-10-01).** Todavía no existen el manifiesto `plataforma.config.ts`,
> el catálogo de datos ni el skill `/nueva-plataforma`: aquí se marcan como *(pendiente)*.

Esta lista se recorre **antes de escribir código**. Quien construya la plataforma, sea una persona
o una IA, **pregunta cada punto y no asume**. Lo que no se responda queda como «sin decidir» y
no se construye. Las respuestas se guardan en `docs/DECISIONES.md` de la plataforma nueva (y,
cuando exista, en `plataforma.config.ts`).

**Para una IA:**
- Pregunta bloque por bloque, en este orden, con las opciones a la vista.
- Si una respuesta choca con una regla escrita (este mockup, `CLAUDE.md`, `README.md`), dilo
  antes de seguir.
- Un módulo no se incluye «por si acaso»: sin un «sí» explícito, queda fuera.
- Al terminar, muestra el resumen del bloque I para que lo aprueben. Recién ahí se construye,
  partiendo por el análisis y 2-3 opciones de diseño.

---

## A. Identidad

- [ ] **Nombre de la plataforma**: texto normal más la palabra en rojo (ej. «Checklist
      **Contabilidad**»). Va en el sidebar y en la pestaña del navegador.
- [ ] **Slug**: minúsculas y guiones bajos (ej. `checklist_contabilidad`). De él salen el repo, el
      esquema `cia_<slug>` y el registro del buzón CIA. **No se cambia después.**
- [ ] **Para quién es**: área o áreas usuarias, y cuántas personas la usarán más o menos.
- [ ] **Quién la pidió y quién la aprueba** (dueño de negocio).
- [ ] **Qué problema resuelve**, en una frase. Si no cabe en una frase, falta definir.
- [ ] **¿La verá un usuario real, tocará QA o correrá en la VM?** Si la respuesta es no, es un
      prototipo: va en `proyectos/_prototipos/`, sin repo en la org.

## B. Naturaleza

Puede ser más de una. Define qué plantillas de pantalla se usan.

- [ ] **Reportería**: leer y analizar datos (tableros, KPIs, cruces).
- [ ] **Formularios**: ingresar o solicitar algo (una obra, una compra, un estado de pago).
- [ ] **Gestión**: mantener un registro vivo (listado, ficha, edición, estados). *(plantilla pendiente)*
- [ ] **Portal**: accesos y avisos hacia otras herramientas. *(plantilla pendiente)*
- [ ] **Proceso con flujo**: algo que pasa por etapas y personas (entrega, revisión, aprobación).

## C. Acceso y roles

- [ ] **¿Lleva login?** Sin login no hay campanita, buzón CIA ni preferencias que sigan al usuario.
- [ ] **Roles**:
  - `admin` / `member` por `CIA_ADMIN_EMAILS` (por defecto, sin tabla);
  - roles administrados desde Configuración (tabla `usuarios`);
  - roles propios (cuáles y qué puede hacer cada uno).
- [ ] **¿Hay datos que algunos no deben ver?** (por área, por obra, por persona). Define filtros
      por usuario desde el principio, no después.

## D. Datos

Regla fija: **la base transaccional se lee, nunca se escribe**. Lo que la plataforma escribe va en
su esquema propio `cia_<slug>` de QA, y todo SQL se muestra y aprueba antes de ejecutarlo.

- [ ] **Qué lee**: por cada fuente, desde el catálogo de datos *(pendiente; mientras tanto, a
      mano)*:
  - base (nombre de su `CONN_*`, nunca la credencial), esquema y tabla o vista;
  - qué representa una fila (ej. «una persona por contrato»);
  - cada cuánto se actualiza;
  - si tiene datos personales (RR.HH., RUT, nombres): no salen de la red interna.
- [ ] **Qué escribe**: lista de lo que se guarda (solicitudes, comentarios, estados…). Si es nada,
      la plataforma no necesita esquema propio.
- [ ] **Indicador de frescura** («Al día» en la barra): qué fuente y cada cuántas horas se espera.
      Sin cargas que refrescar, no se muestra.
- [ ] **Validación de estructura**: antes de construir, se confirma que tablas y columnas existen
      con una consulta de solo lectura a `information_schema`.

## E. Módulos

El núcleo va siempre (shell, marca, tokens, Configuración base, Mi personalización, desplegable
estándar, título fijo de la pestaña). Lo demás se elige: **sí / no / después**.

| Módulo | Para qué sirve | Necesita | Respuesta |
|---|---|---|---|
| Notificaciones (campanita) | Avisar a una persona algo que le toca | Login, tipos en `lib/notificaciones-plataforma.ts`, `db/003` | |
| Correos | Mandar por correo esas notificaciones | Notificaciones; cola de envío *(pendiente en el estándar)* | |
| Tutorial guiado | Recorrido por pantalla y por la plataforma | Pasos por pantalla (el general viene incluido) | |
| Avisos (franja) | Mensajes del administrador para todos | `db/002` | |
| Estado de los datos | «Al día / Atrasado» en la barra | Una fuente con fecha de carga | |
| Buzón CIA | Que el usuario escriba al equipo CIA | Login; token del slug en la central | |
| Presentaciones | Armar PDF o PowerPoint con vistas | `html-to-image`, `jspdf`, `pptxgenjs` | |
| Descarga a Excel | Bajar tablas con los filtros puestos | `exceljs` | |
| Registro de actividad | Quién hizo qué y cuándo | Tabla `registro_actividad` *(pendiente)* | |
| Fuentes de datos | Historial de cargas y recarga manual | Tablas `fuentes_datos`, `cargas_datos` *(pendiente)* | |
| Usuarios y roles | Administrar roles desde la plataforma | `db/001` | |

## F. Pantallas

Por cada pantalla, una fila. Si una pantalla no responde una pregunta concreta, sobra.

| Pantalla | Qué pregunta responde | Quién la usa | Plantilla | Fuentes |
|---|---|---|---|---|
| ej. Dotación | ¿Cuánta gente hay y cuánto rota? | Gerencia de Personas | Reporte Tipo 3 | Maestro de colaboradores |

Plantillas disponibles (ver `/pruebas` y `docs/REPORTES.md`):

- **Reporte Tipo 1**: resumen ejecutivo con filtros cruzados.
- **Reporte Tipo 2**: venta contra meta, con varias vistas.
- **Reporte Tipo 3**: stock y flujos (dotación, inventario).
- **Reporte Tipo 4**: drilldown por niveles.
- **Reporte Tipo 5**: ficha de una entidad.
- **Formulario Tipo 1**: una página.
- **Formulario Tipo 2**: por pasos.
- **Formulario Tipo 3**: con líneas (detalle editable).
- **Constructor de maquetas** (`/pruebas/maquetas`): para bocetear lo que no calza con ninguna.

## G. Despliegue

- [ ] **Dónde corre**: VM `servidor_flesan` (puerto libre a confirmar) u otro servidor.
- [ ] **Dominio** (ej. `<slug>.flesanmvi.com`) y si queda solo en la red interna.
- [ ] **Repo** en la org `flesanmvi-cl`, con este mockup como base.

## H. Lo que no se incluye

- [ ] Lista explícita de lo que se pidió o se consideró y **queda fuera** de esta versión, con
      el porqué. Evita que se agregue por defecto más adelante.

## I. Resumen para aprobar

Antes de construir, quien arma la plataforma entrega este resumen y espera el visto bueno:

```
Plataforma:   <Nombre> (<slug>) · para <áreas> · aprueba <dueño>
Naturaleza:   <reportería / formularios / gestión / portal / flujo>
Acceso:       <login sí/no> · roles <…>
Lee:          <fuente 1 (CONN_x · esquema.tabla · una fila por …)>, …
Escribe:      <nada | tablas en cia_<slug>: …>
Módulos:      sí <…> · no <…> · después <…>
Pantallas:    <n> — <pantalla: plantilla>, …
Despliegue:   <VM:puerto · dominio>
Queda fuera:  <…>
Sin decidir:  <…>
```

---

**Después del arranque:** se copia el mockup sin `/pruebas` ni el laboratorio, se aplican las
decisiones y se sigue «Crear una plataforma nueva» del `README.md`.
