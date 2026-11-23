import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, leerRespuesta } from '../../../lib/api.js';
import SelectorDiasAsistencia from '../../SelectorDiasAsistencia.jsx';
import { hoyLima } from '../alumno/utilidades.js';
import IconoPerfil from '../IconoPerfil.jsx';
import BusquedaAlumnos from './BusquedaAlumnos.jsx';
import FichaAlumnoProfesor from './FichaAlumnoProfesor.jsx';

const etiquetas = {
  pendiente: 'Pendiente',
  presente: 'Presente',
  falta: 'Faltó',
  avisada: 'Avisó ausencia',
  congelado: 'Plan congelado',
  'sin sesión': 'Sin sesión contratada',
  cancelada: 'Cancelada por el dojo',
};

export default function DetalleClase({
  clase,
  alumnosClase,
  onVolver,
  ocupado,
  guardarAlumno,
  recargarAlumnos,
  ejecutar,
  pestañaInicial = 'alumnos',
}) {
  const [pestaña, setPestaña] = useState(pestañaInicial);
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState(null);

  // Estados para la pestaña de asistencia de esta clase
  const [fecha, setFecha] = useState(hoyLima);
  const limite = hoyLima();
  const [sesionClase, setSesionClase] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(false);
  const [gestionProfesor, setGestionProfesor] = useState(false);
  const cargaActual = useRef(0);

  // Cargar sesión del día para esta clase
  const cargarSesion = useCallback(async () => {
    const carga = ++cargaActual.current;
    setCargandoSesion(true);
    try {
      const respuesta = await apiFetch(`/sesiones?fecha=${fecha}`, { cache: 'no-store' });
      const datos = await leerRespuesta(respuesta, 'No se pudo cargar la asistencia de la sesión.');
      if (carga !== cargaActual.current) return;
      const sesionEncontrada = (datos.sesiones ?? []).find(
        (s) =>
          Number(s.claseId) === Number(clase.id) ||
          (clase.claseBaseId && Number(s.claseId) === Number(clase.claseBaseId)),
      );
      setSesionClase(sesionEncontrada ?? null);
    } catch {
      if (carga === cargaActual.current) {
        setSesionClase(null);
      }
    } finally {
      if (carga === cargaActual.current) setCargandoSesion(false);
    }
  }, [fecha, clase.id, clase.claseBaseId]);

  useEffect(() => {
    if (pestaña === 'asistencia') {
      cargarSesion();
    }
  }, [pestaña, cargarSesion]);

  // Filtrado de alumnos por búsqueda
  const alumnosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    if (!termino) return alumnosClase;
    return alumnosClase.filter((a) => a.nombre.toLocaleLowerCase('es').includes(termino));
  }, [alumnosClase, busqueda]);

  // Acciones de asistencia
  async function marcarAsistenciaProfesor(motivo) {
    if (!sesionClase) return;
    await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/sesiones/${sesionClase.claseId}/${sesionClase.fecha}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'profesor',
            version: sesionClase.version,
            asistencia: 'presente',
            motivo,
          }),
        }),
        'No se pudo confirmar la asistencia del profesor.',
      );
      setGestionProfesor(false);
      await cargarSesion();
      return 'Asistencia confirmada.';
    });
  }

  async function marcarAsistenciaAlumno(alumnoSesion, estado) {
    await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/alumnos/${alumnoSesion.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'asistencia',
            version: alumnoSesion.version,
            fecha,
            estado,
          }),
        }),
        'No se pudo registrar la asistencia del alumno.',
      );
      await Promise.all([cargarSesion(), recargarAlumnos()]);
      return estado === 'avisada' ? 'Aviso de ausencia registrado.' : 'Asistencia registrada.';
    });
  }

  const nombreClase = clase.turno || clase.claseNombre || clase.nivel;
  const diasTexto = Array.isArray(clase.frecuencia)
    ? clase.frecuencia.join(', ')
    : clase.frecuencia;

  return (
    <div className="space-y-3.5">
      {/* Botón de regreso minimalista */}
      <div>
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:text-dojo-700 transition-colors focus:outline-none"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver a Mis clases
        </button>
      </div>

      {/* Tarjeta oscura de la clase (identidad visual .perfil-hero) */}
      <header className="perfil-hero">
        <p className="perfil-eyebrow">{clase.sede || 'SEDE POR ASIGNAR'}</p>
        <h2 className="perfil-saludo break-words">{nombreClase}</h2>
        <p className="mt-1 text-xs text-[#dedad7] font-medium">
          {diasTexto || 'Días por confirmar'} · {clase.horaInicio} – {clase.horaFin}
        </p>

        <div className="perfil-resumen">
          <div>
            <strong>{alumnosClase.length}</strong>
            <span>{alumnosClase.length === 1 ? 'Alumno inscrito' : 'Alumnos inscritos'}</span>
          </div>
          {clase.cupos !== undefined && clase.cupos !== null && (
            <div>
              <strong>{clase.cupos}</strong>
              <span>Cupos del grupo</span>
            </div>
          )}
        </div>
      </header>

      {/* Pestañas de navegación independientes fuera de la tarjeta oscura */}
      <nav
        className="flex border-b border-gray-200 bg-white rounded-xl px-2 shadow-sm"
        aria-label="Secciones de la clase"
      >
        <button
          type="button"
          onClick={() => setPestaña('alumnos')}
          className={`min-h-11 flex-1 sm:flex-none sm:px-6 border-b-2 text-xs font-bold transition-colors ${
            pestaña === 'alumnos'
              ? 'border-dojo-600 text-dojo-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Alumnos ({alumnosClase.length})
        </button>
        <button
          type="button"
          onClick={() => setPestaña('asistencia')}
          className={`min-h-11 flex-1 sm:flex-none sm:px-6 border-b-2 text-xs font-bold transition-colors ${
            pestaña === 'asistencia'
              ? 'border-dojo-600 text-dojo-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Registrar asistencia
        </button>
      </nav>

      {/* Pestaña: Alumnos */}
      {pestaña === 'alumnos' && (
        <section className="space-y-3">
          {/* Campo de búsqueda directo sobre el listado (sin tarjeta envolvente) */}
          <BusquedaAlumnos
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            placeholder="Buscar en esta clase…"
            totalResultados={alumnosFiltrados.length}
          />

          {/* Listado de alumnos */}
          {alumnosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-xs text-gray-500">
              {busqueda ? (
                <>
                  <p className="font-semibold text-gray-700">No se encontraron alumnos</p>
                  <p className="mt-1">Ningún alumno coincide con «{busqueda}».</p>
                  <button
                    type="button"
                    onClick={() => setBusqueda('')}
                    className="mt-2 text-xs font-semibold text-dojo-600 hover:underline"
                  >
                    Borrar búsqueda
                  </button>
                </>
              ) : (
                <p>No hay alumnos inscritos en esta clase.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {alumnosFiltrados.map((alumno) => (
                <FichaAlumnoProfesor
                  key={alumno.id}
                  alumno={alumno}
                  seleccion={seleccion}
                  setSeleccion={setSeleccion}
                  ocupado={ocupado}
                  guardar={guardarAlumno}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Pestaña: Asistencia */}
      {pestaña === 'asistencia' && (
        <section className="space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
            <h3 className="perfil-titulo !text-sm">
              <span className="perfil-icono !w-8 !h-8 !rounded-lg">
                <IconoPerfil nombre="calendario" size={18} />
              </span>
              Fecha de asistencia
            </h3>
            <SelectorDiasAsistencia
              fecha={fecha}
              maximo={limite}
              cambiar={(dia) => {
                const actual = hoyLima();
                setFecha(dia > actual ? actual : dia);
              }}
              disabled={ocupado || cargandoSesion}
            />
          </div>

          {cargandoSesion ? (
            <div className="rounded-xl bg-white p-6 text-center text-xs text-gray-500">
              Cargando sesión y alumnos…
            </div>
          ) : !sesionClase ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-xs text-gray-500">
              No hay sesión programada para esta clase en la fecha ({fecha}).
            </div>
          ) : (
            <div className="space-y-3">
              {/* Asistencia del profesor */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-2.5">
                <h4 className="font-bold text-xs text-gray-900">Mi asistencia como profesor</h4>

                {sesionClase.asistenciaProfesor === 'presente' && !gestionProfesor ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <p className="font-bold text-gray-900">Confirmada para esta fecha</p>
                    </div>
                    <button
                      type="button"
                      disabled={ocupado || sesionClase.estado === 'cancelada'}
                      onClick={() => setGestionProfesor(true)}
                      className="rounded-lg border border-dojo-200 bg-white px-2.5 py-1 font-semibold text-dojo-700 hover:bg-dojo-50"
                    >
                      Editar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">
                      Confirma que estuviste presente y la clase fue realizada.
                    </p>
                    {!gestionProfesor ? (
                      <button
                        type="button"
                        disabled={ocupado || sesionClase.estado === 'cancelada'}
                        onClick={() => setGestionProfesor(true)}
                        className="rounded-xl bg-dojo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-dojo-700 disabled:opacity-50"
                      >
                        Marcar mi asistencia
                      </button>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const motivo =
                            new FormData(e.currentTarget).get('motivo') ||
                            'Asistencia propia del profesor';
                          marcarAsistenciaProfesor(String(motivo));
                        }}
                        className="space-y-2.5 rounded-xl border border-dojo-100 bg-dojo-50 p-3"
                      >
                        <label className="block text-xs font-semibold text-gray-700">
                          Observación
                          <textarea
                            name="motivo"
                            maxLength={300}
                            required
                            defaultValue="Asistencia propia del profesor"
                            className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-xs"
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={ocupado}
                            className="rounded-xl bg-dojo-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setGestionProfesor(false)}
                            className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Asistencia de los alumnos en este turno */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <h4 className="font-bold text-gray-900">Alumnos inscritos en esta sesión</h4>
                  <span className="font-semibold text-gray-500">
                    {sesionClase.alumnos.filter((a) => a.programado).length} programados
                  </span>
                </div>

                {!sesionClase.alumnos.length ? (
                  <p className="text-xs text-gray-500">No hay alumnos para esta sesión.</p>
                ) : (
                  <ul className="space-y-2">
                    {sesionClase.alumnos.map((alumno) => {
                      const avisada = alumno.estado === 'avisada';
                      return (
                        <li
                          key={alumno.id}
                          className="perfil-asistente rounded-xl border border-gray-200 bg-white p-3 text-xs"
                          data-estado={alumno.estado}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                            <div>
                              <p className="font-bold text-gray-900">{alumno.nombre}</p>
                              <p className="text-gray-500 mt-0.5">
                                {etiquetas[alumno.estado] ?? alumno.estado} · {alumno.pendientes}{' '}
                                cls pendientes
                              </p>
                            </div>

                            {sesionClase.estado !== 'cancelada' && alumno.programado && (
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  disabled={ocupado}
                                  onClick={() => marcarAsistenciaAlumno(alumno, 'presente')}
                                  className={
                                    alumno.estado === 'presente'
                                      ? 'rounded-lg border border-gray-900 bg-gray-900 px-2.5 py-1 font-semibold text-white'
                                      : 'rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-semibold text-gray-800 hover:bg-gray-50'
                                  }
                                >
                                  Presente
                                </button>
                                <button
                                  type="button"
                                  disabled={ocupado}
                                  onClick={() => marcarAsistenciaAlumno(alumno, 'falta')}
                                  className={
                                    alumno.estado === 'falta'
                                      ? 'rounded-lg border border-dojo-700 bg-dojo-700 px-2.5 py-1 font-semibold text-white'
                                      : 'rounded-lg border border-dojo-600 bg-white px-2.5 py-1 font-semibold text-dojo-700 hover:bg-dojo-50'
                                  }
                                >
                                  Faltó
                                </button>
                                <button
                                  type="button"
                                  disabled={ocupado || avisada}
                                  onClick={() => marcarAsistenciaAlumno(alumno, 'avisada')}
                                  className={
                                    avisada
                                      ? 'rounded-lg border border-dojo-600 bg-dojo-600 px-2.5 py-1 font-bold text-white'
                                      : 'rounded-lg border border-dojo-600 bg-white px-2.5 py-1 font-semibold text-dojo-700 hover:bg-dojo-50'
                                  }
                                >
                                  {avisada ? '! Avisada' : 'Avisó'}
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
