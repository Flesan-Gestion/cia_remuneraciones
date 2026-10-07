import Link from "next/link";
import { ArrowRight, BookOpenText, FileSignature, FileText, Lock, Send, SplitSquareHorizontal, type LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";
import { resolverAcceso } from "@/lib/liquidaciones/acceso";
import { resolverAccesoLibro } from "@/lib/libro/acceso";
import { etiquetaRolLibro } from "@/lib/libro/tipos";
import { veProrrateado } from "@/lib/libro-prorrateado/tipos";
import { veFiniquitos } from "@/lib/finiquitos/tipos";

type Estado = "disponible" | "sin_acceso";

interface Modulo {
  href: string;
  titulo: string;
  descripcion: string;
  puntos: string[];
  icon: LucideIcon;
  estado: Estado;
  /** Texto chico bajo el título: el perfil o rol con que entra. */
  acceso?: string;
  /** Enlace secundario dentro de la tarjeta (ej. Envío por correo para RR.HH.). */
  extra?: { href: string; texto: string; icon: LucideIcon };
}

/**
 * Inicio: los cuatro aplicativos de remuneraciones de RR.HH. en un solo lugar. Cada tarjeta dice
 * si la persona puede entrar, según su perfil de liquidaciones o su rol en los libros y finiquitos.
 */
export default async function HomePage() {
  const session = await auth();
  const correo = session?.user?.email;
  const [acceso, accesoLibro] = correo ? await Promise.all([resolverAcceso(correo), resolverAccesoLibro(correo)]) : [null, null];
  const perfil = acceso?.perfil ?? "sin_acceso";
  const rolLibro = accesoLibro?.rol ?? null;
  const prorrateado = Boolean(accesoLibro && veProrrateado(accesoLibro));
  const finiquitos = Boolean(accesoLibro && veFiniquitos(accesoLibro));
  const nombre = session?.user?.name?.split(/\s+/)[0];

  const modulos: Modulo[] = [
    {
      href: "/liquidaciones",
      titulo: "Liquidaciones",
      descripcion: "Busca liquidaciones de sueldo por razón social, centro de costo, periodo o persona y descárgalas en PDF.",
      puntos: perfil === "rrhh" ? ["PDF de una persona o de todo un centro de costo", "Envío mensual por correo, con PDF protegido"] : ["PDF de una persona o de todo un centro de costo", "Vista previa antes de descargar"],
      icon: FileText,
      estado: perfil === "sin_acceso" ? "sin_acceso" : "disponible",
      acceso: perfil === "rrhh" ? "Perfil RR.HH." : perfil === "jefatura" ? "Perfil jefatura" : undefined,
      extra: perfil === "rrhh" ? { href: "/envios", texto: "Envío por correo", icon: Send } : undefined,
    },
    {
      href: "/libro-remuneraciones",
      titulo: "Libro de remuneraciones",
      descripcion: "Excel con una fila por persona, centro de costo y mes de pago, y cada concepto de la liquidación en una columna.",
      puntos: ["Haberes, descuentos, costo empresa e imponible", "Uno o varios meses en un solo archivo"],
      icon: BookOpenText,
      estado: rolLibro ? "disponible" : "sin_acceso",
      acceso: rolLibro ? `Rol ${etiquetaRolLibro(rolLibro)}` : undefined,
    },
    {
      href: "/libro-prorrateado",
      titulo: "Libro de remuneraciones prorrateado",
      descripcion: "El libro de remuneraciones con cada persona repartida entre centros de costo según su distribución en SAP.",
      puntos: ["Montos según el porcentaje de cada centro de costo", "Uno o varios meses en un solo archivo"],
      icon: SplitSquareHorizontal,
      estado: prorrateado ? "disponible" : "sin_acceso",
      acceso: prorrateado && rolLibro ? `Rol ${etiquetaRolLibro(rolLibro)}` : undefined,
    },
    {
      href: "/finiquitos",
      titulo: "Libro de finiquitos",
      descripcion: "Libro de finiquitos por razón social, centro de costo y semana de pago.",
      puntos: ["Detalle con cada concepto, resumen por persona y por obra", "Una o varias semanas de pago en un solo archivo"],
      icon: FileSignature,
      estado: finiquitos ? "disponible" : "sin_acceso",
      acceso: finiquitos && rolLibro ? `Rol ${etiquetaRolLibro(rolLibro)}` : undefined,
    },
  ];

  const sinNada = modulos.every((m) => m.estado !== "disponible");

  return (
    <div className="animate-fade-in page-shell py-8 lg:py-12">
      <header className="mb-8 lg:mb-10 max-w-3xl">
        <p className="label-eyebrow text-flesan-red! mb-2">Remuneraciones G2 · Grupo Flesan</p>
        <h1 className="display-title text-3xl sm:text-4xl text-text">{nombre ? `Hola, ${nombre}` : "Bienvenido"}</h1>
        <p className="body-lede mt-3">Elige el módulo al que quieres entrar. Liquidaciones, libros de remuneraciones y finiquitos, en un solo lugar.</p>
      </header>

      {sinNada && (
        <p className="mb-6 text-sm text-muted max-w-3xl">
          {acceso?.sinBase || accesoLibro?.sinBase
            ? "No se pudo verificar tu acceso. Intenta de nuevo en unos minutos."
            : "Todavía no tienes acceso a ningún módulo. Si lo necesitas para tu trabajo, pídelo a RR.HH."}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {modulos.map((m) => (
          <TarjetaModulo key={m.titulo} modulo={m} />
        ))}
      </div>
    </div>
  );
}

const ETIQUETA: Record<Estado, { texto: string; clase: string; icon: LucideIcon | null }> = {
  disponible: { texto: "Disponible", clase: "border-status-ok/40 text-status-ok bg-status-ok/10", icon: null },
  sin_acceso: { texto: "Sin acceso", clase: "", icon: Lock },
};

function TarjetaModulo({ modulo: m }: { modulo: Modulo }) {
  const disponible = m.estado === "disponible";
  const etiqueta = ETIQUETA[m.estado];
  const Icono = m.icon;

  const contenido = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "w-12 h-12 shrink-0 flex items-center justify-center rounded-flesan transition-colors",
            disponible ? "bg-flesan-red/10 text-flesan-red group-hover:bg-flesan-red group-hover:text-white" : "bg-surface-2 text-faint",
          )}
        >
          <Icono className="w-6 h-6" aria-hidden />
        </div>
        <span className={cn("badge", etiqueta.clase)}>
          {etiqueta.icon && <etiqueta.icon className="w-3 h-3" aria-hidden />}
          {etiqueta.texto}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className={cn("font-label font-semibold text-lg tracking-wide leading-tight", disponible ? "text-text" : "text-muted")}>{m.titulo}</h2>
        {m.acceso && <p className="label-meta text-faint">{m.acceso}</p>}
        <p className={cn("text-sm leading-snug", disponible ? "text-muted" : "text-faint")}>{m.descripcion}</p>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-muted">
        {m.puntos.map((p) => (
          <li key={p} className={cn(disponible ? "brand-bullet" : "text-faint")}>
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-2 flex items-center gap-2 text-sm font-semibold">
        {disponible ? (
          <span className="inline-flex items-center gap-1.5 text-flesan-red">
            Entrar
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </span>
        ) : (
          <span className="text-faint font-normal">Si lo necesitas para tu trabajo, pídelo a RR.HH.</span>
        )}
      </div>
    </>
  );

  const clase = cn("card dens-card flex flex-col gap-4 h-full min-h-60", disponible ? "card-hover group cursor-pointer" : "bg-surface-2/60");

  return (
    <div className="relative h-full">
      {disponible ? (
        <Link href={m.href} className={clase} aria-label={`Entrar a ${m.titulo}`}>
          {contenido}
        </Link>
      ) : (
        <div className={clase} aria-disabled>
          {contenido}
        </div>
      )}
      {disponible && m.extra && (
        <Link
          href={m.extra.href}
          className="absolute right-5 bottom-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-flesan-red transition-colors"
        >
          <m.extra.icon className="w-4 h-4" aria-hidden />
          {m.extra.texto}
        </Link>
      )}
    </div>
  );
}
