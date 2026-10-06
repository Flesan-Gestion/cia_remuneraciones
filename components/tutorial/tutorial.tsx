"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, GraduationCap, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePreferencias } from "@/components/preferencias";
import { PASOS_PLATAFORMA } from "./recorrido-plataforma";

// SHELL · tutorial guiado (origen: eerr_gestion, Propuesta C). Recorre la pantalla paso a paso,
// como los tutoriales de los bancos: cada paso ilumina una zona y deja el resto bajo un velo, con
// un globo al lado que dice qué hacer.
//
// El birrete «Tutorial» del pie del sidebar está en todas las pantallas:
// - si la pantalla declaró su recorrido con useTutorial(pasos), explica esa pantalla y al final
//   ofrece el recorrido de la plataforma;
// - si no, muestra el recorrido de la plataforma (components/tutorial/recorrido-plataforma.ts).
// La primera vez que alguien entra a una pantalla con recorrido (o a Inicio), se le ofrece con
// una tarjeta junto al birrete; nunca se abre solo. Ambas cosas se apagan en Mi personalización.
//
// Las zonas se marcan con `data-tutorial="…"`, o se reutiliza el `data-bloque` de las tarjetas de
// reporte y el `data-grupo` de los grupos de campos.

export interface PasoTutorial {
  /** Selector CSS de la zona a iluminar. Si no está en la pantalla, el paso se salta. */
  selector: string;
  /** Con varios elementos que calzan, cuál iluminar (por defecto el primero). */
  indice?: number;
  titulo: string;
  texto: string;
}

type Origen = "pantalla" | "plataforma";

interface ValorTutorial {
  pasos: PasoTutorial[] | null;
  registrar: (pasos: PasoTutorial[] | null) => void;
  abierto: boolean;
  iniciar: (origen?: Origen) => void;
}

const Contexto = createContext<ValorTutorial | null>(null);

// Pantallas a las que ya se les ofreció el recorrido (en este navegador).
const CLAVE_VISTOS = "cia-tutoriales-ofrecidos";
function leerVistos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_VISTOS) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function marcarVisto(clave: string) {
  try {
    const vistos = leerVistos();
    if (!vistos.includes(clave)) localStorage.setItem(CLAVE_VISTOS, JSON.stringify([...vistos, clave].slice(-200)));
  } catch {}
}
/** Vuelve a ofrecer los recorridos en todas las pantallas (Mi personalización). */
export function reiniciarOfrecimientos() {
  try {
    localStorage.removeItem(CLAVE_VISTOS);
  } catch {}
}

