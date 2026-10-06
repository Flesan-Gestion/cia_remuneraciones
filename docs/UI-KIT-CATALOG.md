# Guía de estilo y laboratorio de diseño

`/ui-kit` tiene dos partes:

- **Estándar** (`/ui-kit`) — resumen de lo vigente: identidad y color, tipografía, escala y
  densidad, superficie y forma, formularios y la muestra elegida de cada sección, cada tarjeta con
  «Ver tokens» copiables y el botón «Exportar estándar». Sale de `lib/lab-graficos/estandar.ts`
  (tema + muestra elegida por sección). La comparación de escalas sigue en `/ui-kit/escala`,
  enlazada desde su tarjeta.
- **Laboratorio de diseño** — `/ui-kit/laboratorio/<sección>` para **gráficos, KPIs, tablas,
  botones y formularios**, más `En contexto`. Es el método para elegir el estándar visual.

Además, el menú **Pruebas** del sidebar (`/pruebas/reportes/tipo-1..3` y
`/pruebas/formularios/tipo-1..3`) tiene pantallas de plataforma armadas solo con el estándar
vigente (su layout usa `LabTemaFijo` con `ESTANDAR.tema`), para ver cómo queda en uso real.

## Los códigos de catálogo se retiraron (2026-09-25)

Antes había una vitrina por pestañas con códigos (GL-201, GB-101, GA-401, GT-301, KP-101,
TB-101, BT-101…). Se retiraron: el estándar se define desde cero en el laboratorio y **se
codifica recién al elegir**. Lo que existía quedó en el laboratorio marcado **«Plantilla
actual»**, para compararlo con lo nuevo (filtro «Origen» en la galería). Las rutas viejas
(`/ui-kit/graficos|kpis|tablas|botones`, `/ui-kit/laboratorio-graficos`) redirigen al laboratorio
(ver `next.config.ts`).

## Cómo se usa el laboratorio

- **Galería** de la sección: muestras por familia, filtros por origen (exploración o plantilla
  actual) y por librería.
- **Comparador**: una muestra con todas las variantes de una dimensión lado a lado. Cada sección
  compara lo suyo: gráficos (superficie, paleta, letra, curva, animación), KPIs (cifra, acento),
  tablas (encabezado, bordes, zebra, densidad) y botones (forma, mayúsculas, relleno, peso).
  «Usar en todo el laboratorio» fija esa variante.
- **Panel «Tema»**: arriba lo global (paleta, letra, superficie, radio, modo, animación,
  densidad) y abajo lo de la sección abierta. **«Exportar tema»** entrega los tokens CSS y la
  combinación en JSON.

## Contrato de una muestra

- Tokens: `lib/lab-graficos/tema.ts` (`TokensLab`: colores, secuencial, divergente, estado,
  fuente, superficie, animación, `boton`, `tabla`, `kpi`…). Una muestra no hardcodea colores,
  letra ni radios: todo sale de `useTokens()`.
- Helpers por librería: `lib/lab-graficos/estilos.ts` (ECharts, Nivo) y el envoltorio
  `components/lab-graficos/echart.tsx`.
- Tipo y secciones: `components/lab-graficos/tipos.ts` (`GraficoLab`, `SECCIONES`).
- Cada familia vive en `components/lab-graficos/graficos/<familia>/` y se registra en su
  `index.ts` (id kebab-case único). `components/lab-graficos/catalogo.ts` las junta.
- Datos sintéticos deterministas en `lib/lab-graficos/datos.ts`. Letras extra en
  `app/fonts/lab/`, mapa de regiones en `public/lab/chile-regiones.json` y worker de MapLibre en
  `public/lab/maplibre/`.
- Librerías instaladas para el laboratorio: ECharts, Nivo, visx, motion y MapLibre.

## Al definir el estándar

1. Pasar los tokens de «Exportar tema» al `@theme` de `app/globals.css`.
2. Promover las muestras elegidas a componentes estándar (con código nuevo) en
   `components/charts|kpis|tables|buttons/`, y documentarlos aquí.
3. Actualizar `lib/lab-graficos/estandar.ts` (`tema`, `muestras`, `provisorio: false`,
   `vigenteDesde`, `version`): la pestaña Estándar y las pantallas de Pruebas lo toman solas.
4. Borrar lo que no se eligió: muestras, letras de `app/fonts/lab/` y librerías sin uso.

## Infraestructura compartida

- `lib/chart-geometry.ts` — helpers puros de geometría SVG, que usan las muestras «Plantilla actual».
- `components/page-header.tsx` — encabezado de toda vista: `<PageHeader title description actions />`.
  Título en una línea, la descripción detrás de un ícono (i) y las acciones a la derecha. No
  reintroducir eyebrow + título grande + párrafo: empuja el contenido hacia abajo.
- `components/section-tabs.tsx` — tabs de navegación secundaria (usado por el layout de `/ui-kit`;
  toma la ruta que calza más largo, así las sub-rutas marcan su tab).
- `--color-chart-1..5` y `--color-chart-grid` en `app/globals.css` (`@theme` + override `.dark`).
