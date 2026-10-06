"use client";

import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { PantallaCompletaProvider, usePantallaCompleta } from "@/components/pantalla-completa";
import { AplicarPreferencias } from "@/components/preferencias";
import { SincronizarPreferencias } from "@/components/preferencias-sync";
import { FranjaAvisos } from "@/components/avisos";
import { WidgetCia } from "@/components/comentarios/widget";
import { ModulosProvider, SuperposicionesModulos, useVistaEspecialModulos } from "@/components/modulos";
import { TutorialProvider } from "@/components/tutorial/tutorial";

// SHELL · marco del dashboard: sidebar, barra superior y contenido (igual en todas las plataformas).
// Los módulos opcionales (ej. Presentaciones) se enchufan desde components/modulos.tsx.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PantallaCompletaProvider>
      <ModulosProvider>
        <AplicarPreferencias />
        <SincronizarPreferencias />
        <TutorialProvider>
          <Marco>{children}</Marco>
        </TutorialProvider>
      </ModulosProvider>
    </PantallaCompletaProvider>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  // En pantalla completa (reportería) se oculta el sidebar; la barra superior queda con la
  // ruta y el botón para salir.
  const { activa: pantallaCompleta } = usePantallaCompleta();
  // Un módulo opcional puede dibujar la vista a su manera (ej. modo diapositiva de Presentaciones).
  const especial = useVistaEspecialModulos(children);

  if (especial) return especial;

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      {!pantallaCompleta && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        <FranjaAvisos />
        <TopBar />
        {/* flex-col: la página hija tiene un alto resuelto contra el cual estirarse (un reporte
            que reparte la pantalla entre gráfico y tablas). scrollbar-gutter: el espacio de la
            barra de scroll queda reservado; si no, cuando la página cambia de alto por un píxel
            (al filtrar) la barra aparece o desaparece y todo el contenido cambia de ancho. */}
        <main className="flex-1 min-w-0 overflow-y-auto flex flex-col [scrollbar-gutter:stable]">{children}</main>
      </div>
      <SuperposicionesModulos />
      {/* Comentarios CIA: en pantalla completa no flota nada sobre el reporte. */}
      {!pantallaCompleta && <WidgetCia />}
    </div>
  );
}
