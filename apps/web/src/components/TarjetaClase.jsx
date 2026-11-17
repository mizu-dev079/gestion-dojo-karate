import { useEffect, useRef } from 'react';
import IndicadorCupos from './IndicadorCupos.jsx';
export default function TarjetaClase({
  clase,
  estado,
  dias,
  onEditar,
  onEliminar,
  ocupado = false,
}) {
  const menu = useRef(null);
  useEffect(() => {
    const cerrarAlTocarFuera = (event) => {
      if (menu.current && !menu.current.contains(event.target)) menu.current.open = false;
    };
    document.addEventListener('pointerdown', cerrarAlTocarFuera);
    return () => document.removeEventListener('pointerdown', cerrarAlTocarFuera);
  }, []);
  const tituloId = `clase-${clase.id}`;
  const cerrarOpciones = (event) => {
    event.currentTarget.closest('details').open = false;
  };

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
            {clase.sede ? `Sede ${clase.sede}` : 'Sede por asignar'}
          </p>
          <h2 id={tituloId} className="mt-1 break-words text-base font-bold text-gray-900">
            {clase.turnoId !== undefined ? (clase.turno ?? clase.nivel) : `Karate · ${clase.nivel}`}
          </h2>
        </div>
        <span
          className={`mt-1 shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${estado.estilo}`}
        >
          {estado.texto}
        </span>
        <details
          ref={menu}
          className="class-card__menu"
          name="opciones-clase"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.open = false;
              event.currentTarget.querySelector('summary').focus();
            }
            if (event.key === 'Tab') {
              // En táctil, blur puede llegar con relatedTarget=null antes del click.
              // Solo cerrar por foco al navegar con el teclado, después de moverlo.
              requestAnimationFrame(() => {
                if (menu.current && !menu.current.contains(document.activeElement))
                  menu.current.open = false;
              });
            }
          }}
        >
          <summary
            className="class-card__menu-toggle"
            aria-label={`Más opciones de Karate ${clase.nivel}, sede ${clase.sede}`}
            title="Más opciones"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </summary>
          <div className="class-card__menu-panel">
            <button
              type="button"
              disabled={ocupado}
              onClick={(event) => {
                cerrarOpciones(event);
                onEditar(clase);
              }}
              className="w-full rounded-lg px-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {clase.turnoId !== undefined ? 'Editar turno' : 'Editar clase'}
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={(event) => {
                cerrarOpciones(event);
                event.currentTarget.closest('details').querySelector('summary').focus();
                onEliminar(clase.id);
              }}
              className="w-full rounded-lg px-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Eliminar clase
            </button>
          </div>
        </details>
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

      <details className="class-card__details mt-3 border-t border-gray-100 pt-1">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-medium text-gray-600">
          Ver detalles
          <svg
            className="class-card__chevron"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <dl className="grid grid-cols-2 gap-3 pb-2 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Profesor</dt>
            <dd className="mt-1 break-words font-medium text-gray-800">{clase.profesor}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Tarifa mensual</dt>
            <dd className="mt-1 font-medium text-gray-800">
              {clase.estado !== undefined ? 'Según plan contratado' : `S/ ${clase.tarifa}`}
            </dd>
          </div>
          {clase.duracion && (
            <div className="col-span-2">
              <dt className="text-xs text-gray-500">Duración</dt>
              <dd className="mt-1 font-medium text-gray-800">{clase.duracion}</dd>
            </div>
          )}
        </dl>
      </details>
    </article>
  );
}
