import { PageHeader } from "@/components/page-header";
import { Envios } from "@/components/liquidaciones/envios";

export default function EnviosPage() {
  return (
    <div className="animate-fade-in page-shell py-6 lg:py-8">
      <PageHeader
        title="Envío por correo"
        description="Cada mes, el día programado, se prepara el envío de las liquidaciones del mes anterior: un correo por persona con su PDF protegido con el RUT sin dígito verificador. RR.HH. revisa y aprueba antes de que salga cualquier correo."
      />
      <Envios />
    </div>
  );
}
