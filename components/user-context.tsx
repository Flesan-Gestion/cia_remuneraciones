"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Rol } from "@/lib/roles";

export interface UsuarioActual {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: Rol;
  /** Perfil propio de la plataforma (ej. "gerencia" | "vendedor"), si la plataforma los usa. El
   * menú oculta los ítems cuyo `perfiles` no lo incluye (lib/nav-base.ts, visibleEnMenu). */
  perfil?: string | null;
}

const UserContext = createContext<UsuarioActual | null>(null);

// Publica el usuario de la sesión (resuelto server-side en el layout) para que
// cualquier client component del dashboard pueda leer su rol sin repetir auth().
export function UserProvider({ user, children }: { user: UsuarioActual | null; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUsuarioActual(): UsuarioActual | null {
  return useContext(UserContext);
}
