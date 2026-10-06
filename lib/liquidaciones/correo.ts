import { periodoLegible } from "@/lib/liquidaciones/formato";

// Textos de los correos de la plataforma. HTML simple con estilos en línea (los clientes de correo
// ignoran las hojas de estilo).

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function marco(contenido: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#231F20;max-width:560px">
  <div style="height:4px;background:#E30613;margin-bottom:20px"></div>
  ${contenido}
  <p style="margin-top:28px;color:#58595B;font-size:12px">Grupo Flesan · Confianza que construye</p>
</div>`;
}

/** «HECTOR BERNARDO ABACA» → «Hector». */
export function nombrePila(nombreCompleto: string | null | undefined) {
  const primero = (nombreCompleto ?? "").trim().split(/\s+/)[0] ?? "";
  return primero ? primero[0].toUpperCase() + primero.slice(1).toLowerCase() : "";
}

export function correoLiquidacion({ nombre, periodo, prueba }: { nombre: string; periodo: string; prueba?: { para: string } }) {
  const mes = periodoLegible(periodo);
  const saludo = nombre ? `Hola ${escapar(nombre)}:` : "Hola:";
  const avisoPrueba = prueba
    ? `<p style="padding:10px 12px;background:#FAFAFA;border:1px dashed #D9D9D9;font-size:12px;color:#58595B">
         Correo de prueba enviado a ${escapar(prueba.para)}. La persona del lote no lo recibió.
       </p>`
    : "";
  return {
    subject: `${prueba ? "[Prueba] " : ""}Liquidación de remuneraciones ${mes}`,
    html: marco(`${avisoPrueba}
  <p>${saludo}</p>
  <p>Adjuntamos tu liquidación de remuneraciones de <b>${mes.toLowerCase()}</b>.</p>
  <p>El archivo está protegido. Para abrirlo, usa tu <b>RUT sin puntos, sin guion y sin dígito verificador</b>.
     Por ejemplo, si tu RUT es 12.345.678-9, la clave es <b>12345678</b>.</p>
  <p>Si tienes dudas sobre tu liquidación, escríbele a tu equipo de Personas.</p>
  <p style="color:#58595B;font-size:12px">Este correo se envía automáticamente; no lo respondas.</p>`),
    archivo: `Liquidacion_${mes.replace(" ", "_")}.pdf`,
  };
}

export function correoLoteListo({ periodo, total, sinCorreo, enlace }: { periodo: string; total: number; sinCorreo: number; enlace: string }) {
  const mes = periodoLegible(periodo);
  return {
    subject: `Liquidaciones de ${mes} listas para revisar`,
    html: marco(`
  <p>Se preparó el envío por correo de las liquidaciones de <b>${mes.toLowerCase()}</b>: ${total} personas${
    sinCorreo ? `, de las cuales ${sinCorreo} no tienen correo en SAP y no lo recibirán` : ""
  }.</p>
  <p>No sale ningún correo hasta que alguien de RR.HH. lo revise y lo apruebe.</p>
  <p><a href="${escapar(enlace)}" style="display:inline-block;padding:10px 18px;background:#E30613;color:#FFFFFF;text-decoration:none;font-weight:bold">Revisar el envío</a></p>`),
  };
}
