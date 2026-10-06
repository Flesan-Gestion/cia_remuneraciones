import { conSigno } from "./formato";

/**
 * Barras divergentes de variación (%) alrededor de cero: verde a la derecha si creció, rojo a
 * la izquierda si cayó. Ordenadas de mayor a menor.
 */
export function BarrasVariacion({ items }: { items: { clave: string; nombre: string; variacion: number }[] }) {
  const orden = [...items].sort((a, b) => b.variacion - a.variacion);
  const max = Math.max(...orden.map((i) => Math.abs(i.variacion)), 1);
  return (
    <ul className="flex flex-col gap-1">
      {orden.map((it) => {
        const ancho = `${(Math.abs(it.variacion) / max) * 100}%`;
        const sube = it.variacion >= 0;
        return (
          <li key={it.clave} className="grid grid-cols-[minmax(6rem,8rem)_1fr_1px_1fr_4.5rem] items-center h-9">
            <span className="text-[0.8125rem] font-semibold text-text truncate pr-2">{it.nombre}</span>
            <span className="flex justify-end">{!sube && <span className="h-4 rounded-l-[5px] bg-serie-3" style={{ width: ancho }} />}</span>
            <span className="h-9 bg-border-strong" aria-hidden />
            <span className="flex">{sube && <span className="h-4 rounded-r-[5px] bg-serie-5" style={{ width: ancho }} />}</span>
            <b className="rep-cifra text-right text-[0.8125rem]" style={{ color: sube ? "var(--color-serie-5)" : "var(--color-serie-3)" }}>
              {conSigno(it.variacion)}
            </b>
          </li>
        );
      })}
    </ul>
  );
}
