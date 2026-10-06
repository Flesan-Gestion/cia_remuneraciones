import { PageHeader } from "@/components/page-header";
import { GestionAvisos } from "@/components/avisos";

// Configuración › Avisos (solo administradores; gate en layout.tsx).
export default function AvisosPage() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8 flex flex-col gap-4">
      <PageHeader title="Avisos" className="mb-0" />
      <GestionAvisos />
    </div>
  );
}
