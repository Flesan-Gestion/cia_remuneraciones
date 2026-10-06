"use client";

import type { ReactNode } from "react";

// PLATAFORMA · módulos opcionales enchufados al shell. Remuneraciones SAP no usa ninguno
// (versión mínima de docs/SHELL.md).
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
