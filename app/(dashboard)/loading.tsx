// Pantalla de carga al navegar entre vistas: aparece al instante mientras llega la nueva página
// (en desarrollo, la primera visita a una sección puede tardar varios segundos en compilar).
export default function Cargando() {
  return (
    <div className="page-shell py-6 lg:py-8 flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
      <div className="skeleton h-8 w-72" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
      </div>
      <div className="skeleton h-72" />
    </div>
  );
}
