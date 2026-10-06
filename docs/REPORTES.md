# Reportes tipo

Pantallas de referencia en el menú «Pruebas» del sidebar. Para armar un reporte en una
plataforma, se copia el tipo que corresponde y se cambian sus datos de ejemplo por la consulta
real: los bloques no cambian.

| Tipo (menú) | Para qué | Pantalla | Piezas |
|---|---|---|---|
| 1 (Contratación) | Resumen ejecutivo del período, con filtros cruzados | `components/pruebas/reporte-ejecutivo.tsx` | `components/reporte/` |
| 2 (Ventas) | Ventas con meta: mensual, acumulado, categoría, ciudad, vendedor y proyecto, en tres vistas (Tablero, Territorio, Vendedor × mes) | `components/pruebas/ventas/` | `components/reporte/` |
| 3 (RRHH) | Dotación (RR.HH.): stock al cierre, movimientos y rotación de 12 meses, composición por edad, sexo, antigüedad y contrato | `components/pruebas/personas/` | `components/reporte/` |
| 4 (Costos) | Costos por obra con drilldown (Línea → Obra → Partida) | `components/pruebas/reporte-costos.tsx` | laboratorio + ECharts |
| 5 (Ficha de obra) | Ficha de una entidad (una obra) | `components/pruebas/reporte-obra.tsx` | laboratorio |

## Reporte Tipo 1

El look & feel se tomó del panel de Conflicto de Interés de debida-diligencia (opción A,
aprobada el 29-09-2026). Tiene tarjetas redondeadas, cifras grandes en Inter Tight
(`data-estilo="reporte"`), la paleta de series `--color-serie-1…8` de `app/shell.css` y el brillo
rojo solo en la tarjeta principal.

### Piezas (`components/reporte/`)

| Pieza | Archivo | Recibe |
|---|---|---|
| `KpiPrincipal` | `kpi-principal.tsx` | cifra, contraste (ej. facturado) con avance, chips de conteo, serie de tendencia |
| `PanelCifras` | `kpi-principal.tsx` | cifras de contexto fijas (no responden a filtros) |
| `TarjetaReporte`, `Rotulo`, `Pildoras` | `tarjeta.tsx` | bloque numerado con título y detalle; selector de vista |
| `BarraFiltros` | `filtros.tsx` | los filtros activos (texto, color y cómo quitarlo) |
| `DonaLeyenda` | `dona-leyenda.tsx` | `{ clave, nombre, valor, detalle, color }[]`, selección y `onSeleccion` |
| `Piramide` | `piramide.tsx` | `{ numero, nombre, cantidad, valor }[]` por nivel, selección |
| `BarrasApiladas` | `barras-apiladas.tsx` | categorías (años) y series con un valor por categoría |
| `KpiTarjeta` | `kpi-tarjeta.tsx` | KPI chico para una franja; barra con marca de meta opcional |
| `BarrasComparadas` | `barras-comparadas.tsx` | por mes: actual, año anterior y meta (línea punteada); clic elige el mes |
| `LineaAcumulada` | `linea-acumulada.tsx` | valores por mes del año, la meta y el año anterior (los acumula) |
| `BarraParticipacion` | `participacion.tsx` | igual que la dona, en una barra al 100 % con fichas |
| `RankingMeta` | `ranking-meta.tsx` | `{ clave, nombre, detalle, valor, meta }[]`: barra, marca de meta y semáforo |
| `MapaChile`, `MapaLatitud` | `mapa-chile.tsx` | puntos `{ clave, nombre, lat, lon, valor, color, detalle }` sobre el contorno real (GeoJSON `/lab/chile-regiones.json`) |
| `MatrizCalor` | `matriz-calor.tsx` | filas × columnas (vendedor × mes), columnas activas del período |
| `BarrasVariacion` | `variacion.tsx` | variación % por ítem alrededor de cero |
| `FlujoMensual` | `flujo-mensual.tsx` | por mes: entradas (arriba), salidas (abajo) y saldo; el neto bajo cada mes |
| `Cascada` | `cascada.tsx` | saldo inicial, movimientos con signo y saldo final (puente); el eje no parte de cero |
| `PiramideEdad` | `piramide-edad.tsx` | tramos con un valor a cada lado (hombres / mujeres); clic en tramo o en lado |
| `RankingTope` | `ranking-tope.tsx` | `{ clave, nombre, detalle, valor, tope }[]` donde menos es mejor (rotación), semáforo `colorTope` |
| `Columnas` | `columnas.tsx` | histograma simple por tramo, con % y clic para filtrar |
| Celdas de tabla | `celdas.tsx` | `CeldaNombre` (iniciales), `InsigniaSerie`, `ValorConMas`, `NumeroCaja`, `CeldaMonto` |

