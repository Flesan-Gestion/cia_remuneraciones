import { PageHeader } from "@/components/page-header";
import { RegistroActividadConectado } from "@/components/liquidaciones/actividad";

// Configuración › Registro de actividad (solo administradores; gate en ../layout.tsx).
export default function Pagina() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8 flex flex-col gap-4">
      <PageHeader
        title="Registro de actividad"
        className="mb-0"
        description="Quién descargó la liquidación de quién, los envíos por correo y los cambios de acceso. Busca por nombre o número de personal para ver quién vio la liquidación de una persona."
      />
      <RegistroActividadConectado />
    </div>
  );
}
