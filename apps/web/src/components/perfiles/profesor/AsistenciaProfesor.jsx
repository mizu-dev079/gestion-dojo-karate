import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOperacion } from '../../../hooks/useOperacion.js';
import { useSesion } from '../../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../../lib/api.js';
import Mensaje from '../../Mensaje.jsx';
import SelectorDiasAsistencia from '../../SelectorDiasAsistencia.jsx';
import { hoyLima } from '../alumno/utilidades.js';
import IconoPerfil from '../IconoPerfil.jsx';

const fechaEspañol = (fecha) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${fecha}T12:00:00Z`));

const capitalizar = (texto) =>
  texto
    .split(' ')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');

const etiquetas = {
  pendiente: 'Pendiente',
  presente: 'Presente',
  falta: 'Faltó',
  avisada: 'Avisó ausencia',
  congelado: 'Plan congelado',
  'sin sesión': 'Sin sesión contratada',
  cancelada: 'Cancelada por el dojo',
};

export default function AsistenciaProfesor() {
  const sesion = useSesion();
  const [limite, setLimite] = useState(hoyLima);
  const hoy = limite;
  const [fecha, setFecha] = useState(hoyLima);
  const diaAnterior = useRef(limite);
  const [sesiones, setSesiones] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [gestionProfesor, setGestionProfesor] = useState(null);
  const [justificacionesAbiertas, setJustificacionesAbiertas] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [fechaAusencia, setFechaAusencia] = useState(hoy);
  const [motivoJustificacion, setMotivoJustificacion] = useState('');
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const cargaActual = useRef(0);

  const cargar = useCallback(async () => {
    const carga = ++cargaActual.current;
    setCargando(true);
    try {
      const [resultadoSesiones, resultadoAlumnos] = await Promise.all([
        apiFetch(`/sesiones?fecha=${fecha}`, { cache: 'no-store' }).then((r) =>
          leerRespuesta(r, 'No se pudieron cargar las sesiones.'),
        ),
        apiFetch('/alumnos', { cache: 'no-store' }).then((r) =>
          leerRespuesta(r, 'No se pudieron cargar los alumnos.'),
        ),
      ]);
      if (carga !== cargaActual.current) return;
      setSesiones(resultadoSesiones.sesiones ?? []);
      setAlumnos(resultadoAlumnos ?? []);
    } catch (error) {
      if (carga === cargaActual.current) {
        setSesiones([]);
        setAlumnos([]);
        setAviso({ tipo: 'error', texto: error.message });
      }
    } finally {
      if (carga === cargaActual.current) setCargando(false);
    }
  }, [fecha, setAviso]);

  useEffect(() => {
    if (sesion?.perfil !== 'profesor') return;
    cargar();
    return () => {
      cargaActual.current += 1;
    };
  }, [sesion, cargar]);

  useEffect(() => {
    const verificarCambio = () => {
      const actual = hoyLima();
      if (actual === diaAnterior.current) return;
      const anterior = diaAnterior.current;
      diaAnterior.current = actual;
      setLimite(actual);
      setFecha((valor) => (valor === anterior || valor > actual ? actual : valor));
      setGestionProfesor(null);
    };
    verificarCambio();
    const intervalo = window.setInterval(verificarCambio, 30000);
    window.addEventListener('focus', verificarCambio);
    document.addEventListener('visibilitychange', verificarCambio);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', verificarCambio);
      document.removeEventListener('visibilitychange', verificarCambio);
    };
  }, []);

  function elegirFecha(dia) {
    const actual = hoyLima();
    const elegida = dia > actual ? actual : dia;
    if (elegida === fecha) return;
    setCargando(true);
    setGestionProfesor(null);
    cerrarFormularioJustificacion();
    setFecha(elegida);
  }

  const justificaciones = useMemo(
    () =>
      alumnos.flatMap((alumno) =>
        (alumno.seguimiento?.asistencias ?? [])
          .filter((asistencia) => asistencia.estado !== 'presente')
          .map((asistencia) => ({ alumno, asistencia })),
      ),
    [alumnos],
  );

  const recuperada = (alumno, fechaFalta) =>
    alumno.seguimiento.recuperaciones.some((r) => r.fecha === fechaFalta && !r.revocada);
  const puedeRecuperar = (alumno, asistencia) => {
    if (asistencia.fecha > hoy || recuperada(alumno, asistencia.fecha)) return false;
    const paquete = alumno.seguimiento.pagos.find((p) => p.id === asistencia.pagoId);
    if (!paquete) return false;
    const limite = paquete.limiteRecuperaciones ?? (paquete.cantidad === 4 ? 1 : 2);
    return (
      alumno.seguimiento.recuperaciones.filter((r) => r.pagoId === paquete.id && !r.revocada)
        .length < limite
    );
  };

  async function confirmarProfesor(sesionTurno, motivo) {
    await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/sesiones/${sesionTurno.claseId}/${sesionTurno.fecha}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'profesor',
            version: sesionTurno.version,
            asistencia: 'presente',
            motivo,
          }),
        }),
        'No se pudo confirmar la asistencia del profesor.',
      );

      setGestionProfesor(null);
      await cargar();
      return 'Asistencia del profesor confirmada.';
    });
  }

  async function marcarAlumno(alumno, estado) {
    await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/alumnos/${alumno.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'asistencia',
            version: alumno.version,
            fecha,
            estado,
          }),
        }),
        'No se pudo registrar la asistencia.',
      );

      await cargar();
      return estado === 'avisada' ? 'Aviso de ausencia registrado.' : 'Asistencia registrada.';
    });
  }

  async function retirarAviso(alumno, asistencia) {
    await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/alumnos/${alumno.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'retirarAviso',
            version: alumno.seguimiento.version,
            fecha: asistencia.fecha,
          }),
        }),
        'No se pudo retirar el aviso.',
      );

      await cargar();
      return 'Aviso retirado.';
    });
  }

  async function registrarJustificacion(event) {
    event.preventDefault();

    if (!alumnoSeleccionado || !motivoJustificacion.trim()) return;

    await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/alumnos/${alumnoSeleccionado.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'recuperar',
            version: alumnoSeleccionado.seguimiento.version,
            fecha: fechaAusencia,
            motivo: motivoJustificacion.trim(),
          }),
        }),
        'No se pudo autorizar la recuperación.',
      );

      await cargar();
      setMotivoJustificacion('');
      setAlumnoSeleccionado(null);
      setJustificacionesAbiertas(false);
      return 'Recuperación autorizada.';
    });
  }

  function cerrarFormularioJustificacion() {
    setJustificacionesAbiertas(false);
    setAlumnoSeleccionado(null);
    setMotivoJustificacion('');
  }

  if (!sesion) {
    return <p className="p-4">Cargando tu perfil…</p>;
  }

  if (sesion.perfil !== 'profesor') {
    return null;
  }

  return (
    <main
      className="perfil-page perfil-profesor-page perfil-asistencia-page space-y-5 p-4"
      aria-busy={ocupado || cargando}
    >
      <header className="perfil-hero">
        <p className="perfil-eyebrow">ÁREA DEL PROFESOR</p>
        <h2 className="perfil-saludo">Tu jornada</h2>
        <div className="perfil-resumen">
          <div>
            <strong>{cargando ? '—' : sesiones.length}</strong>
            <span>Turnos</span>
          </div>
          <div>
            <strong>
              {cargando
                ? '—'
                : new Set(
                    sesiones.flatMap((s) => s.alumnos.filter((a) => a.programado).map((a) => a.id)),
                  ).size}
            </strong>
            <span>Alumnos del día</span>
          </div>
        </div>
      </header>
      <nav className="perfil-accesos" aria-label="Secciones de asistencia">
        <a href="#asistencia-propia">
          <IconoPerfil nombre="presente" />
          <span>Mi asistencia</span>
        </a>
        <a href="#asistencia-alumnos">
          <IconoPerfil nombre="alumnos" />
          <span>Alumnos</span>
        </a>
        <a href="#recuperaciones">
          <IconoPerfil nombre="historial" />
          <span>Recuperaciones</span>
        </a>
      </nav>
      <Mensaje aviso={aviso} />

      <section className="perfil-tarjeta perfil-selector-diario space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="perfil-titulo">
          <span className="perfil-icono">
            <IconoPerfil nombre="calendario" />
          </span>
          Fecha de asistencia
        </h2>
        <SelectorDiasAsistencia
          fecha={fecha}
          maximo={limite}
          cambiar={elegirFecha}
          disabled={cargando || ocupado}
        />
        <button
          type="button"
          disabled={ocupado || cargando}
          onClick={cargar}
          className="min-h-11 font-semibold text-dojo-700"
        >
          Actualizar asistencia
        </button>
      </section>

      {cargando ? (
        <p role="status">Cargando sesiones…</p>
      ) : (
        <>
          <section
            id="asistencia-propia"
            className="perfil-tarjeta space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h2 className="perfil-titulo">
              <span className="perfil-icono">
                <IconoPerfil nombre="presente" />
              </span>
              Mi asistencia
            </h2>

            {!sesiones.length && (
              <p className="text-sm text-gray-600">No hay turnos asignados para esta fecha.</p>
            )}

            {sesiones.map((sesionTurno) => (
              <div key={sesionTurno.claseId} className="space-y-3">
                {sesionTurno.estado === 'cancelada' && (
                  <p className="font-semibold text-dojo-700">Cancelada por el dojo</p>
                )}
                {sesionTurno.asistenciaProfesor === 'presente' &&
                gestionProfesor !== sesionTurno.claseId ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="font-bold text-gray-900">✓</span>

                      <div className="min-w-0">
                        <p className="font-bold text-gray-900">Asistencia confirmada</p>

                        <p className="text-xs text-gray-600">
                          {sesionTurno.nivel} (
                          {sesionTurno.turno || `${sesionTurno.horaInicio}–${sesionTurno.horaFin}`})
                          · Prof. {sesionTurno.profesor}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={ocupado || sesionTurno.estado === 'cancelada'}
                      onClick={() => setGestionProfesor(sesionTurno.claseId)}
                      className="min-h-9 shrink-0 rounded-xl border border-dojo-200 bg-white px-3 py-1.5 text-xs font-semibold text-dojo-700"
                    >
                      Editar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-700">
                      <p className="font-semibold">
                        {sesionTurno.nivel} · {sesionTurno.horaInicio}–{sesionTurno.horaFin}
                      </p>

                      {sesionTurno.turno && <p>{sesionTurno.turno}</p>}

                      {sesionTurno.sede && <p>{sesionTurno.sede}</p>}

                      <p>
                        Profesor responsable:{' '}
                        <strong>{sesionTurno.profesor || 'Sin asignar'}</strong>
                      </p>
                    </div>

                    {sesionTurno.asistenciaProfesor !== 'presente' && (
                      <button
                        type="button"
                        disabled={ocupado || sesionTurno.estado === 'cancelada'}
                        onClick={() => setGestionProfesor(sesionTurno.claseId)}
                        className="rounded-xl border border-dojo-600 bg-dojo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Marcar mi asistencia
                      </button>
                    )}

                    {gestionProfesor === sesionTurno.claseId && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const motivo =
                            new FormData(event.currentTarget).get('motivo') ||
                            'Asistencia propia del profesor';

                          confirmarProfesor(sesionTurno, String(motivo));
                        }}
                        className="space-y-3 rounded-xl border border-dojo-100 bg-dojo-50 p-4"
                      >
                        <label className="block text-sm font-semibold">
                          Asistencia del profesor
                          <select
                            name="asistencia"
                            defaultValue="presente"
                            className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3"
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
                            className="mt-1 min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-2"
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={ocupado}
                            className="min-h-11 rounded-xl border border-dojo-600 bg-white px-3 py-2 text-sm font-semibold text-dojo-700"
                          >
                            Confirmar
                          </button>

                          <button
                            type="button"
                            onClick={() => setGestionProfesor(null)}
                            className="min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                          >
                            Cerrar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>

          <section
            id="asistencia-alumnos"
            className="perfil-tarjeta space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h2 className="perfil-titulo">
              <span className="perfil-icono">
                <IconoPerfil nombre="alumnos" />
              </span>
              Asistencia de alumnos
            </h2>

            {!sesiones.length && (
              <p className="text-sm text-gray-600">No hay sesiones para mostrar.</p>
            )}

            {sesiones.map((sesionTurno) => (
              <div
                key={sesionTurno.claseId}
                className="space-y-3 rounded-2xl border border-gray-200 p-3"
              >
                <h3 className="font-bold">
                  {sesionTurno.nivel} · {sesionTurno.horaInicio}–{sesionTurno.horaFin}
                </h3>

                {sesionTurno.turno && <p className="text-sm text-gray-600">{sesionTurno.turno}</p>}

                <p className="text-sm font-semibold text-gray-700">
                  Alumnos · {sesionTurno.alumnos.filter((alumno) => alumno.programado).length}{' '}
                  programados
                </p>

                {!sesionTurno.alumnos.length && (
                  <p className="text-sm text-gray-600">No hay alumnos inscritos en este turno.</p>
                )}

                <ul className="space-y-3">
                  {sesionTurno.alumnos.map((alumno) => {
                    const avisada = alumno.estado === 'avisada';

                    return (
                      <li
                        key={alumno.id}
                        className="perfil-asistente rounded-xl border border-gray-200 bg-white p-4"
                        data-estado={alumno.estado}
                      >
                        <div className="perfil-asistencia-nombre">
                          <span className="perfil-avatar" aria-hidden="true">
                            {alumno.nombre
                              .trim()
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join('')}
                          </span>
                          <p className="font-bold">{alumno.nombre}</p>
                        </div>

                        <p className="perfil-estado" data-estado={alumno.estado}>
                          {etiquetas[alumno.estado] ?? alumno.estado} · {alumno.pendientes} clases
                          pendientes
                        </p>

                        {sesionTurno.estado !== 'cancelada' && alumno.programado && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => marcarAlumno(alumno, 'presente')}
                              className={
                                alumno.estado === 'presente'
                                  ? 'rounded-xl border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-semibold text-white'
                                  : 'rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900'
                              }
                            >
                              Presente
                            </button>

                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => marcarAlumno(alumno, 'falta')}
                              className={
                                alumno.estado === 'falta'
                                  ? 'rounded-xl border border-dojo-700 bg-dojo-700 px-3 py-2 text-sm font-semibold text-white'
                                  : 'rounded-xl border border-dojo-600 bg-white px-3 py-2 text-sm font-semibold text-dojo-700'
                              }
                            >
                              Faltó
                            </button>

                            <button
                              type="button"
                              disabled={ocupado || avisada}
                              onClick={() => marcarAlumno(alumno, 'avisada')}
                              className={
                                avisada
                                  ? 'rounded-xl border border-dojo-600 bg-dojo-600 px-3 py-2 text-sm font-bold text-white shadow-sm ring-2 ring-dojo-200'
                                  : 'rounded-xl border border-dojo-600 bg-white px-3 py-2 text-sm font-semibold text-dojo-700'
                              }
                            >
                              {avisada ? '! Avisó ausencia' : 'Avisó ausencia'}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>

          <section
            id="recuperaciones"
            className="perfil-tarjeta space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h2 className="perfil-titulo">
              <span className="perfil-icono">
                <IconoPerfil nombre="historial" />
              </span>
              Ausencias y recuperaciones
            </h2>
            {justificaciones.map(({ alumno, asistencia }) => (
              <div
                key={`${alumno.id}-${asistencia.fecha}`}
                className="space-y-2 rounded-xl border border-gray-200 p-3"
              >
                <div className="perfil-asistencia-nombre">
                  <span className="perfil-avatar" aria-hidden="true">
                    {alumno.nombre
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <p className="font-bold">{alumno.nombre}</p>
                </div>
                <p className="text-sm text-gray-600">
                  {alumno.clase?.turno} · {capitalizar(fechaEspañol(asistencia.fecha))}
                </p>
                <p className="text-sm">
                  {recuperada(alumno, asistencia.fecha)
                    ? 'Recuperación autorizada'
                    : etiquetas[asistencia.estado]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {puedeRecuperar(alumno, asistencia) && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => {
                        setAlumnoSeleccionado(alumno);
                        setFechaAusencia(asistencia.fecha);
                        setMotivoJustificacion('');
                        setJustificacionesAbiertas(true);
                      }}
                      className="min-h-11 rounded-xl bg-dojo-600 px-3 py-2 font-semibold text-white"
                    >
                      Autorizar recuperación
                    </button>
                  )}
                  {asistencia.estado === 'avisada' &&
                    asistencia.fecha >= hoy &&
                    !recuperada(alumno, asistencia.fecha) && (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => retirarAviso(alumno, asistencia)}
                        className="min-h-11 rounded-xl border border-dojo-600 px-3 py-2 font-semibold text-dojo-700"
                      >
                        Retirar aviso
                      </button>
                    )}
                </div>
              </div>
            ))}
            {!justificaciones.length && (
              <p className="text-sm text-gray-600">No hay ausencias registradas.</p>
            )}
            {justificacionesAbiertas && alumnoSeleccionado && (
              <form
                onSubmit={registrarJustificacion}
                className="space-y-3 rounded-xl bg-dojo-50 p-4"
              >
                <p className="font-bold">
                  {alumnoSeleccionado.nombre} · {fechaEspañol(fechaAusencia)}
                </p>
                <label className="block text-sm font-semibold">
                  Motivo de recuperación
                  <textarea
                    required
                    maxLength={300}
                    value={motivoJustificacion}
                    onChange={(event) => setMotivoJustificacion(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={ocupado || !motivoJustificacion.trim()}
                    className="min-h-11 rounded-xl bg-dojo-600 px-3 py-2 font-semibold text-white"
                  >
                    Autorizar
                  </button>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={cerrarFormularioJustificacion}
                    className="min-h-11 rounded-xl border border-gray-300 px-3 py-2"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
