"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { ESTILOS_PORTALES, useEstiloPortales, type EstiloPortales } from "@/components/portales/estilo";
import { leerPreferencias, reemplazarPreferencias, usePreferencias } from "@/components/preferencias";

// SHELL · lleva las preferencias del navegador a la base (tabla preferencias_usuario) para que
// sigan al usuario en cualquier equipo. Al montar: si la base ya tiene preferencias, mandan esas;
// si está vacía, se sube lo del navegador. Después, cada cambio se guarda (con una pausa corta).
// Si la plataforma aún no tiene la tabla (la API responde 204), no hace nada.

const PAUSA_MS = 800;

export function SincronizarPreferencias() {
  const [pref] = usePreferencias();
  const [portales, elegirPortales] = useEstiloPortales();
  const { theme, setTheme } = useTheme();
  const estado = useRef<"cargando" | "activo" | "apagado">("cargando");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/configuracion/preferencias")
      .then(async (r) => {
        if (cancelado) return;
        if (r.status !== 200) {
          estado.current = "apagado";
          return;
        }
        const { preferencias } = (await r.json()) as { preferencias: Record<string, unknown> };
        if (preferencias && Object.keys(preferencias).length) {
          const { tema, portales: p, ...resto } = preferencias;
          reemplazarPreferencias({ ...leerPreferencias(), ...resto });
          if (typeof tema === "string") setTheme(tema);
          if (ESTILOS_PORTALES.some((e) => e.id === p)) elegirPortales(p as EstiloPortales);
          estado.current = "activo";
        } else {
          estado.current = "activo";
          guardar();
        }
      })
      .catch(() => {
        estado.current = "apagado";
      });
    return () => {
      cancelado = true;
    };
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function guardar() {
    const cuerpo = { preferencias: { ...leerPreferencias(), tema: theme ?? "system", portales } };
    fetch("/api/configuracion/preferencias", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }).catch(() => {});
  }

  // Cada cambio (preferencias, tema o portales) se guarda tras una pausa corta.
  useEffect(() => {
    if (estado.current !== "activo") return;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(guardar, PAUSA_MS);
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pref, theme, portales]);

  return null;
}
