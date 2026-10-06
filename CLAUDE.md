# Grupo Flesan — Contexto para Claude Code

Este proyecto es la **plantilla base** de plataformas internas de Grupo Flesan. Ya trae el stack
de frontend y el sistema de diseño de marca instalados — antes de escribir UI nueva, lee este
archivo y los puntos de referencia abajo.

## Stack (no cambiar sin que el usuario lo pida)

- Next.js 15 App Router + React 19 + TypeScript
- **Tailwind v4**: no hay `tailwind.config.js`. Los tokens de marca viven en `app/shell.css`
  dentro del bloque `@theme` (CSS nativo de Tailwind v4), no en JS.
- Fonts vía `next/font/local` en `app/layout.tsx` (Barlow, Barlow Condensed, Barlow Semi
  Condensed), con los `.ttf` auto-hospedados en `app/fonts/` — variables CSS `--font-barlow*`
  consumidas por `--font-display/body/label` en `shell.css`. Deliberadamente NO se usa
  `next/font/google`: en redes corporativas con inspección TLS, Next no logra descargar la fuente
  en caliente y cae a una fuente de respaldo sin avisar (visualmente distinto a lo esperado). Si
  agregas un nuevo peso/estilo, descárgalo desde el repo `google/fonts` en GitHub (licencia OFL) y
  súmalo al arreglo `src` correspondiente.
- Dark mode con `next-themes`, atributo `class` (`.dark`). Nunca usar `prefers-color-scheme`
  directo en componentes; los tokens semánticos (`--color-bg`, `--color-text`, etc.) ya resuelven
  ambos temas.
- Iconos: `lucide-react` exclusivamente, stroke por defecto.

## Antes de crear un componente nuevo

1. Mira `app/(dashboard)/ui-kit/page.tsx` (o corre `npm run dev` y visita `/ui-kit`) — ahí están
   todas las clases utilitarias ya disponibles: `.btn-flesan` (+ `-primary/-ghost/-dark/-lg/-sm`),
   `.card` / `.card-hover`, `.chip-flesan` (+ `.is-active`), `.badge`, `.field-input`, `.skeleton`,
   `.display-title`, `.label-eyebrow`, `.label-meta`, `.body-lede`, `.brand-bullet`,
   `.toggle-pill` (+ `.toggle-pill-option.is-active`) y `.page-shell` — este último es el
   contenedor de ancho de todas las páginas (hasta 120rem + padding), no reintroducir `max-w-5xl`
   suelto en cada page.
   **Gráficos, KPIs, tablas, botones y formularios se eligen en el laboratorio de diseño**
   (`/ui-kit/laboratorio/<sección>`, más «En contexto»); lo vigente está en la pestaña
   «Estándar» (`/ui-kit`, datos en `lib/lab-graficos/estandar.ts`) y se ve aplicado en el menú
   «Pruebas» del sidebar (reportes y formularios tipo 1-3). En el laboratorio hay galería por
   sección, comparador de variantes y panel «Tema» cuyo «Exportar tema» entrega los tokens.
   Los códigos de catálogo (GL-201, KP-101, TB-101, BT-109…) se retiraron: lo que existía quedó
   en el laboratorio marcado «Plantilla actual». Cuando el usuario elija, lo elegido se promueve
   a componente estándar (con código nuevo) y lo demás se borra. Ver `docs/UI-KIT-CATALOG.md`.
   Si el usuario pide una muestra del laboratorio, está en
   `components/lab-graficos/graficos/<familia>/` (id en su `index.ts`); reutilízala.
2. Si necesitas un color o tamaño que no está en `app/shell.css` (`@theme`), agrégalo ahí como
   variable CSS — no hardcodees hex sueltos en componentes ni reintroduzcas un
   `tailwind.config.js`.
