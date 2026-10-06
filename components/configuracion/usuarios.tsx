"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Search, Trash2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Desplegable } from "@/components/desplegable";
import { AvisoMaqueta } from "@/components/configuracion/maqueta";
import { etiquetaRol, type Rol } from "@/lib/roles";

// Configuración › Usuarios y roles (opción A): la lista de quienes tienen acceso, con el rol
// editable en la misma fila, y «Agregar usuario» en un panel lateral que busca en el maestro de
// colaboradores. Maqueta: personas y áreas ficticias, nada se guarda. La versión conectada a la
// base (maestro corporativo + tabla usuarios) está en
// app/(dashboard)/configuracion/(admin)/usuarios/usuarios-client.tsx.

interface Persona {
  correo: string;
  nombre: string;
  cargo: string;
  empresa: string;
  area: string;
}

interface Usuario extends Persona {
  rol: Rol;
  /** Minutos desde el último acceso; null = nunca entró. */
  ultimoAcceso: number | null;
}

const ROLES: { valor: Rol; texto: string }[] = [
  { valor: "admin", texto: "Administrador" },
  { valor: "member", texto: "Miembro" },
];

/** Maestro de colaboradores de ejemplo (en una plataforma real: lib/colaboradores-db.ts). Empresas ficticias. */
const MAESTRO: Persona[] = [
  { correo: "crojas@flesan.cl", nombre: "Camila Rojas Fuentes", cargo: "Jefa de Contabilidad", empresa: "Flesan Servicios Compartidos", area: "Contabilidad" },
  { correo: "dmunoz@flesan.cl", nombre: "Diego Muñoz Torres", cargo: "Analista Financiero", empresa: "Flesan Constructora", area: "Finanzas" },
  { correo: "jaraya@flesan.cl", nombre: "Josefa Araya Pino", cargo: "Generalista de Personas", empresa: "Flesan Servicios Compartidos", area: "Personas" },
  { correo: "vsoto@flesan.cl", nombre: "Valentina Soto Lagos", cargo: "Subgerenta de Control de Gestión", empresa: "Flesan Constructora", area: "Control de Gestión" },
  { correo: "mfuentes@flesan.cl", nombre: "Matías Fuentes Rivas", cargo: "Jefe de Operaciones", empresa: "Flesan Minería", area: "Operaciones" },
  { correo: "bperez@flesan.cl", nombre: "Benjamín Pérez Olave", cargo: "Administrador de Obra", empresa: "Flesan Constructora", area: "Obras" },
  { correo: "fdiaz@flesan.cl", nombre: "Florencia Díaz Cortés", cargo: "Contadora", empresa: "Flesan Inmobiliaria", area: "Contabilidad" },
  { correo: "tsilva@flesan.cl", nombre: "Tomás Silva Herrera", cargo: "Ingeniero de Datos", empresa: "Flesan Servicios Compartidos", area: "Tecnología" },
  { correo: "areyes@flesan.cl", nombre: "Antonia Reyes Molina", cargo: "Analista de Remuneraciones", empresa: "Flesan Servicios Compartidos", area: "Personas" },
  { correo: "ivera@flesan.cl", nombre: "Ignacio Vera Campos", cargo: "Tesorero", empresa: "Flesan Inmobiliaria", area: "Finanzas" },
  { correo: "esalgado@flesan.cl", nombre: "Esteban Andrés Salgado Mujica", cargo: "Analista Contable", empresa: "Flesan Constructora", area: "Contabilidad" },
  { correo: "cnavarro@flesan.cl", nombre: "Catalina Navarro Ibáñez", cargo: "Ejecutiva Comercial", empresa: "Flesan Inmobiliaria", area: "Comercial" },
  { correo: "rcontreras@flesan.cl", nombre: "Rodrigo Contreras Vidal", cargo: "Jefe de Terreno", empresa: "Flesan Minería", area: "Obras" },
  { correo: "pmorales@flesan.cl", nombre: "Paula Morales Sepúlveda", cargo: "Analista de Control de Gestión", empresa: "Flesan Minería", area: "Control de Gestión" },
  { correo: "jgonzalez@flesan.cl", nombre: "Joaquín González Parra", cargo: "Ingeniero de Proyectos", empresa: "Flesan Constructora", area: "Ingeniería" },
  { correo: "mcastro@flesan.cl", nombre: "María José Castro Lillo", cargo: "Jefa Comercial", empresa: "Flesan Inmobiliaria", area: "Comercial" },
  { correo: "slopez@flesan.cl", nombre: "Sebastián López Gajardo", cargo: "Desarrollador", empresa: "Flesan Servicios Compartidos", area: "Tecnología" },
  { correo: "nvalenzuela@flesan.cl", nombre: "Nicolás Valenzuela Ruiz", cargo: "Supervisor de Operaciones", empresa: "Flesan Minería", area: "Operaciones" },
];

