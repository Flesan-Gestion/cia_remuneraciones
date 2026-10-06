import { PageHeader } from "@/components/page-header";
import { MisComentarios } from "@/components/mis-comentarios";

// Configuración › Mis comentarios: abierta a todos los usuarios.
export default function ComentariosPage() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8 flex flex-col gap-4">
      <PageHeader title="Mis comentarios" className="mb-0" />
      <MisComentarios />
    </div>
  );
}