/** Va alrededor del dashboard (AppShell): une los pasos de la pantalla con el birrete del sidebar. */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pref] = usePreferencias();
  const [pasos, setPasos] = useState<PasoTutorial[] | null>(null);
  const [recorrido, setRecorrido] = useState<{ pasos: PasoTutorial[]; origen: Origen } | null>(null);
  const [i, setI] = useState(0);
  const [oferta, setOferta] = useState<{ clave: string; origen: Origen } | null>(null);

  const iniciar = useCallback(
    (origen?: Origen) => {
      const elegido: Origen = origen ?? (pasos?.length ? "pantalla" : "plataforma");
      // Solo los pasos cuya zona existe ahora (ej. sin campanita no hay paso de notificaciones).
      const presentes = (elegido === "pantalla" ? (pasos ?? []) : PASOS_PLATAFORMA).filter((p) => buscar(p));
      setOferta(null);
      if (!presentes.length) return;
      setRecorrido({ pasos: presentes, origen: elegido });
      setI(0);
    },
    [pasos],
  );

  // Ofrecimiento de la primera visita: en una pantalla con recorrido propio, o en Inicio (el de
  // la plataforma). Espera un momento a que la pantalla se dibuje y registre sus pasos.
  const ofrecer = pref.tutoriales && pref.ofrecerTutoriales && !recorrido;
  useEffect(() => {
    setOferta(null);
    if (!ofrecer) return;
    const origen: Origen | null = pasos?.length ? "pantalla" : pathname === "/" ? "plataforma" : null;
    if (!origen) return;
    const clave = origen === "plataforma" ? "plataforma" : `pantalla:${pathname}`;
    if (leerVistos().includes(clave)) return;
    const t = setTimeout(() => setOferta({ clave, origen }), 1200);
    return () => clearTimeout(t);
  }, [pathname, pasos, ofrecer]);

  return (
    <Contexto.Provider value={{ pasos, registrar: setPasos, abierto: recorrido !== null, iniciar }}>
      {children}
      {oferta && (
        <Ofrecimiento
          origen={oferta.origen}
          onAceptar={() => {
            marcarVisto(oferta.clave);
            iniciar(oferta.origen);
          }}
          onDescartar={() => {
            marcarVisto(oferta.clave);
            setOferta(null);
          }}
        />
      )}
      {recorrido && (
        <Recorrido
          pasos={recorrido.pasos}
          i={i}
          onIr={setI}
          onCerrar={() => setRecorrido(null)}
          // Al terminar el de una pantalla, se ofrece el de la plataforma.
          siguiente={recorrido.origen === "pantalla" ? { texto: "Ver la plataforma", onClick: () => iniciar("plataforma") } : undefined}
        />
      )}
    </Contexto.Provider>
  );
}

/**
 * Declara el recorrido de la pantalla. Los pasos deben ser estables (una constante del módulo):
 * se registran al montar y se quitan al salir de la pantalla.
 */
export function useTutorial(pasos: PasoTutorial[]) {
  const ctx = useContext(Contexto);
  const registrar = ctx?.registrar;
  useEffect(() => {
    if (!registrar) return;
    registrar(pasos);
    if (process.env.NODE_ENV !== "production") {
      // Aviso en desarrollo: un paso cuya zona no existe se salta sin decir nada al usuario.
      const t = setTimeout(() => {
        const faltan = pasos.filter((p) => !buscar(p)).map((p) => `«${p.titulo}» (${p.selector})`);
        if (faltan.length) console.warn(`[tutorial] Pasos sin zona en esta pantalla: ${faltan.join(", ")}`);
      }, 1500);
      return () => {
        clearTimeout(t);
        registrar(null);
      };
    }
    return () => registrar(null);
  }, [pasos, registrar]);
}

/** Birrete «Tutorial» del pie del sidebar, en todas las pantallas salvo que el usuario lo apague. */
export function BotonTutorial({ colapsado, className }: { colapsado: boolean; className?: string }) {
  const ctx = useContext(Contexto);
  const [pref] = usePreferencias();
  if (!ctx || !pref.tutoriales) return null;
  const propio = Boolean(ctx.pasos?.length);
  return (
    <button
      type="button"
      data-boton-tutorial
      onClick={() => ctx.iniciar()}
      title={colapsado ? "Tutorial" : propio ? "Recorrido guiado por esta pantalla" : "Recorrido guiado por la plataforma"}
      aria-label={propio ? "Abrir el tutorial de esta pantalla" : "Abrir el tutorial de la plataforma"}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2.5 font-label text-xs tracking-[0.08em] uppercase transition-colors border-l-2 whitespace-nowrap cursor-pointer",
        colapsado && "justify-center px-0 w-8",
        ctx.abierto ? "border-flesan-red bg-bg text-text" : "border-transparent text-muted hover:text-text hover:bg-bg",
        className,
      )}
    >
      <GraduationCap className={cn("w-4 h-4 shrink-0", ctx.abierto && "text-flesan-red")} />
      {!colapsado && "Tutorial"}
    </button>
  );
}

// ---------------------------------------------------------------- ofrecimiento

