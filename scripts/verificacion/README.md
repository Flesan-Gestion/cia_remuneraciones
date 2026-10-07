# Verificación contra los aplicativos PHP

Comparan las consultas y los Excel de la plataforma con los de los aplicativos antiguos, con datos
reales. El SQL original se arma como lo arma el PHP, se corren las dos versiones y se comparan fila
a fila. Correrlas después de cualquier cambio en `lib/libro`, `lib/libro-prorrateado` o
`lib/finiquitos`.

- **Solo lectura:** toda consulta va en una transacción `READ ONLY`.
- **Encargados de CC:** las consultas originales cruzan con la copia `encargados_cc` (la única fuente
  desde 2026-10-07), igual que la plataforma.
- **Requisitos:** `.env.local` del proyecto, y las fuentes PHP (`finiquito_rem/`, `libro_rem_g2/`)
  en la carpeta que contiene el repo; si están en otra parte, se indica con `FUENTES_PHP`.
- **Salida:** los Excel y JSON quedan en `scripts/verificacion/salida/`, que git ignora.

Se corren desde esta carpeta (`scripts/verificacion`).

## Finiquitos

```sh
node finiquitos/verificar.cjs [grupos] [desde] [hasta]
# grupos: admin,rrhh,encargados,tch,ggo,listas,semanas (todos por defecto; ~25 min)
# ej.: node finiquitos/verificar.cjs rrhh "202607Semana 4" "202610Semana 1"
node finiquitos/sintetico.cjs
node finiquitos/excel.cjs <rol> <correo> <desde> <hasta> [empresa] [cc]
```

Resultado esperado:

- `verificar`: todo `OK` salvo rene.godoy@flesan.cl, que ve sus finiquitos por la mejora «correos
  sin distinguir mayúsculas» (docs/DECISIONES.md).
- `sintetico`: los dos casos de «CC repetido» salen como `DIFERENCIA` a propósito. El original
  duplica o triplica los montos y la plataforma cuenta a cada persona una vez (decisión aprobada).

## Libro prorrateado

```sh
node libro-prorrateado/verificar.cjs [grupos] [periodo]
# grupos: admin,rrhh,ggo,listas,periodos,rango
node libro-prorrateado/excel.cjs <rol> <correo> <desde> <hasta> [empresa]
```

`plantillas/` tiene el SQL de `class_libro_rem_dist.php` tal como lo arma el PHP.

## Libro de remuneraciones

```sh
node libro/escenario.cjs <nombre> <rol 1-5> <correo> <empresa|0> <cc|0> <desde> <hasta>
# rol: 1 administrador, 2 rrhh, 3 administrativo_rrhh, 4 administrador_obra, 5 ggo
# ej.: node libro/escenario.cjs rrhh_dm 2 x@flesan.cl DM 0 202609 202609
```

Diferencias esperadas: las decisiones del libro en docs/DECISIONES.md, por ejemplo NFG, que ya nadie
ve fuera de Administrador.
