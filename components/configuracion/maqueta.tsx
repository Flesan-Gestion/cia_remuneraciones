import { FlaskConical } from "lucide-react";

// Aviso común de las pantallas de Configuración que en el mockup son solo maqueta (datos de
// ejemplo, sin base). En una plataforma real se reemplazan los datos por las tablas del estándar.
export function AvisoMaqueta({ tablas }: { tablas: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-flesan border border-dashed border-border-strong bg-surface-2 px-4 py-3 text-xs text-muted">
      <FlaskConical className="w-4 h-4 shrink-0 mt-px" aria-hidden />
      <span>
        <b className="text-text font-semibold">Maqueta con datos de ejemplo.</b> Nada se guarda. En una plataforma real
        esta pantalla lee y escribe {tablas} en su esquema propio (ver «Base de datos de la plataforma» en el README).
      </span>
    </div>
  );
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fechaHora(d: Date | null) {
  if (!d) return "—";
  return `${d.getDate()} ${MESES[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function duracion(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