const INICIALES: { correo: string; rol: Rol; ultimoAcceso: number | null }[] = [
  { correo: "crojas@flesan.cl", rol: "admin", ultimoAcceso: 35 },
  { correo: "vsoto@flesan.cl", rol: "admin", ultimoAcceso: 60 * 5 },
  { correo: "tsilva@flesan.cl", rol: "admin", ultimoAcceso: 60 * 26 },
  { correo: "dmunoz@flesan.cl", rol: "member", ultimoAcceso: 60 * 20 },
  { correo: "jaraya@flesan.cl", rol: "member", ultimoAcceso: 60 * 24 * 3 },
  { correo: "fdiaz@flesan.cl", rol: "member", ultimoAcceso: 90 },
  { correo: "mfuentes@flesan.cl", rol: "member", ultimoAcceso: 60 * 24 * 9 },
  { correo: "areyes@flesan.cl", rol: "member", ultimoAcceso: 60 * 24 * 40 },
  { correo: "ivera@flesan.cl", rol: "member", ultimoAcceso: null },
  { correo: "pmorales@flesan.cl", rol: "member", ultimoAcceso: 60 * 3 },
];

const persona = (correo: string) => MAESTRO.find((p) => p.correo === correo)!;

/** Minúsculas y sin tildes, para comparar nombres como los escribe la gente. */
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Cada palabra buscada debe aparecer en el texto, en cualquier orden. */
function coincide(busqueda: string, ...campos: string[]) {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  const texto = normalizar(campos.join(" "));
  return palabras.every((p) => texto.includes(p));
}