La tabla usa `<table className="rep-tabla">`, y los formatos de cifra (es-CL, MM) están en
`formato.ts`.

### Receta

1. Copia `reporte-ejecutivo.tsx` a la plataforma y crea su ruta. La página se envuelve en
   `data-estilo="reporte"`.
2. Cambia `CONTRATOS` por tus filas, **una fila por hecho** (contrato, venta, orden…). Si los datos
   vienen de la transaccional, se leen con `lib/db.ts` (solo lectura). Pueden entrar por un
   server component o por una API.
3. Cada bloque se calcula desde esas filas. Para los filtros cruzados, cada gráfico se calcula con
   todos los filtros menos el suyo (`pasa(c, "tipo")`). Así lo elegido queda resaltado y el resto
   atenuado en vez de desaparecer.
4. Los filtros van en `useFiltrosUrl`, para que «Agregar a presentación» guarde la vista, y el
   título y los filtros en `usePublicarVista`.
5. Los colores salen de `SERIES` (`formato.ts`) o de los tokens `var(--color-serie-N)`, escritos
   completos: Tailwind v4 no emite una variable que no encuentra escrita en el código.
6. Cada bloque puede cambiar de gráfico según la pregunta (una dona por barras, por ejemplo) sin
   cambiar el look.

## Reporte Tipo 2 (ventas)

Las tres vistas se calculan desde las mismas filas y comparten los filtros: `components/pruebas/ventas/calculos.ts`. Se usa **una fila por unidad vendida** más la **meta mensual por vendedor**.

- **Período:** «Acumulado» suma de enero al mes elegido y «Mes» muestra solo ese mes. Un clic en un mes de cualquier gráfico cambia a «Mes».
- **Meta:** existe por vendedor. La de una ciudad reparte la de cada vendedor según dónde vendió. No hay meta por categoría: con una categoría elegida se muestra «sin meta».
- **Semáforo** (`colorCumplimiento` en `formato.ts`): sobre 100 % verde, 90-99 % ámbar, bajo 90 % rojo.

## Reporte Tipo 3 (dotación)

Se usa **una fila por persona y contrato** (gerencia, nivel, contrato, sexo, año de nacimiento,
mes de ingreso y, si salió, mes y motivo de egreso) más los **cupos autorizados por gerencia**.
Cálculos en `components/pruebas/personas/calculos.ts`.

- **Corte:** un mes de cierre. La dotación es quien está vigente al cierre, y los movimientos y la rotación son de los 12 meses hasta ese mes.
- **Rotación:** egresos de los 12 meses sobre la dotación promedio de esos meses. La voluntaria cuenta solo las renuncias.
- **Tope:** cada gerencia tiene un tope de rotación, y el de un grupo es el de sus gerencias ponderado por dotación. Semáforo `colorTope`: hasta el 90 % del tope va en verde, hasta el tope en ámbar y sobre el tope en rojo.
- **Cupos:** existen solo por gerencia. Con un filtro de sexo, edad, antigüedad o contrato, el KPI principal no muestra cupos.
- **Puente:** con filtro de edad o antigüedad las personas cambian de tramo en el año, y esa diferencia va como «Cambio de tramo» para que el puente cuadre.
- **Privacidad:** el reporte es agregado y no lista personas. Los datos reales de RR.HH. no salen de la red interna.

### Color

La paleta de series es solo para **datos**: categorías en gráficos, insignias y avatares. En
botones, enlaces de acción y selección, el rojo Flesan sigue siendo el único acento (el punto rojo
de la opción activa, la lupa del buscador).

## Constructor de maquetas

En `/pruebas/maquetas` (menú Pruebas › Constructor de maquetas) se arma la maqueta de un reporte o
formulario sin escribir código. Tiene tres paneles: el catálogo, el lienzo de 12 columnas y las
propiedades o el tema. Código en `components/constructor/` y modelo en `lib/constructor/tipos.ts`.

- **Catálogo:** textos y estructura, las piezas de `components/reporte/` con datos de ejemplo y todo el laboratorio de diseño. Para sumar una pieza nueva, se agrega en `components/constructor/elementos.tsx`.
- **Bloques:** se arrastran o se agregan con clic, entran después del bloque elegido y se reordenan arrastrando su manilla. Cada uno tiene elemento, título, detalle, ancho (3, 4, 6, 8 o 12), alto y número de bloque.
- **Tema:** el panel del laboratorio, guardado dentro de cada maqueta. Cambia los elementos del laboratorio; las piezas estándar siguen los tokens de la plataforma.
- **Guardar:** en este navegador (conveniencia). Para compartir, «Exportar JSON» e «Importar».
- **Ruta:** no puede llamarse `constructor`. Las herramientas de desarrollo de Next guardan las rutas en un objeto y ese segmento choca con `Object.prototype.constructor`, lo que bota la página en dev.
