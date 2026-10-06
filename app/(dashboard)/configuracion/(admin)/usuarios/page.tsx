import { PageHeader } from "@/components/page-header";
import { UsuariosAcceso } from "@/components/liquidaciones/usuarios-acceso";

// Configuración › Usuarios y roles (solo administradores; gate en ../layout.tsx).
export default function UsuariosPage() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8 flex flex-col gap-4">
      <PageHeader
        title="Usuarios y roles"
        className="mb-0"
        description="Qué ve cada persona en Liquidaciones y en los libros de remuneraciones y finiquitos, y en qué centros de costo está. Haz clic en una persona para cambiar su acceso, o usa la pestaña Centros de costo para ver y cambiar encargado, visitador y GGO de cada centro."
      />
      <UsuariosAcceso />
    </div>
  );
}