function haceCuanto(minutos: number | null) {
  if (minutos === null) return "Nunca";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} d`;
}

function iniciales(nombre: string) {
  const p = nombre.split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 2 ? p[p.length - 2][0] : (p[1]?.[0] ?? ""))).toUpperCase();
}

export function UsuariosRoles() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(() => INICIALES.map((u) => ({ ...persona(u.correo), ...u })));
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<string>("");
  const [agregando, setAgregando] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);

  const admins = usuarios.filter((u) => u.rol === "admin").length;
  const visibles = useMemo(
    () =>
      usuarios
        .filter((u) => (!filtroRol || u.rol === filtroRol) && coincide(busqueda, u.nombre, u.correo, u.cargo, u.empresa, u.area))
        .sort((a, b) => Number(b.rol === "admin") - Number(a.rol === "admin") || a.nombre.localeCompare(b.nombre, "es")),
    [usuarios, filtroRol, busqueda],
  );

  /** Siempre debe quedar al menos un administrador. */
  const esUltimoAdmin = (u: Usuario) => u.rol === "admin" && admins === 1;

  function cambiarRol(u: Usuario, rol: Rol) {
    if (rol === u.rol) return;
    if (esUltimoAdmin(u)) {
      toast.error("Debe quedar al menos un administrador.");
      return;
    }
    setUsuarios((us) => us.map((x) => (x.correo === u.correo ? { ...x, rol } : x)));
    toast.success(`${u.nombre.split(" ")[0]} ahora es ${etiquetaRol(rol).toLowerCase()}.`);
  }

  function quitar(u: Usuario) {
    setUsuarios((us) => us.filter((x) => x.correo !== u.correo));
    setQuitando(null);
    toast.success(`${u.nombre} ya no tiene acceso.`);
  }

  function agregar(p: Persona, rol: Rol) {
    setUsuarios((us) => [...us, { ...p, rol, ultimoAcceso: null }]);
    toast.success(`${p.nombre} se agregó como ${etiquetaRol(rol).toLowerCase()}.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <AvisoMaqueta tablas="la tabla usuarios (db/001_usuarios_roles.sql), y busca en el maestro de colaboradores de la base transaccional (solo lectura)," />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-96">
          <span className="sr-only">Buscar usuario</span>
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cargo, empresa o área…"
            className="field-input rounded-full! pl-10! w-full!"
          />
        </label>
        <Desplegable
          variante="filtro"
          etiqueta="Rol"
          valor={filtroRol}
          activo={filtroRol !== ""}
          onCambio={setFiltroRol}
          opciones={[{ valor: "", texto: "Todos" }, ...ROLES.map((r) => ({ valor: r.valor, texto: r.texto, detalle: String(usuarios.filter((u) => u.rol === r.valor).length) }))]}
        />
        <button type="button" onClick={() => setAgregando(true)} className="btn-flesan btn-flesan-primary btn-flesan-sm rounded-flesan ml-auto">
          <UserPlus className="w-4 h-4" aria-hidden />
          Agregar usuario
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border bg-surface-2">
                {["Nombre", "Cargo", "Empresa", "Área", "Rol", "Último acceso", ""].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 font-label text-[0.6875rem] tracking-[0.1em] uppercase text-muted font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((u) => {
                const ultimo = esUltimoAdmin(u);
                return (
                  <tr key={u.correo} className="hover:bg-surface-2/60">
                    <td className="px-4 py-2.5 min-w-64">
                      <span className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={cn(
                            "w-8 h-8 shrink-0 rounded-full inline-flex items-center justify-center text-[0.6875rem] font-bold",
                            u.rol === "admin" ? "bg-flesan-red/10 text-flesan-red" : "bg-surface-2 text-muted",
                          )}
                        >
                          {iniciales(u.nombre)}
                        </span>
                        <span className="flex flex-col min-w-0">
                          <span className="font-semibold text-text truncate">{u.nombre}</span>
                          <span className="text-xs text-muted truncate">{u.correo}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text">{u.cargo}</td>
                    <td className="px-4 py-2.5 text-muted">{u.empresa}</td>
                    <td className="px-4 py-2.5 text-muted whitespace-nowrap">{u.area}</td>
                    <td className="px-4 py-2.5">
                      <span title={ultimo ? "Es el único administrador: no se puede cambiar." : undefined}>
                        <Desplegable
                          etiqueta={`Rol de ${u.nombre}`}
                          valor={u.rol}
                          onCambio={(v) => cambiarRol(u, v as Rol)}
                          deshabilitado={ultimo}
                          opciones={ROLES}
                          claseBoton="h-8! text-xs! w-36 justify-between"
                        />
                      </span>
                    </td>
                    <td className={cn("px-4 py-2.5 whitespace-nowrap", u.ultimoAcceso === null ? "text-faint" : "text-muted")}>{haceCuanto(u.ultimoAcceso)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {quitando === u.correo ? (
                        <span className="inline-flex items-center gap-2 text-xs text-muted">
                          ¿Quitar acceso?
                          <button type="button" onClick={() => quitar(u)} className="btn-flesan btn-flesan-primary btn-flesan-sm rounded-flesan">
                            Quitar
                          </button>
                          <button type="button" onClick={() => setQuitando(null)} className="btn-flesan btn-flesan-ghost btn-flesan-sm rounded-flesan">
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQuitando(u.correo)}
                          disabled={ultimo}
                          title={ultimo ? "Es el único administrador" : "Quitar acceso"}
                          aria-label={`Quitar acceso a ${u.nombre}`}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-faint hover:text-flesan-red hover:bg-bg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!visibles.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    {usuarios.length ? "Nadie coincide con la búsqueda." : "Nadie tiene acceso todavía."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-t border-border text-xs text-muted">
          <span>
            {usuarios.length} usuarios · {admins} {admins === 1 ? "administrador" : "administradores"}
          </span>
          <span className="text-faint">Quien no está en la lista entra como miembro si la plataforma lo permite, o no entra.</span>
        </div>
      </div>

      {agregando && <PanelAgregar existentes={usuarios} onAgregar={agregar} onCerrar={() => setAgregando(false)} />}
    </div>
  );
}

/** Panel lateral: busca en el maestro de colaboradores, elige el rol y agrega. */
function PanelAgregar({ existentes, onAgregar, onCerrar }: { existentes: Usuario[]; onAgregar: (p: Persona, rol: Rol) => void; onCerrar: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [elegida, setElegida] = useState<Persona | null>(null);
  const [rol, setRol] = useState<Rol>("member");
  const buscador = useRef<HTMLInputElement>(null);
  const ya = new Set(existentes.map((u) => u.correo));
  const resultados = busqueda.trim() ? MAESTRO.filter((p) => coincide(busqueda, p.nombre, p.correo, p.cargo, p.empresa, p.area)).slice(0, 8) : [];

  useEffect(() => {
    buscador.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="listbox"]')) onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/30 cursor-default" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="agregar-usuario-titulo"
        className="relative w-full max-w-[26rem] h-full bg-surface border-l border-border shadow-2xl flex flex-col animate-fade-in"
      >
        <header className="flex items-center gap-2 px-5 h-14 border-b border-border shrink-0">
          <h2 id="agregar-usuario-titulo" className="text-base font-bold text-text">
            Agregar usuario
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-bg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 p-5 overflow-y-auto">
          <label className="relative block">
            <span className="sr-only">Buscar en el maestro de colaboradores</span>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
            <input
              ref={buscador}
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setElegida(null);
              }}
              placeholder="Nombre, apellido, cargo, empresa o área…"
              className="field-input rounded-full! pl-10! w-full!"
            />
          </label>

          {!busqueda.trim() ? (
            <p className="text-xs text-muted">
              Busca en el maestro de colaboradores. Puedes escribir cualquiera de los nombres y apellidos, en cualquier orden: «Esteban Salgado» encuentra a Esteban Andrés Salgado Mujica.
            </p>
          ) : resultados.length === 0 ? (
            <p className="text-sm text-muted">Nadie en el maestro coincide con «{busqueda}».</p>
          ) : (
            <ul className="flex flex-col gap-1" aria-label="Resultados">
              {resultados.map((p) => {
                const tiene = ya.has(p.correo);
                const activa = elegida?.correo === p.correo;
                return (
                  <li key={p.correo}>
                    <button
                      type="button"
                      disabled={tiene}
                      onClick={() => setElegida(p)}
                      aria-pressed={activa}
                      className={cn(
                        "w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors cursor-pointer disabled:cursor-default",
                        activa ? "border-flesan-red bg-flesan-red/5" : "border-transparent hover:bg-bg",
                        tiene && "opacity-55",
                      )}
                    >
                      <span aria-hidden className="w-8 h-8 shrink-0 rounded-full inline-flex items-center justify-center text-[0.6875rem] font-bold bg-surface-2 text-muted">
                        {iniciales(p.nombre)}
                      </span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-text truncate">{p.nombre}</span>
                        <span className="text-xs text-muted truncate">
                          {p.cargo} · {p.empresa} · {p.area}
                        </span>
                      </span>
                      {tiene && <span className="text-[0.6875rem] text-faint shrink-0">Ya tiene acceso</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="mt-auto flex flex-col gap-3 p-5 border-t border-border shrink-0">
          {elegida ? (
            <p className="text-sm text-text">
              <b className="font-semibold">{elegida.nombre}</b> <span className="text-muted">· {elegida.cargo} · {elegida.empresa}</span>
            </p>
          ) : (
            <p className="text-sm text-faint">Elige a una persona de los resultados.</p>
          )}
          <div className="flex items-center gap-2">
            <Desplegable etiqueta="Rol" conRotulo valor={rol} onCambio={(v) => setRol(v as Rol)} opciones={ROLES} />
            <button
              type="button"
              disabled={!elegida}
              onClick={() => {
                if (!elegida) return;
                onAgregar(elegida, rol);
                onCerrar();
              }}
              className="btn-flesan btn-flesan-primary rounded-flesan ml-auto disabled:opacity-40"
            >
              Agregar
            </button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
