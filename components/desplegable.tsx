"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Desplegable del shell: reemplaza al <select> nativo, cuya lista abierta no se puede estilar
 * (bordes rectos, letra del sistema). Botón en píldora y lista flotante redondeada con la letra
 * de la página, check rojo en la opción elegida y buscador cuando hay muchas opciones. Con
 * `multiple`, cada opción lleva casilla y la lista queda abierta mientras se marca.
 *
 * Variantes del botón:
 * - «filtro»: «Rótulo: valor» dentro de una barra de filtros; en rojo si `activo`.
 * - «pildora»: botón suelto (cierre de un reporte, selector de maqueta).
 * - «campo»: a lo ancho, con el look de .field-input (formularios, modales).
 * - «libre»: sin estilo propio; lo pone quien lo usa con `claseBoton` / `estiloBoton`.
 *
 * La lista va en un portal (no la corta una tarjeta con overflow) y copia el data-estilo del
 * contenedor, para que en un reporte siga en Inter Tight. Teclado: Enter, Espacio o flechas
 * abren; flechas recorren; Enter elige (o marca); Esc cierra; Inicio y Fin van a los extremos.
 * Patrón listbox de ARIA (botón + lista con aria-activedescendant). Origen: checklist-contabilidad.
 */

export interface OpcionDesplegable {
  valor: string;
  texto: string;
  /** Texto chico a la derecha (código, conteo). */
  detalle?: string;
}

interface PropsBase {
  opciones: OpcionDesplegable[];
  /** Nombre accesible y, en la variante «filtro», el rótulo que va antes del valor. */
  etiqueta: string;
  variante?: "filtro" | "pildora" | "campo" | "libre";
  /** El valor elegido no es el de por defecto: se marca en rojo (solo «filtro»). */
  activo?: boolean;
  /** En la variante «pildora», muestra la etiqueta antes del valor («Cierre: Septiembre»). */
  conRotulo?: boolean;
  /** Texto cuando no hay nada elegido. */
  placeholder?: string;
  /** Desde cuántas opciones aparece el buscador. */
  buscarDesde?: number;
  alinear?: "izquierda" | "derecha";
  deshabilitado?: boolean;
  id?: string;
  className?: string;
  claseBoton?: string;
  estiloBoton?: CSSProperties;
  /** Contenido del botón en la variante «libre» (por defecto, el texto elegido). */
  children?: ReactNode;
  /** Borde de error. El mensaje va en `describedBy` (un botón no admite aria-invalid). */
  invalido?: boolean;
  requerido?: boolean;
  describedBy?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

interface PropsUnico extends PropsBase {
  multiple?: false;
  valor: string;
  onCambio: (valor: string) => void;
}

interface PropsMultiple extends PropsBase {
  multiple: true;
  valor: string[];
  onCambio: (valor: string[]) => void;
  /** Texto del botón con nada marcado (= todas). */
  textoTodos?: string;
}

export type PropsDesplegable = PropsUnico | PropsMultiple;

export function Desplegable(props: PropsDesplegable) {
  const {
    opciones,
    etiqueta,
    variante = "pildora",
    activo = false,
    conRotulo = false,
    placeholder,
    buscarDesde = 12,
    alinear = "izquierda",
    deshabilitado,
    id: idExterno,
    className,
    claseBoton,
    estiloBoton,
    children,
    invalido,
    describedBy,
    onFocus,
    onBlur,
  } = props;
  const idPropio = useId();
  const id = idExterno ?? idPropio;
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [indice, setIndice] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number; arriba: boolean; estilo: string | null } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const conBuscador = opciones.length >= buscarDesde;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  const marcados = props.multiple ? props.valor : props.valor ? [props.valor] : [];
  const estaMarcado = (v: string) => (props.multiple ? props.valor.includes(v) : props.valor === v);
  const texto = props.multiple
    ? marcados.length === 0
      ? (props.textoTodos ?? placeholder ?? "Todos")
      : marcados.length === 1
        ? (opciones.find((o) => o.valor === marcados[0])?.texto ?? marcados[0])
        : `${marcados.length} elegidos`
    : (opciones.find((o) => o.valor === props.valor)?.texto ?? placeholder ?? "—");
  const vacio = props.multiple ? false : !opciones.some((o) => o.valor === props.valor);

