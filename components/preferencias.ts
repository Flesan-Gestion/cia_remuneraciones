"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

// SHELL · preferencias de cada usuario («Mi personalización»). Se guardan en este navegador y,
// si la plataforma ya tiene la tabla `preferencias_usuario`, también en la base
// (components/preferencias-sync.tsx), para que sigan al usuario en cualquier equipo. El tema lo maneja next-themes y el
// estilo del acceso a portales, components/portales/estilo.ts.

export interface Preferencias {
  /** Escala de toda la plataforma (la raíz rem), no solo del texto. */
  texto: "chico" | "normal" | "grande";
  densidad: "compacta" | "comoda";
  reducirAnimaciones: boolean;
  /** Ruta donde parte el usuario al entrar a la plataforma (null = Inicio). */
  inicio: string | null;
  /** Forma del botón de comentarios CIA: burbuja (por defecto), pestaña lateral o en la barra. */
  widgetCia: "burbuja" | "pestana" | "barra";
  /** Burbuja o pestaña reducida a su mínima expresión (media luna o línea en el borde). */
  widgetMinimizado: boolean;
  /** Muestra el botón «Tutorial» del sidebar en las pantallas que tienen recorrido guiado. */
  tutoriales: boolean;
  /** Ofrece el recorrido la primera vez que se entra a una pantalla que lo tiene (y a Inicio). */
  ofrecerTutoriales: boolean;
}

const POR_DEFECTO: Preferencias = {
  texto: "normal",
  densidad: "compacta",
  reducirAnimaciones: false,
  inicio: null,
  widgetCia: "burbuja",
  widgetMinimizado: false,
  tutoriales: true,
  ofrecerTutoriales: true,
};
const CLAVE = "cia-preferencias";
const EVENTO = "cia-preferencias";
const CLAVE_INICIO = "cia-inicio-aplicado";

let cache: { crudo: string | null; valor: Preferencias } = { crudo: null, valor: POR_DEFECTO };

function leer(): Preferencias {
  let crudo: string | null = null;
  try {
    crudo = localStorage.getItem(CLAVE);
  } catch {}
  // useSyncExternalStore exige la misma referencia mientras no cambie el valor guardado.
  if (crudo === cache.crudo) return cache.valor;
  let valor = POR_DEFECTO;
  try {
    valor = { ...POR_DEFECTO, ...(crudo ? JSON.parse(crudo) : {}) };
  } catch {}
  cache = { crudo, valor };
  return valor;
}

/** Lectura directa de lo guardado (para quien necesita el valor fuera de un render). */
export function leerPreferencias(): Preferencias {
  return leer();
}

/** Reemplaza las preferencias guardadas (ej. al traerlas de la base) y avisa a la página. */
export function reemplazarPreferencias(valor: Partial<Preferencias>) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ ...POR_DEFECTO, ...valor }));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

export function usePreferencias(): [Preferencias, (cambio: Partial<Preferencias>) => void, () => void] {
  const preferencias = useSyncExternalStore(suscribir, leer, () => POR_DEFECTO);
  function guardar(siguiente: Preferencias | null) {
    try {
      if (siguiente) localStorage.setItem(CLAVE, JSON.stringify(siguiente));
      else localStorage.removeItem(CLAVE);
    } catch {}
    window.dispatchEvent(new Event(EVENTO));
  }
  // Se parte de lo guardado (no del render) para que dos cambios seguidos no se pisen.
  return [preferencias, (cambio) => guardar({ ...leer(), ...cambio }), () => guardar(null)];
}

/** Aplica las preferencias a la página (atributos en <html> que lee app/shell.css). Se monta una
 * vez en el AppShell. */
export function AplicarPreferencias() {
  const [p] = usePreferencias();
  const router = useRouter();
  const pathname = usePathname();

  // Página de inicio preferida: solo la primera vez que se entra en la sesión del navegador y
  // solo si se entró por «/». Después, el ítem Inicio del menú sigue llevando a Inicio.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLAVE_INICIO)) return;
      sessionStorage.setItem(CLAVE_INICIO, "1");
    } catch {
      return;
    }
    const inicio = leer().inicio;
    if (pathname === "/" && inicio && inicio.startsWith("/") && !inicio.startsWith("//") && inicio !== "/") {
      router.replace(inicio);
    }
    // Solo al montar: es la entrada a la plataforma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const raiz = document.documentElement;
    if (p.texto === "normal") raiz.removeAttribute("data-texto");
    else raiz.setAttribute("data-texto", p.texto);
    raiz.setAttribute("data-densidad", p.densidad);
    raiz.toggleAttribute("data-reducir-animaciones", p.reducirAnimaciones);
  }, [p]);
  return null;
}
