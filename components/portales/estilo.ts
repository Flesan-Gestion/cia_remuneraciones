"use client";

import { useSyncExternalStore } from "react";

// Estilo del acceso a portales (CIA / SAP) del sidebar, elegido por cada usuario en
// «Personalizar» (menú de usuario). Se recuerda en este navegador.

export const ESTILOS_PORTALES = [
  { id: "lengueta", nombre: "Lengüeta", detalle: "Asoma desde el borde, arriba de Configuración" },
  { id: "media-luna", nombre: "Media luna", detalle: "Se desliza como píldora al pasar el mouse" },
  { id: "cinta", nombre: "Cinta", detalle: "Línea fina con el rótulo CIA / SAP" },
  { id: "burbuja", nombre: "Burbuja", detalle: "Círculo que late; se arrastra por el sidebar" },
] as const;

export type EstiloPortales = (typeof ESTILOS_PORTALES)[number]["id"];

const CLAVE = "cia-estilo-portales";
const EVENTO = "cia-estilo-portales";
const POR_DEFECTO: EstiloPortales = "media-luna";

function leer(): EstiloPortales {
  try {
    const v = localStorage.getItem(CLAVE);
    if (ESTILOS_PORTALES.some((e) => e.id === v)) return v as EstiloPortales;
  } catch {}
  return POR_DEFECTO;
}

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

export function useEstiloPortales(): [EstiloPortales, (e: EstiloPortales) => void] {
  const estilo = useSyncExternalStore(suscribir, leer, () => POR_DEFECTO);
  function elegir(e: EstiloPortales) {
    try {
      localStorage.setItem(CLAVE, e);
    } catch {}
    window.dispatchEvent(new Event(EVENTO));
  }
  return [estilo, elegir];
}
