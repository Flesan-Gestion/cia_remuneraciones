"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { ESTILOS_PORTALES, useEstiloPortales, type EstiloPortales } from "@/components/portales/estilo";
import { usePreferencias, type Preferencias } from "@/components/preferencias";
import { PersonalizacionModulos } from "@/components/modulos";
import { NAV_ITEMS } from "@/lib/nav";
import { Desplegable } from "@/components/desplegable";
import { reiniciarOfrecimientos } from "@/components/tutorial/tutorial";

/**
 * SHELL · «Mi personalización» (Configuración › Mi personalización): cómo ve y usa la plataforma
 * cada usuario. Se llega desde la tarjeta de Configuración o desde «Personalizar» del menú de
 * usuario. Todo se aplica al instante; por ahora se guarda en este navegador.
 */
export function PanelPersonalizacion() {
  const { theme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const [pref, cambiar, restablecer] = usePreferencias();
  const [reiniciado, setReiniciado] = useState(false);
  const [estilo, elegirEstilo] = useEstiloPortales();

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <span className="text-sm text-muted">
          Cómo ves y usas la plataforma. Se aplica al instante y, por ahora, se guarda en este navegador.
        </span>
        <button
          type="button"
          onClick={() => {
            restablecer();
            setTheme("system");
            elegirEstilo("media-luna");
          }}
          className="ml-auto font-label text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-muted hover:text-text cursor-pointer"
        >
          Restablecer
        </button>
      </div>

      <Seccion titulo="Apariencia">
        <Fila titulo="Tema" detalle="«Sistema» sigue la configuración de tu equipo.">
          <Segmento
            valor={montado ? (theme ?? "system") : undefined}
            opciones={[
              { valor: "light", texto: "Claro" },
              { valor: "dark", texto: "Oscuro" },
              { valor: "system", texto: "Sistema" },
            ]}
            onCambio={setTheme}
          />
        </Fila>
        <Fila titulo="Tamaño" detalle="Agranda o achica toda la plataforma, no solo el texto.">
          <Segmento<Preferencias["texto"]>
            valor={pref.texto}
            opciones={[
              { valor: "chico", texto: "Más chico" },
              { valor: "normal", texto: "Normal" },
              { valor: "grande", texto: "Más grande" },
            ]}
            onCambio={(v) => cambiar({ texto: v })}
          />
        </Fila>
        <Fila titulo="Densidad" detalle="Compacta muestra más datos por pantalla.">
          <Segmento<Preferencias["densidad"]>
            valor={pref.densidad}
            opciones={[
              { valor: "compacta", texto: "Compacta" },
              { valor: "comoda", texto: "Cómoda" },
            ]}
            onCambio={(v) => cambiar({ densidad: v })}
          />
        </Fila>
        <Fila titulo="Reducir animaciones" detalle="Quita transiciones y el latido de los indicadores.">
          <Interruptor
            activo={pref.reducirAnimaciones}
            etiqueta="Reducir animaciones"
            onCambio={(v) => cambiar({ reducirAnimaciones: v })}
          />
        </Fila>
      </Seccion>

      <Seccion titulo="Navegación">
        <Fila titulo="Acceso a portales CIA / SAP" detalle="Cómo se asoma el acceso en el sidebar." arriba>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Estilo del acceso a portales">
            {ESTILOS_PORTALES.map((op) => {
              const activo = op.id === estilo;
              return (
                <button
                  key={op.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegirEstilo(op.id)}
                  title={op.detalle}
                  className={cn(
                    "w-28 flex flex-col gap-1.5 p-1.5 rounded-flesan border text-left cursor-pointer transition-colors",
                    activo ? "border-flesan-red bg-bg" : "border-border hover:border-border-strong hover:bg-bg",
                  )}
                >
                  <Muestra estilo={op.id} />
                  <span className="flex items-center gap-1 px-0.5 font-label text-[0.6875rem] tracking-[0.08em] uppercase text-text">
                    {op.nombre}
                    {activo && <Check className="w-3 h-3 ml-auto text-flesan-red" />}
                  </span>
                </button>
              );
            })}
          </div>
        </Fila>
        <Fila titulo="Página de inicio" detalle="Dónde partes al entrar a la plataforma.">
          <Desplegable
            etiqueta="Página de inicio"
            valor={pref.inicio ?? "/"}
            onCambio={(v) => cambiar({ inicio: v === "/" ? null : v })}
            className="w-72"
            claseBoton="w-full justify-between"
            opciones={NAV_ITEMS.flatMap((item) =>
              item.children?.length
                ? item.children.map((h) => ({ valor: h.href, texto: `${item.label} › ${h.label}` }))
                : [{ valor: item.href, texto: item.label }],
            )}
          />
        </Fila>
      </Seccion>

      <Seccion titulo="Ayuda">
        <Fila titulo="Tutoriales" detalle="Muestra el birrete «Tutorial» en el sidebar: recorre la pantalla, o la plataforma si la pantalla no tiene recorrido propio.">
          <Interruptor activo={pref.tutoriales} etiqueta="Tutoriales" onCambio={(v) => cambiar({ tutoriales: v })} />
        </Fila>
        {pref.tutoriales && (
          <Fila titulo="Ofrecer al entrar" detalle="La primera vez que entras a una pantalla con recorrido, te pregunta si quieres verlo.">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  reiniciarOfrecimientos();
                  cambiar({ ofrecerTutoriales: true });
                  setReiniciado(true);
                }}
                className="text-xs text-muted hover:text-flesan-red cursor-pointer"
              >
                {reiniciado ? "Listo: se volverán a ofrecer" : "Volver a ofrecer todos"}
              </button>
              <Interruptor activo={pref.ofrecerTutoriales} etiqueta="Ofrecer tutoriales al entrar" onCambio={(v) => cambiar({ ofrecerTutoriales: v })} />
            </div>
          </Fila>
        )}
      </Seccion>

      <Seccion titulo="Comentarios CIA">
        <Fila titulo="Botón de comentarios" detalle="Dónde aparece el botón para escribirle al equipo CIA.">
          <Segmento<Preferencias["widgetCia"]>
            valor={pref.widgetCia}
            opciones={[
              { valor: "burbuja", texto: "Burbuja" },
              { valor: "pestana", texto: "Pestaña lateral" },
              { valor: "barra", texto: "En la barra superior" },
            ]}
            onCambio={(v) => cambiar({ widgetCia: v, widgetMinimizado: false })}
          />
        </Fila>
        {pref.widgetCia !== "barra" && (
          <Fila titulo="Minimizado" detalle="Queda solo una marca en el borde; un clic lo devuelve.">
            <Interruptor
              activo={pref.widgetMinimizado}
              etiqueta="Botón de comentarios minimizado"
              onCambio={(v) => cambiar({ widgetMinimizado: v })}
            />
          </Fila>
        )}
      </Seccion>

      <Seccion titulo="Datos">
        <Fila titulo="Montos y fechas" detalle="MM$ o miles; 28 sep 2026 o 28-09-2026.">
          <Proximamente />
        </Fila>
      </Seccion>

      <PersonalizacionModulos />

      <Seccion titulo="Avisos por correo" ultima>
        <Fila titulo="Qué correos recibir" detalle="Asignaciones, resumen semanal, datos atrasados.">
          <Proximamente />
        </Fila>
      </Seccion>
    </div>
  );
}

