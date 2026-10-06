import { PageHeader } from "@/components/page-header";
import { GeneradorLiquidaciones } from "@/components/liquidaciones/generador";

export default function LiquidacionesPage() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8">
      <PageHeader
        title="Liquidaciones"
        description="Busca las liquidaciones de remuneraciones de SAP por razón social, centro de costo, periodo o persona, revisa la lista y descarga el PDF de las que elijas. Cada descarga queda registrada."
      />
      <GeneradorLiquidaciones />
    </div>
  );
}
