import { etiquetaTurno } from '../../lib/clases.js';
import { fechaVisible } from '../../lib/fechas.js';
import { limiteRecuperaciones as base } from '../../lib/seguimiento.js';
import FormularioAccion, { titulos } from '../FormularioAccion.jsx';

const boton =
  'min-h-11 rounded-xl bg-dojo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-dojo-700 disabled:opacity-50';
const secundario =
  'min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';

export default function FichaAlumnoAdministracion({
  alumno,
  planes,
  seleccion,
  setSeleccion,
  ocupado,
  guardar,
  onVolver,
  tituloRef,
}) {
  const s = alumno.seguimiento,
    pausa = s.congelamientos.at(-1),
    abrir = (accion, datos = {}) => setSeleccion({ alumnoId: alumno.id, accion, ...datos });
  return (
    <article key={alumno.id} className="ficha-alumno">
      <button type="button" className="ficha-volver" onClick={() => onVolver()}>
        <span aria-hidden="true">←</span> Alumnos
      </button>
      <header className="ficha-cabecera">
        <span className="persona-avatar" aria-hidden="true">
          {alumno.nombre
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0])
            .join('')}
        </span>
        <div>
          <p>{alumno.clase?.nivel ?? 'Sin clase disponible'}</p>
          <h2 ref={tituloRef} tabIndex={-1}>
            {alumno.nombre}
          </h2>
        </div>
      </header>
      <div className="admin-alumno__datos">
        <div className="ficha-plan">
          <div>
            <span className="ficha-plan__numero">{s.plan ? s.pendientes : '—'}</span>
            <span>clases disponibles</span>
          </div>
          <p>{s.plan ? `Plan de ${s.plan.cantidad} clases` : 'Pendiente de activar plan'}</p>
        </div>
        <p
          className="mt-2 font-semibold text-dojo-800"
          data-estado={s.congelado ? 'congelado' : s.plan ? 'activo' : 'sin-plan'}
        >
          {!s.plan ? 'Sin plan' : s.congelado ? 'Congelado · cupo reservado' : 'Activo'}
        </p>

        {s.plan && <p className="mt-1 text-sm text-gray-600">{s.plan.dias.join(', ')}</p>}
        {alumno.clase && (
          <details className="ficha-detalles">
            <summary>Clase y contacto</summary>
            <dl>
              {[
                ['Turno', etiquetaTurno(alumno.clase)],
                ['Horario', `${alumno.clase.horaInicio} – ${alumno.clase.horaFin}`],
                ['Profesor', alumno.clase.profesor],
                ['Sede', alumno.clase.sede],
                ['Teléfono', alumno.telefono],
                ['Correo', alumno.correo],
              ]
                .filter(([, valor]) => valor)
                .map(([etiqueta, valor]) => (
                  <div key={etiqueta}>
                    <dt>{etiqueta}</dt>
                    <dd>{valor}</dd>
                  </div>
                ))}
            </dl>
          </details>
        )}
        {s.proximoPlan &&
          (s.proximoPlan.cantidad !== s.plan?.cantidad ||
            s.proximoPlan.dias.join(',') !== s.plan?.dias.join(',')) && (
            <p className="mt-2 rounded-xl bg-dojo-50 p-3 text-sm text-dojo-800">
              Cambio programado: {s.proximoPlan.cantidad} clases por paquete. Se aplicará cuando se
              terminen las clases pendientes del plan actual.
            </p>
          )}
        {s.congelado && (
          <p className="mt-2 text-sm text-gray-600">
            {pausa.hasta
              ? `Regresa el ${fechaVisible(pausa.hasta)}`
              : 'Sin fecha de regreso. Requiere reactivación manual.'}{' '}
            · {pausa.motivo}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {!s.plan && alumno.clase && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => abrir('activarPlan')}
              className={boton}
            >
              Activar plan
            </button>
          )}
          {s.plan && alumno.clase && !s.congelado && (
            <>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => abrir('renovarPlan')}
                className={secundario}
              >
                Renovar
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => abrir('configurarPlan')}
                className={secundario}
              >
                Cambiar plan
              </button>
            </>
          )}
          {s.plan && s.congelado && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => guardar(alumno.id, { accion: 'reactivar', version: s.version })}
              className={boton}
            >
              Reactivar
            </button>
          )}
        </div>
        {s.plan && alumno.clase && (
          <details className="mt-3">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold text-dojo-700">
              Gestionar plan
            </summary>
            <div className="flex flex-wrap gap-2">
              {!s.congelado && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => abrir('congelar')}
                  className={secundario}
                >
                  Congelar plan
                </button>
              )}
              <button
                type="button"
                disabled={ocupado}
                onClick={() => abrir('recuperar')}
                className={secundario}
              >
                Brindar recuperación
              </button>
            </div>
          </details>
        )}
        {s.solicitudes.some((r) => r.estado !== 'pendiente') && (
          <details className="ficha-detalles">
            <summary>Solicitudes anteriores</summary>
            {s.solicitudes
              .filter((r) => r.estado !== 'pendiente')
              .map((r) => (
                <div key={r.id} className="ficha-solicitud">
                  <strong>{r.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}</strong>
                  <p>{r.motivo}</p>
                  {r.hasta && <p>Regreso: {fechaVisible(r.hasta)}</p>}
                  {r.respuesta && <p>{r.respuesta}</p>}
                </div>
              ))}
          </details>
        )}
        {s.solicitudes
          .filter((r) => r.estado === 'pendiente')
          .map((r) => (
            <section key={r.id} className="mt-4 rounded-xl border border-gray-200 p-3">
              <h3 className="font-semibold">Solicitud de congelamiento · {r.estado}</h3>
              <p className="text-sm">
                {r.motivo} ·{' '}
                {r.hasta ? `Regreso: ${fechaVisible(r.hasta)}` : 'Sin fecha de regreso'}
              </p>
              {r.respuesta && <p className="text-sm">Respuesta: {r.respuesta}</p>}
              {r.estado === 'pendiente' && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => abrir('resolverSolicitud', { id: r.id })}
                  className={secundario}
                >
                  Revisar solicitud
                </button>
              )}
            </section>
          ))}
        {seleccion?.alumnoId === alumno.id && (
          <FormularioAccion
            key={`${alumno.id}-${seleccion.accion}-${seleccion.id ?? ''}`}
            alumno={alumno}
            planes={planes}
            seleccion={seleccion}
            ocupado={ocupado}
            guardar={guardar}
            cerrar={() => setSeleccion(null)}
          />
        )}
        {s.plan && (
          <details className="mt-4">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">
              Planes, recuperaciones e historial
            </summary>
            <h3 className="font-semibold">Activaciones y renovaciones</h3>
            <ul className="space-y-2 text-sm">
              {s.pagos.map((p) => (
                <li key={p.id} className="rounded-lg bg-gray-50 p-3">
                  {fechaVisible(p.fecha)} · {p.restantes} de {p.cantidad} clases pendientes ·
                  Recuperaciones:{' '}
                  {s.recuperaciones.filter((r) => r.pagoId === p.id && !r.revocada).length} de{' '}
                  {base(p)} autorizadas
                </li>
              ))}
            </ul>
            <h3 className="mt-4 font-semibold">Recuperaciones</h3>
            {!s.recuperaciones.length && (
              <p className="text-sm text-gray-600">Sin autorizaciones.</p>
            )}
            <ul className="space-y-3 text-sm">
              {s.recuperaciones.map((r) => (
                <li key={r.id}>
                  {fechaVisible(r.fecha)} ·{' '}
                  {r.revocada ? 'Revocada' : 'Autorizada: completar en el horario habitual'} ·{' '}
                  {r.motivo} · {r.autorizadaPor}
                  {!r.revocada && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => abrir('revocarRecuperacion', { id: r.id })}
                      className="ml-2 min-h-11 font-semibold text-dojo-700"
                    >
                      Revocar
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="mt-4 font-semibold">Asistencia</h3>
            {!s.asistencias.length && <p className="text-sm text-gray-600">Sin registros.</p>}
            <ul className="space-y-2 text-sm">
              {s.asistencias.map((a) => (
                <li key={a.fecha}>
                  {fechaVisible(a.fecha)} ·{' '}
                  {a.estado === 'presente'
                    ? 'Presente'
                    : a.estado === 'avisada'
                      ? 'Ausencia avisada'
                      : 'Falta'}
                  {a.estado !== 'presente' && a.politica === 'pendiente'
                    ? ' · Registro anterior pendiente de revisión'
                    : ''}
                </li>
              ))}
            </ul>
            <h3 className="mt-4 font-semibold">Congelamientos</h3>
            {!s.congelamientos.length && (
              <p className="text-sm text-gray-600">Sin congelamientos.</p>
            )}
            <ul className="space-y-2 text-sm">
              {s.congelamientos.map((c) => (
                <li key={c.id}>
                  {fechaVisible(c.desde)} · {c.motivo} ·{' '}
                  {c.reactivado
                    ? `Reactivado el ${fechaVisible(c.reactivado)}`
                    : c.hasta
                      ? `Regreso: ${fechaVisible(c.hasta)}`
                      : 'Sin fecha'}
                </li>
              ))}
            </ul>

            <h3 className="mt-4 font-semibold">Actividad</h3>
            <ul className="space-y-2 text-sm">
              {s.auditoria.map((a) => (
                <li key={a.id}>
                  {fechaVisible(a.fecha)} · {a.usuario} · {titulos[a.accion] ?? a.accion}
                  {a.motivo && ` · ${a.motivo}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}
