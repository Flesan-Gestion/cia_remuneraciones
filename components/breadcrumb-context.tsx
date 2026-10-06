"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface BreadcrumbState {
  items: string[];
  onNavigate: (index: number) => void;
}

interface BreadcrumbContextValue {
  state: BreadcrumbState | null;
  setState: (state: BreadcrumbState | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

// Permite que una pagina con navegacion interna (ej. un drill-down con estado
// propio) publique sus niveles. El TopBar los agrega despues de la ruta que sale
// de la URL (migasDe en lib/nav.ts): Inicio > Ventas > Gerencia > [Zona Centro > ...].
// `items` son solo los niveles del drilldown; onNavigate(i) vuelve al nivel i.
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BreadcrumbState | null>(null);
  return <BreadcrumbContext.Provider value={{ state, setState }}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbContext(): BreadcrumbContextValue {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) throw new Error("useBreadcrumbContext debe usarse dentro de BreadcrumbProvider");
  return ctx;
}
