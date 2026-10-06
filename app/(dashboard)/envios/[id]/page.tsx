import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { LoteEnvio } from "@/components/liquidaciones/lote";
import { leerLote } from "@/lib/liquidaciones/envios-db";
import { periodoLegible } from "@/lib/liquidaciones/formato";

export default async function LotePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const lote = await leerLote(id).catch(() => null);
  if (!lote) notFound();
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8">
      <PageHeader title={`Envío de ${periodoLegible(lote.periodo)}`} className="mb-4" />
      <LoteEnvio id={id} />
    </div>
  );
}
