/**
 * Componente compacto de búsqueda de alumnos para el módulo del profesor.
 * Diseño minimalista con campo accesible, botón de borrado rápido e indicador de resultados.
 */
export default function BusquedaAlumnos({
  busqueda,
  setBusqueda,
  placeholder = 'Buscar alumno por nombre…',
  totalResultados = null,
}) {
  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"
          aria-hidden="true"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-9 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-dojo-600 focus:outline-none focus:ring-1 focus:ring-dojo-600"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda('')}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Borrar búsqueda"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {totalResultados !== null && (
        <span className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600">
          {totalResultados} {totalResultados === 1 ? 'alumno' : 'alumnos'}
        </span>
      )}
    </div>
  );
}
