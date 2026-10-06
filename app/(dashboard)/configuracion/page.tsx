import Link from "next/link";
import { Activity, Info, Lock, Megaphone, MessageSquare, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/cn";

/**
 * Landing de /configuracion: tarjetas en dos grupos. «Para ti» lo ve cualquier usuario;
 * «Administración de la plataforma» solo los administradores (cada sección tiene además su propio
 * gate en el layout del grupo de rutas «(admin)»). Las que aún no existen quedan como «Próximamente» (ver el plan de tablas en
 * docs/SHELL.md). Al agregar una sección: una entrada aquí y en NAV_CONFIG de lib/nav.ts.
 */
interface Seccion {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Sin href = aún no existe (se muestra «Próximamente»). */
  href?: string;
}

const PARA_TI: Seccion[] = [
  {
    href: "/configuracion/personalizacion",
    title: "Mi personalización",
    description: "Tema, tamaño, densidad y el acceso a portales.",
    icon: SlidersHorizontal,
  },
  { href: "/configuracion/comentarios", title: "Mis comentarios", description: "Lo que enviaste con el botón de comentarios y en qué estado va.", icon: MessageSquare },
  { href: "/configuracion/acerca", title: "Acerca de", description: "Versión de la plataforma y del estándar, y contacto de soporte de la CIA.", icon: Info },
];

const ADMINISTRACION: Seccion[] = [
  {
    href: "/configuracion/usuarios",
    title: "Usuarios y roles",
    description: "Quién es administrador y quién ve liquidaciones: RR.HH. total, jefatura o sin acceso.",
    icon: Users,
  },
  { href: "/configuracion/actividad", title: "Registro de actividad", description: "Quién descargó la liquidación de quién, los envíos por correo y los cambios de acceso.", icon: Activity },
  { href: "/configuracion/avisos", title: "Avisos", description: "Franja para toda la plataforma, con fecha de inicio y término.", icon: Megaphone },
];

export default async function ConfiguracionPage() {
  const session = await auth();
  const admin = esAdmin(session?.user?.role);

  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8 flex flex-col gap-7">
      <PageHeader title="Configuración" className="mb-0" />
      <Grupo titulo="Para ti" secciones={PARA_TI} />
      {admin && (
        <Grupo
          titulo="Administración de la plataforma · solo administradores"
          icono={<Lock className="w-3.5 h-3.5" />}
          secciones={ADMINISTRACION}
          gris
        />
      )}
    </div>
  );
}

function Grupo({ titulo, icono, secciones, gris }: { titulo: string; icono?: React.ReactNode; secciones: Seccion[]; gris?: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-label text-xs font-semibold tracking-[0.12em] uppercase text-muted">
        {icono}
        {titulo}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {secciones.map((s) => (
          <Tarjeta key={s.title} seccion={s} gris={gris} />
        ))}
      </div>
    </section>
  );
}

function Tarjeta({ seccion: { href, title, description, icon: Icon }, gris }: { seccion: Seccion; gris?: boolean }) {
  const contenido = (
    <>
      <span
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-flesan",
          gris ? "bg-bg text-muted" : "bg-flesan-red/10 text-flesan-red",
        )}
      >
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[0.9375rem] font-semibold text-text">{title}</span>
        <span className="text-sm text-muted leading-snug">{description}</span>
      </span>
      {!href && (
        <span className="mt-auto self-start font-label text-[0.625rem] tracking-[0.12em] uppercase text-faint border border-border px-2 py-0.5 rounded-flesan-sm">
          Próximamente
        </span>
      )}
    </>
  );
  if (!href) {
    return <div className="card dens-card flex flex-col gap-3 h-full opacity-70">{contenido}</div>;
  }
  return (
    <Link href={href} className="card card-hover dens-card flex flex-col gap-3 h-full cursor-pointer">
      {contenido}
    </Link>
  );
}
