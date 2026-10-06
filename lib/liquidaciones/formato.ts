// Formato compartido entre servidor y cliente (sin dependencias de Node).

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** «202609» → «Septiembre 2026». Si no calza con AAAAMM, se devuelve tal cual. */
export function periodoLegible(periodo: string): string {
  if (!/^\d{6}$/.test(periodo)) return periodo;
  const mes = MESES[Number(periodo.slice(4, 6)) - 1];
  return mes ? `${mes} ${periodo.slice(0, 4)}` : periodo;
}

/** Periodo AAAAMM del mes anterior a `fecha` (el que se paga y se envía el mes siguiente). */
export function periodoAnterior(fecha: Date): string {
  const d = new Date(fecha.getFullYear(), fecha.getMonth() - 1, 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Igual que number_format($n, 0, ',', '.') de PHP: redondea y separa miles con punto. */
export function miles(valor: number | string | null | undefined): string {
  const n = Math.round(Number(valor ?? 0)) || 0;
  const signo = n < 0 ? "-" : "";
  return signo + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Minúsculas y sin tildes, para comparar nombres como los escribe la gente. */
export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** «09894551-2» (national_id de SAP) → «9.894.551-2». */
export function formatearRut(nationalId: string | null | undefined): string {
  const [cuerpo, dv] = (nationalId ?? "").split("-");
  const numero = (cuerpo ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return numero ? `${miles(numero)}${dv ? `-${dv}` : ""}` : "—";
}

/** «$ 1.018.049» */
export function pesos(valor: number | null | undefined): string {
  return valor == null ? "—" : `$ ${miles(valor)}`;
}