/** Tarjeta chica junto al birrete: «¿Te muestro cómo se usa?». No tapa la pantalla. */
function Ofrecimiento({ origen, onAceptar, onDescartar }: { origen: Origen; onAceptar: () => void; onDescartar: () => void }) {
  const [, setPref] = usePreferencias();
  const [pos, setPos] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    const ubicar = () => {
      const boton = document.querySelector("[data-boton-tutorial]");
      const r = boton?.getBoundingClientRect();
      // Al lado del sidebar, a la altura del birrete; sin sidebar (móvil), abajo a la izquierda.
      const borde = boton?.closest("aside")?.getBoundingClientRect().right ?? r?.right ?? 0;
      setPos(r && r.width ? { left: borde + 12, bottom: Math.max(window.innerHeight - r.bottom - 8, 16) } : { left: 16, bottom: 16 });
    };
    ubicar();
    window.addEventListener("resize", ubicar);
    return () => window.removeEventListener("resize", ubicar);
  }, []);

  if (!pos) return null;
  return createPortal(
    <div
      role="dialog"
      aria-labelledby="oferta-tutorial-titulo"
      className="fixed z-[60] w-[min(19rem,calc(100vw-2rem))] card shadow-xl p-4 flex flex-col gap-3 animate-fade-in"
      style={pos}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="w-8 h-8 shrink-0 rounded-xl inline-flex items-center justify-center bg-flesan-red/10 text-flesan-red">
          <GraduationCap className="w-4 h-4" />
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <p id="oferta-tutorial-titulo" className="text-sm font-semibold text-text leading-snug">
            {origen === "plataforma" ? "¿Te muestro cómo se usa la plataforma?" : "¿Te muestro cómo se usa esta pantalla?"}
          </p>
          <p className="text-xs text-muted leading-snug">Un recorrido corto, paso a paso. Lo puedes repetir con el birrete.</p>
        </div>
        <button type="button" onClick={onDescartar} aria-label="Cerrar" className="-mt-1 -mr-1 w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-faint hover:text-text hover:bg-surface-2 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onAceptar} className={cn(BOTON, "border-flesan-red bg-flesan-red text-white hover:bg-flesan-red-dark hover:border-flesan-red-dark")}>
          Ver recorrido
        </button>
        <button type="button" onClick={onDescartar} className={cn(BOTON, "border-border-strong text-muted hover:text-text hover:border-text")}>
          Ahora no
        </button>
        <button
          type="button"
          onClick={() => {
            onDescartar();
            setPref({ ofrecerTutoriales: false });
          }}
          className="text-xs text-faint hover:text-text cursor-pointer ml-auto"
        >
          No volver a ofrecer
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- recorrido

const MARGEN = 6; // aire entre la zona y el borde iluminado
const SEPARACION = 14; // distancia entre la zona y el globo
const ANCHO_GLOBO = 368;
const BORDE_PANTALLA = 16;

// Botones del globo con esquina suave (no los angulares de .btn-flesan, que se cortaban acá).
const BOTON =
  "inline-flex items-center justify-center gap-1 h-8 px-3.5 rounded-flesan border text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer";

type Lado = "abajo" | "arriba" | "derecha" | "izquierda" | "centro";
interface Caja {
  top: number;
  left: number;
  width: number;
  height: number;
}

function buscar(paso: PasoTutorial): HTMLElement | null {
  const todos = document.querySelectorAll<HTMLElement>(paso.selector);
  return todos[paso.indice ?? 0] ?? todos[0] ?? null;
}

function Recorrido({
  pasos,
  i,
  onIr,
  onCerrar,
  siguiente,
}: {
  pasos: PasoTutorial[];
  i: number;
  onIr: (i: number) => void;
  onCerrar: () => void;
  /** Acción extra en el último paso (ej. seguir con el recorrido de la plataforma). */
  siguiente?: { texto: string; onClick: () => void };
}) {
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;
  const [zona, setZona] = useState<Caja | null>(null);
  const [globo, setGlobo] = useState<{ top: number; left: number; lado: Lado; flecha: number } | null>(null);
  const globoRef = useRef<HTMLDivElement>(null);

  // Al cambiar de paso, la zona se trae al centro de la pantalla.
  useEffect(() => {
    buscar(paso)?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, [paso]);

  // Sigue la zona en cada cuadro (scroll suave, cambios de tamaño, filtros que mueven el layout).
  useLayoutEffect(() => {
    let raf = 0;
    let previa = "";
    const medir = () => {
      const el = buscar(paso);
      if (el) {
        const r = el.getBoundingClientRect();
        const caja = { top: r.top - MARGEN, left: r.left - MARGEN, width: r.width + MARGEN * 2, height: r.height + MARGEN * 2 };
        const clave = `${Math.round(caja.top)},${Math.round(caja.left)},${Math.round(caja.width)},${Math.round(caja.height)}`;
        if (clave !== previa) {
          previa = clave;
          setZona(caja);
        }
      }
      raf = requestAnimationFrame(medir);
    };
    medir();
    return () => cancelAnimationFrame(raf);
  }, [paso]);

  // Ubica el globo: abajo, arriba, a la derecha o a la izquierda de la zona, el primero que quepa.
  useLayoutEffect(() => {
    if (!zona || !globoRef.current) return;
    const g = globoRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = zona.left + zona.width / 2;
    const cy = zona.top + zona.height / 2;
    const fijarX = (x: number) => Math.min(Math.max(x, BORDE_PANTALLA), vw - g.width - BORDE_PANTALLA);
    const fijarY = (y: number) => Math.min(Math.max(y, BORDE_PANTALLA), vh - g.height - BORDE_PANTALLA);
    const abajo = zona.top + zona.height + SEPARACION;
    const arriba = zona.top - SEPARACION - g.height;
    const derecha = zona.left + zona.width + SEPARACION;
    const izquierda = zona.left - SEPARACION - g.width;

    let pos: { top: number; left: number; lado: Lado; flecha: number };
    if (abajo + g.height <= vh - BORDE_PANTALLA) {
      const left = fijarX(cx - g.width / 2);
      pos = { top: abajo, left, lado: "abajo", flecha: cx - left };
    } else if (arriba >= BORDE_PANTALLA) {
      const left = fijarX(cx - g.width / 2);
      pos = { top: arriba, left, lado: "arriba", flecha: cx - left };
    } else if (derecha + g.width <= vw - BORDE_PANTALLA) {
      const top = fijarY(cy - g.height / 2);
      pos = { top, left: derecha, lado: "derecha", flecha: cy - top };
    } else if (izquierda >= BORDE_PANTALLA) {
      const top = fijarY(cy - g.height / 2);
      pos = { top, left: izquierda, lado: "izquierda", flecha: cy - top };
    } else {
      // La zona ocupa casi toda la pantalla: el globo va abajo al centro, encima de ella.
      pos = { top: vh - g.height - BORDE_PANTALLA * 2, left: (vw - g.width) / 2, lado: "centro", flecha: 0 };
    }
    const largo = pos.lado === "abajo" || pos.lado === "arriba" ? g.width : g.height;
    pos.flecha = Math.min(Math.max(pos.flecha, 20), largo - 20);
    setGlobo(pos);
  }, [zona, i]);

  // Teclado: flechas para moverse, Esc para salir. El foco pasa al globo.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") {
        if (ultimo) onCerrar();
        else onIr(i + 1);
      } else if (e.key === "ArrowLeft" && i > 0) onIr(i - 1);
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [i, ultimo, onIr, onCerrar]);

  useEffect(() => {
    globoRef.current?.focus({ preventScroll: true });
  }, [i]);

  return createPortal(
    <div className="fixed inset-0 z-[70]" aria-live="polite">
      {/* Capa que bloquea la pantalla mientras dura el recorrido (también la zona iluminada). */}
      <div className="absolute inset-0" />

      {/* Zona iluminada: su sombra gigante es el velo sobre el resto de la pantalla. */}
      {zona && (
        <div
          aria-hidden
          className="absolute rounded-flesan outline-2 outline-flesan-red pointer-events-none transition-all duration-300 ease-out"
          style={{ top: zona.top, left: zona.left, width: zona.width, height: zona.height, boxShadow: "0 0 0 200vmax var(--color-tutorial-velo)" }}
        />
      )}

      <div
        ref={globoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-titulo"
        aria-describedby="tutorial-texto"
        tabIndex={-1}
        className={cn("absolute card shadow-lg p-4 flex flex-col gap-3 outline-none transition-[top,left,opacity] duration-300 ease-out", !globo && "opacity-0")}
        style={{ outline: "none", width: ANCHO_GLOBO, maxWidth: `calc(100vw - ${BORDE_PANTALLA * 2}px)`, top: globo?.top ?? 0, left: globo?.left ?? 0 }}
      >
        {globo && globo.lado !== "centro" && <Flecha lado={globo.lado} posicion={globo.flecha} />}

        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
            Paso {i + 1} de {pasos.length}
          </p>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar el tutorial"
            title="Cerrar (Esc)"
            className="-mt-1 -mr-1 w-7 h-7 flex items-center justify-center rounded-md text-faint hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 id="tutorial-titulo" className="text-[0.9375rem] font-semibold text-text leading-tight">
            {paso.titulo}
          </h2>
          <p id="tutorial-texto" className="text-sm text-muted leading-relaxed">
            {paso.texto}
          </p>
        </div>

        {/* Con flex-wrap, si no caben los puntos y los botones en una línea, los botones bajan. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
          {/* Puntos de avance (cuadrados, como el bullet de marca): el actual en rojo. */}
          <div className="flex items-center gap-1 shrink-0">
            {pasos.map((p, j) => (
              <button
                key={p.selector + j}
                type="button"
                onClick={() => onIr(j)}
                aria-label={`Ir al paso ${j + 1}: ${p.titulo}`}
                className={cn("w-2 h-2 transition-colors cursor-pointer", j === i ? "bg-flesan-red" : j < i ? "bg-muted" : "bg-border-strong")}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {i > 0 && !(ultimo && siguiente) && (
              <button type="button" onClick={() => onIr(i - 1)} className={cn(BOTON, "border-border-strong text-muted hover:text-text hover:border-text")}>
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
            )}
            {ultimo && siguiente && (
              <button type="button" onClick={siguiente.onClick} className={cn(BOTON, "border-border-strong text-muted hover:text-text hover:border-text")}>
                {siguiente.texto}
              </button>
            )}
            <button
              type="button"
              onClick={() => (ultimo ? onCerrar() : onIr(i + 1))}
              className={cn(BOTON, "border-flesan-red bg-flesan-red text-white hover:bg-flesan-red-dark hover:border-flesan-red-dark")}
            >
              {ultimo ? "Terminar" : "Siguiente"}
              {!ultimo && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Flecha del globo hacia la zona iluminada. */
function Flecha({ lado, posicion }: { lado: Exclude<Lado, "centro">; posicion: number }) {
  const estilo: CSSProperties =
    lado === "abajo"
      ? { top: -6, left: posicion - 6 }
      : lado === "arriba"
        ? { bottom: -6, left: posicion - 6 }
        : lado === "derecha"
          ? { left: -6, top: posicion - 6 }
          : { right: -6, top: posicion - 6 };
  const bordes = { abajo: "border-l border-t", arriba: "border-r border-b", derecha: "border-l border-b", izquierda: "border-r border-t" }[lado];
  return <span aria-hidden className={cn("absolute w-3 h-3 rotate-45 bg-surface border-border", bordes)} style={estilo} />;
}
