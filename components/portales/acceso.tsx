"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as EventoPuntero } from "react";
import { cn } from "@/lib/cn";
import { CiaLogo } from "@/components/cia-logo";
import { HAY_PORTALES, LogoSap, PanelPortales, useCierreFuera } from "@/components/portales/panel";
import { useEstiloPortales } from "@/components/portales/estilo";

/**
 * Acceso a los portales del grupo (Portal CIA y SAP Work Zone) en el sidebar, en el estilo que el
 * usuario eligió en «Personalizar». Se monta dentro del `aside`, entre la navegación y el pie.
 * Todos los estilos abren el mismo panel (`PanelPortales`) y usan los tonos pastel `--portales-*`.
 */
export function AccesoPortales() {
  const [estilo] = useEstiloPortales();
  if (!HAY_PORTALES) return null;
  if (estilo === "media-luna") return <MediaLuna />;
  if (estilo === "cinta") return <Cinta />;
  if (estilo === "burbuja") return <Burbuja />;
  return <Lengueta />;
}

const ETIQUETA = "Portales del grupo: Portal CIA y SAP Work Zone";

/** Estado abierto/cerrado + cierre con clic fuera o Esc. */
function useDesplegable() {
  const [abierta, setAbierta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useCierreFuera(abierta, raiz, () => setAbierta(false));
  return { abierta, setAbierta, raiz };
}

// Lengüeta: asoma desde el borde izquierdo, justo arriba del pie. Mitad CIA arriba, SAP abajo.
function Lengueta() {
  const { abierta, setAbierta, raiz } = useDesplegable();
  return (
    <div ref={raiz} className="relative h-0 z-50">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierta}
        aria-label={ETIQUETA}
        title="Portal CIA · SAP Work Zone"
        className="acceso-portales lengueta-portales absolute left-0 bottom-3 w-10 h-20 flex flex-col items-center justify-evenly rounded-r-xl cursor-pointer"
      >
        <CiaLogo className="w-5 h-5 text-(--portales-cia)" />
        <LogoSap className="w-8 h-4" fondo="fill-(--portales-sap)" texto="fill-(--portales-sap-texto)" />
      </button>
      {abierta && <PanelPortales onCerrar={() => setAbierta(false)} className="left-full bottom-0 ml-3" />}
    </div>
  );
}

// Media luna: en reposo asoma un disco que alterna, en carrusel, el logo del Portal CIA y el de
// SAP (con su color de fondo). Al pasar el mouse se desliza como píldora «CIA / SAP» y al
// presionarla el desplegable sale justo encima, dentro del sidebar.
function MediaLuna() {
  const { abierta, setAbierta, raiz } = useDesplegable();
  return (
    <div ref={raiz} className="relative h-0 z-50">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierta}
        aria-label={ETIQUETA}
        title="Portal CIA · SAP Work Zone"
        className={cn(
          "acceso-portales media-luna-portales absolute left-0 bottom-3 h-11 overflow-hidden rounded-r-full cursor-pointer",
          "w-9 hover:w-[5.25rem] focus-visible:w-[5.25rem]",
          abierta && "w-[5.25rem]",
        )}
      >
        {/* Reposo: fondo y logo alternan CIA → SAP */}
        <span className="ml-fondo absolute inset-0" aria-hidden />
        <span className="ml-reposo absolute inset-y-0 left-0 w-9 overflow-hidden" aria-hidden>
          <span className="ml-cia absolute inset-0 flex items-center justify-center">
            <CiaLogo className="w-[1.125rem] h-[1.125rem] text-(--portales-cia)" />
          </span>
          <span className="ml-sap absolute inset-0 flex items-center justify-center">
            <LogoSap className="w-[1.625rem] h-[0.8125rem]" fondo="fill-(--portales-sap)" texto="fill-(--portales-sap-texto)" />
          </span>
        </span>
        {/* Abierta o con el mouse encima: los dos portales juntos */}
        <span className="ml-abierta relative h-full flex items-center gap-1.5 pl-2">
          <CiaLogo className="w-4 h-4 shrink-0 text-(--portales-cia)" />
          <span className="font-display text-[0.9375rem] font-extrabold italic leading-none text-muted shrink-0">/</span>
          <LogoSap className="w-7 h-3.5 shrink-0" fondo="fill-(--portales-sap)" texto="fill-(--portales-sap-texto)" />
        </span>
      </button>
      {abierta && (
        <PanelPortales onCerrar={() => setAbierta(false)} className="panel-portales-arriba left-1.5 bottom-16 w-[14.25rem]" />
      )}
    </div>
  );
}

// Cinta: línea fina rojo-azul en el borde con el rótulo vertical «CIA / SAP»; al pasar el mouse
// se vuelve una cinta de color.
function Cinta() {
  const { abierta, setAbierta, raiz } = useDesplegable();
  return (
    <div ref={raiz} className="relative h-0 z-50">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierta}
        aria-label={ETIQUETA}
        title="Portal CIA · SAP Work Zone"
        className={cn("acceso-portales cinta-portales group absolute left-0 bottom-3 h-24 flex items-center cursor-pointer", abierta && "is-abierta")}
      >
        <span className="cinta-portales-linea w-[3px] h-full rounded-r-sm" aria-hidden />
        <span className="cinta-portales-rotulo h-full flex items-center justify-center rounded-r-lg">
          <span className="[writing-mode:vertical-rl] font-display text-[0.75rem] font-extrabold italic uppercase tracking-[0.14em] whitespace-nowrap">
            <span className="text-(--portales-cia)">CIA</span> <span className="text-muted">/</span>{" "}
            <span className="text-(--portales-sap)">SAP</span>
          </span>
        </span>
      </button>
      {abierta && <PanelPortales onCerrar={() => setAbierta(false)} className="left-full bottom-0 ml-3" />}
    </div>
  );
}

