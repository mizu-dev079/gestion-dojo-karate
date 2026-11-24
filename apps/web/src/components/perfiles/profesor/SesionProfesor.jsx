import { etiquetaTurno } from '../../../lib/clases.js';
import { etiquetasAsistencia } from '../../../lib/seguimiento.js';
import ImagenClase from '../../ImagenClase.jsx';
import IconoPerfil from '../IconoPerfil.jsx';

export default function SesionProfesor({
  sesionTurno,
  ocupado,
  gestionProfesor,
  setGestionProfesor,
  confirmarProfesor,
  marcarAlumno,
}) {
  const cancelada = sesionTurno.estado === 'cancelada';
  const presente = sesionTurno.asistenciaProfesor === 'presente';
  const editando = gestionProfesor === sesionTurno.claseId;
  return (
    <article
      className="sesion-profesor"
      aria-label={`${sesionTurno.nivel} · ${etiquetaTurno(sesionTurno)}`}
    >
      <header className="sesion-profesor__cabecera">
        <div>
          <span className="portal-eyebrow">{etiquetaTurno(sesionTurno)}</span>
          <h3 className="sesion-profesor__nombre">{sesionTurno.nivel}</h3>
          <p className="sesion-profesor__meta">
            {sesionTurno.horaInicio}–{sesionTurno.horaFin} · {sesionTurno.sede}
          </p>
        </div>
        <ImagenClase nombre={sesionTurno.nivel} compacta />
      </header>
      <div className="sesion-profesor__presencia">
        <span
          className={`presencia-icono ${presente && !cancelada ? 'presencia-icono--lista' : ''}`}
        >
          <IconoPerfil nombre={presente && !cancelada ? 'presente' : 'cuenta'} />
        </span>
        <div className="presencia-datos">
          <p className="font-semibold">
            {cancelada
              ? 'Cancelada por el dojo'
              : presente
                ? 'Asistencia confirmada'
                : 'Tu asistencia'}
          </p>
          <p className="text-sm text-gray-500">{sesionTurno.profesor || 'Profesor responsable'}</p>
        </div>
        {!cancelada && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setGestionProfesor(editando ? null : sesionTurno.claseId)}
            className={`presencia-accion ${presente ? 'sesion-editar' : 'sesion-confirmar'}`}
          >
            {presente ? 'Editar' : 'Marcar mi asistencia'}
          </button>
        )}
      </div>
      {editando && !cancelada && (
        <form
          className="sesion-profesor__formulario"
          onSubmit={(event) => {
            event.preventDefault();
            const motivo =
              new FormData(event.currentTarget).get('motivo') || 'Asistencia propia del profesor';
            confirmarProfesor(sesionTurno, String(motivo));
          }}
        >
          <fieldset disabled={ocupado} className="space-y-3">
            <label className="block text-sm font-semibold">
              Asistencia del profesor
              <select
                name="asistencia"
                defaultValue="presente"
                className="mt-1 min-h-12 rounded-xl border border-gray-300 bg-white px-3"
              >
                <option value="presente">Presente — sesión realizada</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Observación de asistencia
              <textarea
                name="motivo"
                maxLength={300}
                required
                defaultValue="Asistencia propia del profesor"
                className="mt-1 min-h-24 rounded-xl border border-gray-300 bg-white px-3 py-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="sesion-confirmar">
                Confirmar
              </button>
              <button
                type="button"
                className="sesion-editar"
                onClick={() => setGestionProfesor(null)}
              >
                Cerrar
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="sesion-profesor__alumnos">
        <div className="sesion-profesor__titulo">
          <h4>Alumnos</h4>
          <span className="sesion-contador">
            {sesionTurno.alumnos.filter((alumno) => alumno.programado).length} programados
          </span>
        </div>
        {!sesionTurno.alumnos.length && (
          <p className="text-sm text-gray-500">No hay alumnos inscritos en este turno.</p>
        )}
        <ul>
          {sesionTurno.alumnos.map((alumno) => (
            <li key={alumno.id} className="asistente-fila" data-estado={alumno.estado}>
              <div className="asistente-fila__identidad">
                <span className="perfil-avatar" aria-hidden="true">
                  {alumno.nombre
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')}
                </span>
                <div className="asistente-datos">
                  <p className="font-semibold">{alumno.nombre}</p>
                  <p className="asistente-fila__estado">
                    {etiquetasAsistencia[alumno.estado] ?? alumno.estado} · {alumno.pendientes}{' '}
                    clases pendientes
                  </p>
                </div>
              </div>
              {!cancelada && alumno.programado && (
                <fieldset
                  className="asistente-acciones"
                  aria-label={`Asistencia de ${alumno.nombre}`}
                >
                  {[
                    ['presente', 'Presente'],
                    ['falta', 'Faltó'],
                    ['avisada', 'Avisó ausencia'],
                  ].map(([estado, texto]) => (
                    <button
                      key={estado}
                      type="button"
                      className="asistente-boton"
                      aria-pressed={alumno.estado === estado}
                      disabled={ocupado || (estado === 'avisada' && alumno.estado === 'avisada')}
                      onClick={() => marcarAlumno(alumno, estado)}
                    >
                      {texto}
                    </button>
                  ))}
                </fieldset>
              )}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