  const visibles = useMemo(() => {
    // Cada palabra debe aparecer, en cualquier orden: «esteban salgado» encuentra «Esteban Andrés Salgado».
    const palabras = normalizar(filtro).split(/\s+/).filter(Boolean);
    if (!palabras.length) return opciones;
    return opciones.filter((o) => {
      const texto = normalizar(`${o.texto} ${o.detalle ?? ""}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [opciones, filtro]);

  function abrir() {
    if (deshabilitado) return;
    setFiltro("");
    setIndice(Math.max(0, opciones.findIndex((o) => estaMarcado(o.valor))));
    setAbierto(true);
  }
  function cerrar(devolverFoco = true) {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
    // Sale del control sin volver al botón: recién ahí cuenta como «blur» (validación).
    else onBlur?.();
  }
  function elegir(o: OpcionDesplegable) {
    if (props.multiple) {
      props.onCambio(props.valor.includes(o.valor) ? props.valor.filter((v) => v !== o.valor) : [...props.valor, o.valor]);
    } else {
      props.onCambio(o.valor);
      cerrar();
    }
  }

  // Posición de la lista: bajo el botón, o encima si abajo no cabe.
  useLayoutEffect(() => {
    if (!abierto) return;
    const ubicar = () => {
      const r = boton.current?.getBoundingClientRect();
      if (!r) return;
      const alto = panel.current?.offsetHeight ?? 320;
      const arriba = r.bottom + alto + 12 > window.innerHeight && r.top > alto + 12;
      const ancho = panel.current?.offsetWidth ?? r.width;
      const left = alinear === "derecha" ? Math.max(8, r.right - ancho) : Math.min(r.left, window.innerWidth - ancho - 8);
      const estilo = boton.current?.closest("[data-estilo]")?.getAttribute("data-estilo") ?? null;
      setPos({ top: arriba ? r.top - 8 : r.bottom + 8, left: Math.max(8, left), minWidth: variante === "campo" || variante === "libre" ? r.width : Math.max(r.width, 224), arriba, estilo });
    };
    ubicar();
    // Una segunda pasada con el tamaño real de la lista ya dibujada.
    const raf = requestAnimationFrame(ubicar);
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", ubicar, true);
    };
  }, [abierto, alinear, variante]);

  // Al abrir: foco en el buscador o en la lista.
  useEffect(() => {
    if (!abierto || !pos) return;
    (conBuscador ? buscador.current : lista.current)?.focus({ preventScroll: true });
  }, [abierto, conBuscador, pos]);

  // Clic fuera cierra.
  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!boton.current?.contains(t) && !panel.current?.contains(t)) {
        setAbierto(false);
        onBlurRef.current?.();
      }
    };
    document.addEventListener("mousedown", alClic);
    return () => document.removeEventListener("mousedown", alClic);
  }, [abierto]);

  // La opción activa siempre a la vista.
  useEffect(() => {
    if (!abierto) return;
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice, abierto]);

  function teclaBoton(e: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      abrir();
    }
  }
  function teclaLista(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(visibles.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setIndice(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setIndice(visibles.length - 1);
    } else if (e.key === "Enter" || (e.key === " " && !conBuscador)) {
      e.preventDefault();
      const o = visibles[indice];
      if (o) elegir(o);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
    } else if (e.key === "Tab") {
      cerrar(false);
    }
  }

  const idLista = `${id}-lista`;
  const idOpcion = (i: number) => `${id}-op-${i}`;
  const enRojo = variante === "filtro" && activo;

  return (
    <div className={cn("relative", variante === "campo" ? "flex w-full" : "inline-flex", className)}>
      <button
        ref={boton}
        id={id}
        type="button"
        disabled={deshabilitado}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-label={variante === "campo" || variante === "libre" ? undefined : `${etiqueta}: ${texto}`}
        aria-describedby={describedBy}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={teclaBoton}
        onFocus={onFocus}
        onBlur={(e) => {
          // El foco pasa a la lista propia: no es salir del campo.
          if (abierto || panel.current?.contains(e.relatedTarget as Node)) return;
          onBlur?.();
        }}
        style={estiloBoton}
        className={cn(
          "inline-flex items-center gap-2 cursor-pointer transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
          variante !== "libre" && "focus-visible:ring-2 focus-visible:ring-flesan-red/60",
          variante === "filtro" &&
            cn(
              "h-8 pl-3 pr-2.5 rounded-full text-xs border",
              activo ? "bg-flesan-red/8 border-flesan-red/30" : "bg-bg border-border hover:border-border-strong",
              abierto && "border-border-strong",
            ),
          variante === "pildora" &&
            cn(
              "h-[var(--densidad-control)] pl-4 pr-3 rounded-full border bg-surface text-[0.8125rem] font-semibold text-text",
              abierto ? "border-border-strong" : "border-border hover:border-border-strong",
            ),
          variante === "campo" &&
            cn(
              "field-input w-full justify-between text-left",
              abierto && "border-flesan-red! shadow-[inset_0_0_0_1px_var(--color-flesan-red)]",
              invalido && "border-flesan-red!",
            ),
          claseBoton,
        )}
      >
        {variante === "libre" && children ? (
          children
        ) : (
          <>
            {(variante === "filtro" || (variante === "pildora" && conRotulo)) && <span className="text-muted font-normal">{etiqueta}:</span>}
            <span
              className={cn(
                "truncate",
                variante === "campo" ? "flex-1" : "max-w-[16rem]",
                variante === "filtro" && cn("font-semibold", enRojo ? "text-flesan-red" : "text-text"),
                vacio && "text-faint font-normal",
              )}
            >
              {texto}
            </span>
          </>
        )}
        <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 text-faint transition-transform", abierto && "rotate-180")} aria-hidden />
      </button>

      {abierto &&
        createPortal(
          <div
            ref={panel}
            data-estilo={pos?.estilo ?? undefined}
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              minWidth: pos?.minWidth,
              transform: pos?.arriba ? "translateY(-100%)" : undefined,
              visibility: pos ? "visible" : "hidden",
            }}
            className="z-[100] w-max max-w-[min(24rem,calc(100vw-1rem))] rounded-2xl border border-border bg-surface text-text shadow-xl p-1.5 animate-fade-in"
          >
            {conBuscador && (
              <div className="flex items-center gap-2 px-2.5 mb-1 h-9 rounded-xl bg-bg ring-flesan-red/50 focus-within:ring-2">
                <Search className="w-3.5 h-3.5 text-faint shrink-0" aria-hidden />
                <input
                  ref={buscador}
                  value={filtro}
                  onChange={(e) => {
                    setFiltro(e.target.value);
                    setIndice(0);
                  }}
                  onKeyDown={teclaLista}
                  placeholder="Buscar…"
                  aria-label={`Buscar en ${etiqueta.toLowerCase()}`}
                  aria-controls={idLista}
                  aria-activedescendant={visibles[indice] ? idOpcion(indice) : undefined}
                  className="flex-1 min-w-0 bg-transparent border-0 text-[0.8125rem] text-text placeholder:text-faint outline-none! shadow-none!"
                />
              </div>
            )}
            <ul
              ref={lista}
              id={idLista}
              role="listbox"
              aria-label={etiqueta}
              aria-multiselectable={props.multiple || undefined}
              tabIndex={conBuscador ? -1 : 0}
              aria-activedescendant={!conBuscador && visibles[indice] ? idOpcion(indice) : undefined}
              onKeyDown={conBuscador ? undefined : teclaLista}
              className="max-h-72 overflow-y-auto outline-none"
            >
              {visibles.map((o, i) => {
                const sel = estaMarcado(o.valor);
                return (
                  <li
                    key={o.valor}
                    id={idOpcion(i)}
                    data-indice={i}
                    role="option"
                    aria-selected={sel}
                    onMouseEnter={() => setIndice(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => elegir(o)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[0.8125rem] cursor-pointer select-none",
                      i === indice ? "bg-bg" : "",
                      sel ? "font-semibold text-text" : "text-muted",
                    )}
                  >
                    {props.multiple && (
                      <span
                        aria-hidden
                        className={cn(
                          "w-4 h-4 shrink-0 rounded-[0.3rem] border inline-flex items-center justify-center transition-colors",
                          sel ? "bg-flesan-red border-flesan-red text-white" : "border-border-strong bg-surface",
                        )}
                      >
                        {sel && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                    )}
                    <span className="flex-1 truncate">{o.texto}</span>
                    {o.detalle && <span className="text-xs text-faint font-normal shrink-0">{o.detalle}</span>}
                    {!props.multiple && sel && <Check className="w-3.5 h-3.5 text-flesan-red shrink-0" aria-hidden />}
                  </li>
                );
              })}
              {!visibles.length && <li className="px-3 py-2 text-[0.8125rem] text-faint">Sin resultados</li>}
            </ul>
            {props.multiple && props.valor.length > 0 && (
              <div className="flex items-center justify-between gap-3 mt-1 pt-1.5 px-2 border-t border-border">
                <span className="text-xs text-muted">
                  {props.valor.length} elegido{props.valor.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => props.onCambio([])}
                  className="text-xs font-semibold text-muted hover:text-flesan-red cursor-pointer py-1"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
