"use server";

import { signOut } from "@/auth";

/** Cierra la sesión y vuelve a la pantalla de login. Usado por el UserMenu. */
export async function cerrarSesion() {
  await signOut({ redirectTo: "/login" });
}
