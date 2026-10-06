// Se ejecuta una vez al arrancar el servidor de Next. Aquí parte el programador del envío mensual
// de liquidaciones por correo (solo con ENVIO_HABILITADO=true, ver lib/liquidaciones/programador.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarProgramador } = await import("./lib/liquidaciones/programador");
    iniciarProgramador();
  }
}
