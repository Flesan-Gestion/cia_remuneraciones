import { PageHeader } from "@/components/page-header";
import { GeneradorLibro } from "@/components/libro/generador";

export default function LibroProrrateadoPage() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8">
      <PageHeader
        title="Libro de remuneraciones prorrateado"
        description="Excel del libro de remuneraciones con cada persona repartida entre los centros de costo de su distribución en SAP: una fila por persona, mes y centro de costo, con el porcentaje y cada concepto prorrateado. Lo que ves depende de tu rol. Cada descarga queda registrada."
      />
      <GeneradorLibro modulo="prorrateado" />
    </div>
  );
}
