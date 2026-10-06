# Shell estándar de las plataformas

El «shell» es el marco común de todas las plataformas de la CIA que nacen de este mockup:
sidebar, barra superior, navegación, escala fluida, densidad compacta, tokens de marca y los
componentes del marco (acceso a portales, estado de los datos, pantalla completa, Personalizar).
El contenido de cada plataforma (pantallas, gráficos, datos) no es parte del shell.

Versión vigente: **shell-v1.1** (en preparación; `VERSION_SHELL` en `lib/nav-base.ts`). La anterior, `shell-v1`, es la que tienen hoy las plataformas migradas.

## Archivos del shell (se copian tal cual, no se editan por plataforma)

| Archivo | Qué es |
|---|---|
| `app/shell.css` | Tokens `@theme`, escala fluida, densidad, clases base (`.btn-flesan`, `.card`…), portales, estado de los datos |
| `app/(dashboard)/loading.tsx` | Pantalla de carga al navegar |
| `app/fonts/**` (Barlow, Barlow Condensed, Barlow Semi Condensed, Inter Tight) | Fuentes auto-hospedadas |
| `components/app-shell.tsx` | Marco: sidebar + barra superior + contenido |
| `components/sidebar.tsx` | Sidebar con menú flotante, pie con Configuración, colapsar y usuario |
| `components/topbar.tsx` | Barra superior: ruta de migas, estado de los datos, pantalla completa |
| `components/user-menu.tsx` | Tarjeta de usuario y su menú (tema, Personalizar, cerrar sesión) |
| `components/theme-toggle.tsx` | Claro / oscuro |
| `components/pantalla-completa.tsx` | Pantalla completa para reportería |
| `components/estado-datos.tsx` | Indicador de frescura de los datos |
| `components/notificaciones/*`, `lib/notificaciones-db.ts`, `lib/notificaciones-tipos.ts`, `app/api/notificaciones/*`, `app/(dashboard)/notificaciones/` | Campanita de la barra superior (panel con las últimas 10, primero las no leídas), bandeja `/notificaciones` y su API. Tabla en `db/003_notificaciones.sql`; sin ella, datos de ejemplo. Solo aparece con sesión y si la plataforma declara tipos |
| `components/tutorial/tutorial.tsx`, `components/tutorial/recorrido-plataforma.ts` | Tutorial guiado (origen: eerr_gestion). El birrete «Tutorial» del pie del sidebar está en todas las pantallas: si la pantalla declaró su recorrido con `useTutorial(pasos)` lo muestra y al final ofrece el de la plataforma; si no, muestra el de la plataforma (menú, ruta, estado de datos, campanita, buzón, pantalla completa, Configuración). La primera vez que se entra a una pantalla con recorrido, o a Inicio, se ofrece con una tarjeta junto al birrete (nunca se abre solo; «Ahora no» o «No volver a ofrecer»). Cada paso ilumina un `data-tutorial`, un `data-bloque` o un `data-grupo`. Se apaga en Mi personalización › Ayuda. En desarrollo avisa en consola si un paso no encuentra su zona. Recorridos de ejemplo en todos los Reportes Tipo (`components/pruebas/tutoriales.ts`, `personas/tutorial.ts`) y Formularios Tipo |
| `components/desplegable.tsx` | Desplegable estándar (reemplaza a todo `<select>`): selección única o múltiple con casillas; variantes filtro, píldora, campo y libre; lista en portal con check rojo y buscador desde 12 opciones |
| `components/personalizar.tsx`, `components/preferencias.ts` | «Mi personalización» (tema, tamaño, densidad, animaciones, portales) y cómo se aplican las preferencias |
| `app/(dashboard)/configuracion/personalizacion/page.tsx` | Ruta de Mi personalización (abierta a todos) |
| `components/mis-comentarios.tsx`, `app/(dashboard)/configuracion/comentarios/page.tsx` | Mis comentarios (lee `/api/feedback/mios`, servicio central de feedback) |
| `app/(dashboard)/configuracion/acerca/page.tsx` | Acerca de: versión (package.json) y `VERSION_SHELL` |
| `components/preferencias-sync.tsx`, `lib/configuracion-db.ts`, `app/api/configuracion/preferencias/route.ts` | Guarda Mi personalización en `preferencias_usuario` (si la tabla existe; si no, queda en el navegador) |
| `components/avisos.tsx`, `app/api/avisos/route.ts`, `app/api/configuracion/avisos/**`, `app/(dashboard)/configuracion/avisos/*` | Franja de avisos y Configuración › Avisos (solo admin): crear y terminar, sin borrar |
| `components/configuracion/*`, `app/(dashboard)/configuracion/(admin)/{usuarios,fuentes-datos,actividad,notificaciones}` | **Maquetas** (datos de ejemplo, sin base) de Usuarios y roles (tabla con el rol editable en la fila, «Agregar usuario» en panel lateral y al menos un administrador siempre; la versión conectada a la base es `usuarios/usuarios-client.tsx`), Fuentes de datos, Registro de actividad y Notificaciones y correos; se conectan a sus tablas cuando se definan |
| `components/comentarios/*` | Botón de comentarios CIA (burbuja por defecto, pestaña lateral o en la barra; se elige en Mi personalización). Reemplaza al `<cia-feedback>` central dentro del dashboard; usa `/api/feedback` y `/api/feedback/mios` |
| `components/portales/*` | Acceso a Portal CIA / SAP Work Zone (lengüeta, media luna, cinta, burbuja) |
| `components/reporte/*` | Piezas del Reporte Tipo 1 (KPI principal, dona con leyenda, pirámide, barras apiladas, filtros cruzados, celdas de tabla). Sus estilos `.rep-*` y la paleta `--color-serie-*` están en `app/shell.css`. Receta en `docs/REPORTES.md` |
| `components/breadcrumb-context.tsx` | Niveles de drilldown en la ruta de migas |
| `components/cia-logo.tsx` | Símbolo CIA |
| `components/section-tabs.tsx`, `components/page-header.tsx` | Pestañas de sección y encabezado de página |
| `lib/nav-base.ts` | Tipos y funciones de navegación (`isNavActive`, `gruposDe`, `crearMigas`…) |
| `lib/cn.ts` | `cn()` (clsx + tailwind-merge) |