3. Para añadir o reordenar secciones del menú: edita únicamente `lib/nav.ts` (`NAV_ITEMS`).
   `components/sidebar.tsx` y `components/topbar.tsx` lo consumen — no dupliques la lista de
   navegación en ambos archivos.
   - Un ítem **sin** `children` es enlace directo; **con** `children` abre un menú flotante con
     sus subpaneles (agrupables con `grupo`). Pedido típico: «Ventas: Gerencia, Vendedor» o
     «Ventas: Vistas [Gerencia, Vendedor] / Detalle [Por proyecto]».
   - Configuración (`NAV_CONFIG`), el tema y el usuario viven en el pie del sidebar. La barra
     superior solo muestra la ruta (`migasDe`); los niveles de drilldown de una página se
     agregan con `BreadcrumbContext`.

## Shell estándar (lo común a todas las plataformas)

El marco común (sidebar, barra superior, navegación, escala, tokens, portales, estado de los
datos) es el «shell» y se replica en las plataformas: ver `docs/SHELL.md` (qué archivos son
shell y cuáles define cada plataforma). Un cambio en un archivo del shell aquí se propaga
después a las plataformas; lo propio de esta plantilla va en `lib/nav.ts`, `components/modulos.tsx`,
`lib/estado-datos.ts` y `app/globals.css`.

## Base de datos de una plataforma nueva

Reglas completas en README.md, «Base de datos de la plataforma». Lo esencial: **la base
transaccional (`DATABASE_URL`, `lib/db.ts`) se usa solo para leer** (maestro de colaboradores,
centros de gestión, movimientos…); **todo lo que se escribe va en el esquema propio `cia_<slug>`**
de la base de QA (`DATABASE_URL_PLATAFORMA` + `ESQUEMA_PLATAFORMA`, `lib/configuracion-db.ts`).
Tablas del estándar en `db/002_configuracion.sql` (y `db/001_usuarios_roles.sql` si hay roles
administrados, `db/003_notificaciones.sql` si hay campanita); todo SQL se muestra y aprueba antes de ejecutarlo en QA. El mockup no tiene esquema.

## Escala y densidad (default de la plantilla)

- Raíz **fluida suave**: `html { font-size: clamp(14px, calc(8.5px + 0.5vw), 16px) }`. Todo va
  en rem; no hardcodear `px` en tamaños de texto ni de controles.
- Densidad **compacta** por defecto: tokens `--densidad-*` en `:root` (`app/shell.css`), que
  consumen `.btn-flesan`, `.field-input`, `.dens-card`, `.dens-gap`, `.dens-control`, `.dens-tabla`
  y las celdas de TB-1xx. Para un formulario largo, `data-densidad="comoda"` en su contenedor.
  En tarjetas nuevas usar `dens-card` en vez de `p-5`/`p-6`.
- Comparación de alternativas en `/ui-kit/escala`.

## Skill de marca completa

La guía completa de marca (voz y tono, copy, logos de sub-marcas, reglas de accesibilidad,
templates de presentación) está instalada como skill en
`~/.claude/skills/grupo-flesan-skill/README.md`. Útil para:
- Copy en español (tono institucional, tagline oficial "Confianza que construye")
- Variantes de logo y cuándo usar cada una
- Paleta extendida y reglas de contraste

**Importante**: el `tokens/tailwind.config.js` de esa skill es para **Tailwind v3** — no lo copies
tal cual a este proyecto (Tailwind v4). Usa sus valores de color/tipografía como referencia y
agrégalos al bloque `@theme` de `app/shell.css`, igual que ya está hecho aquí.

## Reglas de marca rápidas

- Rojo Flesan `#E30613` — única marca de acento. No usar otros rojos para call-to-action.
  En reportería, los datos usan la paleta de series `--color-serie-1…8` (aprobada con el Reporte
  Tipo 1); nunca en botones ni acciones. Receta y piezas de los reportes tipo: `docs/REPORTES.md`.
- Copy en español (Chile), institucional, sin emojis, sin "líder/revolucionar/increíble".
- Tagline oficial: "Confianza que construye" (no inventar otras).
- Bullet de marca: cuadrado rojo (`.brand-bullet`), no usar viñetas redondas.
