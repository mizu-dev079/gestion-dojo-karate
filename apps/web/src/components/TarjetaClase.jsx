import IndicadorCupos from './IndicadorCupos.jsx';
export default function TarjetaClase({ clase, dias, onEditar, ocupado = false }) {
  const tituloId = `clase-${clase.id}`;
  return (
    <article
      aria-labelledby={tituloId}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      {clase.configurado === false && (
        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Completa la sede y el profesor de este turno para habilitar inscripciones.
        </p>
      )}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-xs font-semibold text-gray-500">
            {clase.sede || 'Sede por asignar'}
          </p>
          <h2 id={tituloId} className="mt-1 break-words text-base font-bold text-gray-900">
            {clase.turnoId !== undefined ? (clase.turno ?? clase.nivel) : `Karate · ${clase.nivel}`}
          </h2>
        </div>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => onEditar(clase)}
          className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-dojo-700 hover:bg-dojo-50 disabled:opacity-50"
        >
          Editar turno
        </button>
      </div>

      <div className="mt-3 space-y-1 text-sm text-gray-600">
        <p className="break-words">{dias || 'Días por confirmar'}</p>
        <p className="font-medium text-gray-800">
          {clase.horaInicio} – {clase.horaFin}
        </p>
      </div>
      <div className="mt-3">
        <IndicadorCupos disponibles={clase.cuposDisponibles} total={clase.cupos} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={`/postulaciones?clase=${encodeURIComponent(clase.id)}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dojo-600 px-2 py-2 text-center text-sm font-semibold text-white hover:bg-dojo-700"
        >
          Ver postulaciones
        </a>
        <a
          href={`/compartir-convocatoria?clase=${encodeURIComponent(clase.claseBaseId ?? clase.id)}${clase.turnoId !== undefined ? `&turno=${clase.id}` : ''}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dojo-200 px-2 py-2 text-center text-sm font-semibold text-dojo-700 hover:bg-dojo-50"
        >
          Compartir
        </a>
      </div>

      <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
        Profesor: {clase.profesor || 'Por asignar'}
      </p>
    </article>
  );
}