Dependencias npm: `clsx`, `tailwind-merge`, `lucide-react`, `next-themes`, `pg`.

Variables de entorno de Configuración: `DATABASE_URL_PLATAFORMA` (base de QA propia) y `ESQUEMA_PLATAFORMA` (`cia_<slug>`). Sin ellas, Mi personalización queda solo en el navegador y no hay avisos.

## Archivos de cada plataforma (se adaptan)

| Archivo | Qué define |
|---|---|
| `lib/nav.ts` | `NOMBRE_PLATAFORMA` (también el título de la pestaña del navegador, fijo en `app/layout.tsx`: las páginas no definen `metadata.title`), `NAV_ITEMS` (menú), `NAV_CONFIG` (Configuración, en el pie: con `adminOnly: true` solo la ven administradores; sin él, la ven todos y cada hijo puede ser `adminOnly`), `migasDe`. Un ítem o subpanel con `perfiles: ["gerencia"]` solo lo ve quien tenga ese perfil (ver Perfiles). Reexporta `lib/nav-base.ts` |
| `lib/notificaciones-plataforma.ts` | Tipos de notificación de la plataforma (etiqueta, ícono y color) y sus datos de ejemplo. Vacío = sin campanita. Se emiten con `crearNotificacion()` de `lib/notificaciones-db.ts` |
| `components/modulos.tsx` | Módulos opcionales enchufados al shell (ej. Presentaciones). Sin módulos: versión mínima abajo |
| `lib/estado-datos.ts` | `obtenerEstadoDatos()` (fuente real de la fecha) y `CADA_HORAS`. Sin datos que refrescar: devolver `null` |
| `app/globals.css` | `@import "tailwindcss"; @import "./shell.css";` y luego lo propio de la plataforma |
| `app/layout.tsx` | Fuentes (`next/font/local`, con `--font-inter-tight`), metadata, ThemeProvider |
| `app/(dashboard)/layout.tsx` | Sesión y providers propios, y `<AppShell>` alrededor de `children` |

El shell además espera que la plataforma tenga (todas las derivadas del mockup ya los tienen):
`components/user-context.tsx` (`useUsuarioActual`), `lib/roles.ts` (`esAdmin`, `etiquetaRol`, `Rol`)
y `lib/auth-actions.ts` (`cerrarSesion`).

### `components/modulos.tsx` mínimo (sin módulos opcionales)

