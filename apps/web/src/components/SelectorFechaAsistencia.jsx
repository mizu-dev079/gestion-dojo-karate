const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
export default function SelectorFechaAsistencia({ fecha, cambiar, disabled = false }) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const cantidad = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const inicio = (primero.getUTCDay() + 6) % 7;
  const titulo = new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(primero);
  const nombreDia = (valor) =>
    new Intl.DateTimeFormat('es-PE', { dateStyle: 'full', timeZone: 'UTC' }).format(
      new Date(`${valor}T00:00:00Z`),
    );
  const mover = (delta) => {
    const destino = new Date(Date.UTC(anio, mes - 1 + delta, 1));
    const ultimo = new Date(
      Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0),
    ).getUTCDate();
    destino.setUTCDate(Math.min(dia, ultimo));
    cambiar(destino.toISOString().slice(0, 10));
  };
  return (
    <fieldset disabled={disabled} className="space-y-3" aria-label="Calendario de asistencia">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mes anterior"
          className="min-h-[44px] min-w-[44px] rounded-xl border border-gray-200 bg-white text-xl disabled:opacity-50"
          onClick={() => mover(-1)}
        >
          ‹
        </button>
        <span className="text-center font-bold capitalize" aria-live="polite">
          {titulo}
        </span>
        <button
          type="button"
          aria-label="Mes siguiente"
          className="min-h-[44px] min-w-[44px] rounded-xl border border-gray-200 bg-white text-xl disabled:opacity-50"
          onClick={() => mover(1)}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <span key={d} className="py-1 text-xs font-semibold text-gray-500">
            {d}
          </span>
        ))}
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].slice(0, inicio).map((d) => (
          <span key={`vacio-${d}`} aria-hidden="true" />
        ))}
        {Array.from({ length: cantidad }, (_, i) => {
          const valor = `${anio}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          return (
            <button
              key={valor}
              type="button"
              aria-label={nombreDia(valor)}
              aria-pressed={fecha === valor}
              aria-current={valor === hoy() ? 'date' : undefined}
              onClick={() => cambiar(valor)}
              className={`min-h-[44px] rounded-lg text-sm font-semibold disabled:opacity-50 ${fecha === valor ? 'bg-dojo-600 text-white' : valor === hoy() ? 'bg-dojo-50 text-dojo-700 ring-1 ring-inset ring-dojo-200' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{nombreDia(fecha)}</p>
        <button
          type="button"
          className="min-h-[44px] rounded-xl px-3 font-semibold text-dojo-700"
          onClick={() => cambiar(hoy())}
        >
          Hoy
        </button>
      </div>
    </fieldset>
  );
}
