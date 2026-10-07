import { PageHeader } from "@/components/page-header";
import { GeneradorLibro } from "@/components/libro/generador";

export default function FiniquitosPage() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8">
      <PageHeader
        title="Finiquitos"
        description="Excel con los finiquitos de SAP de una razón social, centro de costo y rango de semanas de pago: el detalle de cada finiquito con cada concepto en una columna, el resumen por persona y el resumen por obra. Lo que ves depende de tu rol. Cada descarga queda registrada."
      />
      <GeneradorLibro modulo="finiquitos" />
    </div>
  );
}