```tsx
"use client";

import type { ReactNode } from "react";

// PLATAFORMA · módulos opcionales enchufados al shell. Esta plataforma no usa ninguno.
export function ModulosProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function useVistaEspecialModulos(_children: ReactNode): ReactNode | null {
  return null;
}
export function BotonesBarraModulos() {
  return null;
}
export function OpcionesUsuarioModulos() {
  return null;
}
export function SuperposicionesModulos() {
  return null;
}
export function PersonalizacionModulos() {
  return null;
}
```

## Módulos opcionales

- **Presentaciones** (armar PDF / PowerPoint con vistas): `components/presentaciones/*`,
  `lib/presentaciones/*`, `app/(dashboard)/configuracion/presentaciones/page.tsx` (se activa y
  administra en Configuración, abierta a todos), el bloque «MODO DIAPOSITIVA»
  de `app/globals.css`, el ítem en `NAV_ITEMS` y la versión de `components/modulos.tsx` de este
  repo. Dependencias: `html-to-image`, `jspdf`, `pptxgenjs` (y el reemplazo de `node:` en
  `next.config.ts`). En revisión; por ahora no se instala en las plataformas.
- **Descarga a Excel**: `lib/exportar/excel.ts`, `components/boton-excel.tsx`. Dependencia: `exceljs`.

## Cómo aplicar el shell a una plataforma

1. Rama `estandar-shell-v1` en la plataforma.
2. Copiar los archivos del shell (tabla de arriba).
3. Convertir su menú a `lib/nav.ts` (sacar Configuración de `NAV_ITEMS` a `NAV_CONFIG`) y poner su nombre.
4. Crear `components/modulos.tsx` (mínimo) y `lib/estado-datos.ts` (su fuente real, o `null`).
5. `app/globals.css`: dejar solo lo propio después de `@import "./shell.css"`.
6. `app/(dashboard)/layout.tsx`: usar `<AppShell>`; borrar el sidebar/topbar viejos si quedaron sin uso.
7. `npx tsc --noEmit`, lint y revisar en Chrome (claro, oscuro, sidebar colapsado).

## Perfiles (opcional)

Una plataforma con públicos distintos (ej. gerencia y vendedor en seguimiento_ventas_inx) define
el perfil de cada persona en el servidor y lo publica en `UsuarioActual.perfil` desde
`app/(dashboard)/layout.tsx`. Los ítems del menú con `perfiles` solo se muestran a esos perfiles
(`visibleEnMenu` y `menuPara` en `lib/nav-base.ts`; un administrador ve todo). El menú solo oculta:
cada ruta debe protegerse en el servidor (layout o página) con la misma regla.

## Configuración (modelo del mockup, opción A)

`/configuracion` es una grilla en dos grupos: **Para ti** (todos los usuarios) y **Administración
de la plataforma** (solo administradores; cada sección además tiene su gate en su layout, como
`configuracion/usuarios/layout.tsx`). «Personalizar» del menú de usuario lleva a
`/configuracion/personalizacion`. Una plataforma que hoy bloquea toda `/configuracion` a no
administradores debe mover ese gate a sus secciones de administración antes de sumar Mi
personalización.

### Plan de tablas (esquema `cia_<plataforma>` en QA; no creadas aún)

| Tabla | Sección | Columnas |
|---|---|---|
| `usuarios` (ya existe en varias) | Usuarios y roles | `correo` PK, `nombre`, `rol`, `actualizado_en` |
| `preferencias_usuario` | Mi personalización | `correo` PK, `preferencias` jsonb, `actualizado_en` |
| `fuentes_datos` | Fuentes de datos | `clave` PK, `nombre`, `origen`, `cada_horas`, `activa` |
| `cargas_datos` | Fuentes de datos (historial; alimenta el indicador de la barra) | `id`, `fuente` FK, `iniciada_en`, `terminada_en`, `estado`, `filas`, `detalle`, `disparada_por` |
| `registro_actividad` | Registro de actividad | `id`, `ocurrido_en`, `correo`, `accion`, `entidad`, `entidad_id`, `detalle` jsonb (índices por fecha y correo; retención a acordar) |
| `avisos` | Avisos | `id`, `mensaje`, `nivel`, `desde`, `hasta`, `creado_por`, `creado_en` |
| `notificaciones` | Notificaciones y correos | `evento` PK, `descripcion`, `activo`, `destinatarios` text[], `asunto`, `plantilla`, `actualizado_por`, `actualizado_en` |

Orden: `preferencias_usuario` + `avisos` → `fuentes_datos` + `cargas_datos` → `registro_actividad`
→ `notificaciones`. El DDL se revisa y aprueba antes de ejecutarlo en QA (es productiva en la práctica).