const CLAVE_BURBUJA = "cia-burbuja-portales";
const TAMANO_BURBUJA = 48;
const UMBRAL_ARRASTRE = 4;

// Burbuja: círculo con el corte diagonal CIA / SAP que late; se arrastra hacia arriba o abajo por
// el sidebar (entre el encabezado y el pie) y recuerda su altura en este navegador.
function Burbuja() {
  const [y, setY] = useState(180);
  const [abierta, setAbierta] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [desfase, setDesfase] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ inicioY: number; yInicial: number; movio: boolean } | null>(null);
  useCierreFuera(abierta, raiz, () => setAbierta(false));

  // Límite vertical: entre el encabezado y el pie del sidebar, para no tapar esos controles.
  function acotar(valor: number) {
    const encabezado = document.querySelector<HTMLElement>("[data-sidebar-encabezado]");
    const pie = document.querySelector<HTMLElement>("[data-sidebar-pie]");
    const min = (encabezado ? encabezado.offsetTop + encabezado.offsetHeight : 0) + 16;
    const max = (pie ? pie.offsetTop : window.innerHeight) - TAMANO_BURBUJA - 16;
    return Math.max(min, Math.min(valor, max));
  }

  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_BURBUJA) ?? "null");
      if (typeof guardado?.y === "number") setY(acotar(guardado.y));
    } catch {}
    // Al colapsar el sidebar o cambiar el alto de la ventana, se reacomoda dentro de los límites.
    const reacomodar = () => setY((v) => acotar(v));
    const observador = new ResizeObserver(reacomodar);
    const pie = document.querySelector("[data-sidebar-pie]");
    if (pie) observador.observe(pie);
    if (pie?.parentElement) observador.observe(pie.parentElement);
    return () => observador.disconnect();
  }, []);

  // El desplegable se centra en la burbuja sin salirse de la ventana.
  useLayoutEffect(() => {
    if (!abierta || !raiz.current || !panel.current) return;
    const arriba = raiz.current.getBoundingClientRect().top;
    const alto = panel.current.offsetHeight;
    const centrado = arriba + TAMANO_BURBUJA / 2 - alto / 2;
    setDesfase(Math.max(8, Math.min(centrado, window.innerHeight - alto - 8)) - arriba);
  }, [abierta, y]);

  function guardar(valor: number) {
    setY(valor);
    try {
      localStorage.setItem(CLAVE_BURBUJA, JSON.stringify({ y: valor }));
    } catch {}
  }

  function alPresionar(e: EventoPuntero<HTMLButtonElement>) {
    arrastre.current = { inicioY: e.clientY, yInicial: y, movio: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function alMover(e: EventoPuntero<HTMLButtonElement>) {
    const a = arrastre.current;
    if (!a) return;
    const delta = e.clientY - a.inicioY;
    if (!a.movio && Math.abs(delta) < UMBRAL_ARRASTRE) return;
    a.movio = true;
    setArrastrando(true);
    setAbierta(false);
    setY(acotar(a.yInicial + delta));
  }

  function alSoltar() {
    const a = arrastre.current;
    arrastre.current = null;
    setArrastrando(false);
    if (!a) return;
    if (a.movio) guardar(acotar(y));
    else setAbierta((v) => !v);
  }

  return (
    // Franja del ancho del sidebar: centra la burbuja y deja que el desplegable abra justo afuera.
    <div ref={raiz} className="absolute inset-x-0 z-50 flex justify-center pointer-events-none" style={{ top: y }}>
      <button
        type="button"
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onKeyDown={(e) => {
          // Teclado: Enter/Espacio abre; flechas mueven la burbuja.
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            guardar(acotar(y + (e.key === "ArrowUp" ? -24 : 24)));
          }
        }}
        onClick={(e) => {
          // El clic de puntero se resuelve en alSoltar; aquí solo el del teclado.
          if (e.detail === 0) setAbierta((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={abierta}
        aria-label={`${ETIQUETA} (arrastra para mover)`}
        title="Portales · arrastra para mover"
        className={cn(
          "acceso-portales burbuja-portales pointer-events-auto relative rounded-full overflow-hidden touch-none select-none",
          arrastrando ? "cursor-grabbing" : "cursor-pointer",
        )}
        style={{ width: TAMANO_BURBUJA, height: TAMANO_BURBUJA }}
      >
        <CiaLogo className="absolute left-[9px] top-[9px] w-4 h-4 text-(--portales-cia)" />
        <LogoSap
          className="absolute right-[6px] bottom-[11px] w-[22px] h-[11px]"
          fondo="fill-(--portales-sap)"
          texto="fill-(--portales-sap-texto)"
        />
        {/* Barra del corte: la misma diagonal del fondo */}
        <span className="absolute -inset-y-1 left-1/2 w-px -translate-x-1/2 rotate-[40deg] bg-surface" aria-hidden />
      </button>
      {abierta && (
        <PanelPortales
          panelRef={panel}
          onCerrar={() => setAbierta(false)}
          className="pointer-events-auto left-full ml-3"
          style={{ top: desfase }}
        />
      )}
    </div>
  );
}
