import { PageHeader } from "@/components/page-header";
import { PanelPersonalizacion } from "@/components/personalizar";

// Configuración › Mi personalización: abierta a todos los usuarios.
export default function PersonalizacionPage() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8 flex flex-col gap-4">
      <PageHeader title="Mi personalización" className="mb-0" />
      <PanelPersonalizacion />
    </div>
  );
}
