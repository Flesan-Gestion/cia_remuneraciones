import Link from "next/link";
import paquete from "@/package.json";
import { PageHeader } from "@/components/page-header";
import { NOMBRE_PLATAFORMA, VERSION_SHELL } from "@/lib/nav";

// Configuración › Acerca de: abierta a todos. La versión sale de package.json y la del estándar,
// de lib/nav-base.ts (se actualiza al traer una versión nueva del shell).
export default function AcercaPage() {
  const filas: [string, string][] = [
    ["Plataforma", `${NOMBRE_PLATAFORMA.texto} ${NOMBRE_PLATAFORMA.destacado}`.trim()],
    ["Versión", paquete.version],
    ["Estándar de plataformas", VERSION_SHELL],
    ["Entorno", process.env.NODE_ENV === "production" ? "Producción" : "Desarrollo"],
  ];
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8 flex flex-col gap-4">
      <PageHeader title="Acerca de" className="mb-0" />
      <div className="card overflow-hidden p-0 max-w-2xl">
        <dl className="divide-y divide-border">
          {filas.map(([k, v]) => (
            <div key={k} className="flex items-center gap-6 px-5 py-3">
              <dt className="font-label text-xs tracking-[0.1em] uppercase text-muted w-56 shrink-0">{k}</dt>
              <dd className="text-sm text-text">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="px-5 py-4 border-t border-border bg-surface-2 flex flex-col gap-1.5 text-sm text-muted">
          <span>
            Desarrollada por la CIA · Grupo Flesan. <span className="text-text">Confianza que construye.</span>
          </span>
          <span>
            ¿Algo no funciona o tienes una idea? Usa el botón de comentarios, abajo a la derecha, y sigue su estado en{" "}
            <Link href="/configuracion/comentarios" className="text-flesan-red hover:underline">
              Mis comentarios
            </Link>
            .
          </span>
        </div>
      </div>
    </div>
  );
}
