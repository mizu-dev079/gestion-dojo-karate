import { useState } from 'react';
import { fechaVisible } from '../../../lib/fechas.js';
import { limiteRecuperaciones as base } from '../../../lib/seguimiento.js';
import FormularioAccion from '../../FormularioAccion.jsx';

export default function FichaAlumnoProfesor({ alumno, seleccion, setSeleccion, ocupado, guardar }) {
  const [expandido, setExpandido] = useState(false);
  const s = alumno.seguimiento;
  const pausa = s.congelamientos.at(-1);
  const abrir = (accion, datos = {}) => setSeleccion({ alumnoId: alumno.id, accion, ...datos });

  const iniciales = alumno.nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('');

  const solicitudesPendientes = s.solicitudes.filter((r) => r.estado === 'pendiente');
  const tieneAccionActiva = seleccion?.alumnoId === alumno.id;

  // Estado sintético para la sublínea discreta
  const estadoTexto = s.congelado
    ? 'Congelado'
    : !s.plan
      ? 'Sin plan'
      : solicitudesPendientes.length > 0
        ? 'Solicitud pendiente'
        : 'Activo';

  const estadoClase = s.congelado
    ? 'text-gray-500 font-medium'
    : !s.plan
      ? 'text-red-700 font-medium'
      : solicitudesPendientes.length > 0
        ? 'text-amber-700 font-bold'
        : 'text-gray-500 font-medium';

  return (
    <article className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden">
      {/* Fila principal compacta (siempre visible y accesible para pulsar) */}
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        aria-expanded={expandido || tieneAccionActiva}
        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-gray-50/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dojo-600"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar iniciales */}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-dojo-700 border border-red-100"
            aria-hidden="true"
          >
            {iniciales}
          </span>

          {/* Nombre y estado breve */}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-gray-900 leading-snug break-words">
              {alumno.nombre}
            </h4>
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 ${estadoClase}`}>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    s.congelado
                      ? 'bg-gray-400'
                      : !s.plan
                        ? 'bg-red-500'
                        : solicitudesPendientes.length > 0
                          ? 'bg-amber-500'
                          : 'bg-green-600'
                  }`}
                  aria-hidden="true"
                />
                {estadoTexto}
              </span>
            </div>
          </div>
        </div>

        {/* Lado derecho: Clases pendientes y chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {s.plan && (
            <div className="flex items-baseline gap-1 text-xs">
              <strong className="text-sm font-extrabold text-dojo-700">{s.pendientes}</strong>
              <span className="text-gray-500 font-medium">cls</span>
            </div>
          )}
          <svg
            aria-hidden="true"
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              expandido || tieneAccionActiva ? 'rotate-180 text-gray-600' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Contenido secundario (desplegable) */}
      {(expandido || tieneAccionActiva) && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-3.5 sm:p-4 space-y-3 text-xs">
          {/* Datos del plan */}
          {s.plan ? (
            <p className="text-gray-600">
              <strong className="text-gray-800">Plan:</strong> {s.plan.dias.join(', ')} ·{' '}
              {s.plan.cantidad} clases por paquete
            </p>
          ) : (
            <p className="text-red-700">El alumno no tiene un plan activo asignado.</p>
          )}

          {/* Información si el plan está congelado */}
          {s.congelado && pausa && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-900 space-y-1.5">
              <p>
                <strong>Plan en pausa:</strong>{' '}
                {pausa.hasta
                  ? `Regresa el ${fechaVisible(pausa.hasta)}`
                  : 'Sin fecha de regreso establecida.'}{' '}
                · Motivo: {pausa.motivo}
              </p>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => guardar(alumno.id, { accion: 'reactivar', version: s.version })}
                className="rounded-lg bg-dojo-600 px-3 py-1 font-semibold text-white hover:bg-dojo-700 disabled:opacity-50"
              >
                Reactivar plan
              </button>
            </div>
          )}

          {/* Solicitudes de congelamiento del alumno */}
          {s.solicitudes.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-2.5 space-y-1.5 ${
                r.estado === 'pendiente'
                  ? 'border-amber-300 bg-amber-50/80 text-amber-900'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <strong>Solicitud de congelamiento ({r.estado})</strong>
                <span className="text-gray-500">{fechaVisible(r.fecha)}</span>
              </div>
              <p>
                Motivo: {r.motivo}
                {r.hasta ? ` · Regreso estimado: ${fechaVisible(r.hasta)}` : ''}
              </p>
              {r.respuesta && <p className="text-gray-600">Respuesta: {r.respuesta}</p>}

              {r.estado === 'pendiente' && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => abrir('resolverSolicitud', { id: r.id })}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1 font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Revisar solicitud
                </button>
              )}
            </div>
          ))}

          {/* Formulario de acción contextual */}
          {tieneAccionActiva && (
            <FormularioAccion
              alumno={alumno}
              seleccion={seleccion}
              ocupado={ocupado}
              guardar={guardar}
              cerrar={() => setSeleccion(null)}
            />
          )}

          {/* Las acciones se concentran en el formulario mientras está abierto. */}
          {s.plan && !tieneAccionActiva && (
            <div className="pt-1 flex flex-wrap gap-2">
              {!s.congelado && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => abrir('congelar')}
                  className="min-h-8 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Congelar
                </button>
              )}
              <button
                type="button"
                disabled={ocupado}
                onClick={() => abrir('recuperar')}
                className="min-h-8 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Brindar recuperación
              </button>
            </div>
          )}

          {/* Historial colapsable */}
          {s.plan && (
            <details className="pt-2 border-t border-gray-200/80">
              <summary className="cursor-pointer font-semibold text-gray-600 hover:text-gray-900">
                Historial del alumno
              </summary>
              <div className="mt-2 space-y-2.5 pt-1 text-gray-600">
                <div>
                  <strong className="block text-gray-800">Paquetes de clases</strong>
                  {!s.pagos.length ? (
                    <p className="text-gray-400">Sin paquetes registrados.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {s.pagos.map((p) => (
                        <li key={p.id} className="rounded bg-white p-1.5 border border-gray-100">
                          {fechaVisible(p.fecha)} · {p.restantes} de {p.cantidad} clases pendientes
                          · Recuperaciones:{' '}
                          {s.recuperaciones.filter((r) => r.pagoId === p.id && !r.revocada).length}{' '}
                          de {base(p)} autorizadas
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <strong className="block text-gray-800">Recuperaciones</strong>
                  {!s.recuperaciones.length ? (
                    <p className="text-gray-400">Sin autorizaciones registradas.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {s.recuperaciones.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 bg-white p-1.5 rounded border border-gray-100"
                        >
                          <span>
                            {fechaVisible(r.fecha)} · {r.revocada ? 'Revocada' : 'Autorizada'} ·{' '}
                            {r.motivo}
                          </span>
                          {!r.revocada && (
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => abrir('revocarRecuperacion', { id: r.id })}
                              className="font-semibold text-dojo-700 hover:underline"
                            >
                              Revocar
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <strong className="block text-gray-800">Asistencias recientes</strong>
                  {!s.asistencias.length ? (
                    <p className="text-gray-400">Sin asistencias registradas.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                      {s.asistencias.slice(-10).map((a) => (
                        <li key={a.fecha} className="bg-white p-1 rounded border border-gray-100">
                          {fechaVisible(a.fecha)} ·{' '}
                          {a.estado === 'presente'
                            ? 'Presente'
                            : a.estado === 'avisada'
                              ? 'Ausencia avisada'
                              : 'Falta'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