// Piezas del panel, exportadas para que un módulo agregue sus filas con el mismo formato.

export function Seccion({ titulo, ultima, children }: { titulo: string; ultima?: boolean; children: ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-4 px-6 py-5", !ultima && "border-b border-border")}>
      <h2 className="font-label text-xs font-semibold tracking-[0.12em] uppercase text-text">{titulo}</h2>
      {children}
    </section>
  );
}

export function Fila({ titulo, detalle, arriba, children }: { titulo: string; detalle: string; arriba?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col md:flex-row gap-2 md:gap-6", arriba ? "md:items-start" : "md:items-center")}>
      <div className="flex flex-col gap-0.5 md:w-72 shrink-0">
        <span className="text-sm font-semibold text-text">{titulo}</span>
        <span className="text-xs text-muted">{detalle}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Interruptor({ activo, etiqueta, onCambio }: { activo: boolean; etiqueta: string; onCambio: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onCambio(!activo)}
      className={cn("relative w-10 h-6 rounded-full transition-colors cursor-pointer", activo ? "bg-flesan-red" : "bg-border-strong")}
    >
      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", activo && "translate-x-4")} />
    </button>
  );
}

function Segmento<T extends string>({
  valor,
  opciones,
  onCambio,
}: {
  valor?: T;
  opciones: { valor: T; texto: string }[];
  onCambio: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-flesan-sm border border-border-strong overflow-hidden" role="radiogroup">
      {opciones.map((op) => (
        <button
          key={op.valor}
          type="button"
          role="radio"
          aria-checked={op.valor === valor}
          onClick={() => onCambio(op.valor)}
          className={cn(
            "px-3.5 py-1.5 text-[0.8125rem] border-r border-border-strong last:border-r-0 cursor-pointer transition-colors",
            op.valor === valor ? "bg-text text-bg" : "text-muted hover:text-text hover:bg-bg",
          )}
        >
          {op.texto}
        </button>
      ))}
    </div>
  );
}

function Proximamente() {
  return (
    <span className="font-label text-[0.625rem] tracking-[0.12em] uppercase text-faint border border-border px-2 py-0.5 rounded-flesan-sm">
      Próximamente
    </span>
  );
}

// Miniatura de cada estilo del acceso a portales: un trozo de sidebar con el acceso a escala.
function Muestra({ estilo }: { estilo: EstiloPortales }) {
  return (
    <span className="relative block h-12 rounded-[0.375rem] bg-surface border border-border overflow-hidden" aria-hidden>
      <span className="absolute inset-y-0 right-0 w-5 bg-bg border-l border-border" />
      {estilo === "lengueta" && <span className="acceso-portales lengueta-portales absolute left-0 top-2.5 w-3 h-7 rounded-r-md" />}
      {estilo === "media-luna" && (
        <span className="acceso-portales media-luna-portales absolute left-0 top-3.5 w-[0.9375rem] h-5 rounded-r-full" />
      )}
      {estilo === "cinta" && (
        <span className="acceso-portales absolute left-0 top-2 h-8 flex items-center gap-1">
          <span className="cinta-portales-linea w-[2px] h-full" />
          <span className="flex flex-col gap-0.5">
            <span className="w-[3px] h-2.5 rounded-full bg-(--portales-cia)" />
            <span className="w-[3px] h-2.5 rounded-full bg-(--portales-sap)" />
          </span>
        </span>
      )}
      {estilo === "burbuja" && (
        <span className="acceso-portales burbuja-portales absolute left-[calc(50%-1.375rem)] top-3 w-6 h-6 rounded-full [animation:none]" />
      )}
    </span>
  );
}
