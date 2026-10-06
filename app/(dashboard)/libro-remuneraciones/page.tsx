import { PageHeader } from "@/components/page-header";
import { GeneradorLibro } from "@/components/libro/generador";

export default function LibroRemuneracionesPage() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8">
      <PageHeader
        title="Libro de remuneraciones"
        description="Excel con las liquidaciones de SAP de una razón social, centro de costo y rango de meses: una fila por persona, CC y mes de pago, con cada concepto en una columna. Lo que ves depende de tu rol. Cada descarga queda registrada."
      />
      <GeneradorLibro />
    </div>
  );
}
