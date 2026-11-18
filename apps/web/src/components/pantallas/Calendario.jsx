import { useCallback, useEffect, useState } from 'react';
import { useOperacion } from '../../hooks/useOperacion.js';
import { useSesion } from '../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import Mensaje from '../Mensaje.jsx';
import { proximoEntrenamiento } from '../perfiles/alumno/utilidades.js';
import IconoPerfil from '../perfiles/IconoPerfil.jsx';
import AsistenciaProfesor from '../perfiles/profesor/AsistenciaProfesor.jsx';
import SelectorFechaAsistencia from '../SelectorFechaAsistencia.jsx';
import Asistencia from './Asistencia.jsx';

const hoy = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
  }).format(new Date());

function CalendarioAlumno() {
  const [fecha, setFecha] = useState(hoy);
  const [alumnos, setAlumnos] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const { ocupado, aviso, ejecutar } = useOperacion();

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const [datos, horario] = await Promise.all([
        apiFetch('/alumnos', { cache: 'no-store' }).then((r) =>
          leerRespuesta(r, 'No se pudo cargar tu asistencia.'),
        ),
        apiFetch(`/sesiones?fecha=${fecha}`, { cache: 'no-store' }).then((r) =>
          leerRespuesta(r, 'No se pudo cargar el horario.'),
        ),
      ]);
      setAlumnos(datos);
      setSesiones(horario.sesiones ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function avisar(alumno, retirar = false) {
    await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/alumnos/${alumno.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: retirar ? 'retirarAviso' : 'asistencia',
            version: alumno.seguimiento.version,
            fecha,
            ...(retirar ? {} : { estado: 'avisada' }),
          }),
        }),
        'No se pudo guardar el aviso.',
      );

      await cargar();

      return retirar
        ? 'Aviso retirado.'
        : 'Ausencia avisada. La recuperación requiere autorización.';
    });
  }

  return (
    <main
      className="perfil-page perfil-asistencia-page space-y-5 p-4"
      aria-busy={cargando || ocupado}
    >
      <header className="perfil-hero">
        <h2 className="perfil-saludo">Tu entrenamiento</h2>
        <div className="perfil-hero__pie">
          <span className="perfil-cuenta__rol">Mi asistencia</span>
          <span className="perfil-hero__emblema">
            <IconoPerfil nombre="calendario" size={32} />
          </span>
        </div>
      </header>
      <nav className="perfil-accesos" aria-label="Accesos de asistencia">
        <a href="/alumnos">
          <IconoPerfil nombre="clase" />
          <span>Mis clases</span>
        </a>
        <a href="#calendario-personal">
          <IconoPerfil nombre="calendario" />
          <span>Calendario</span>
        </a>
      </nav>
      <Mensaje aviso={aviso} />

      <section
        id="calendario-personal"
        className="perfil-tarjeta perfil-calendario space-y-4 rounded-2xl border border-gray-200 bg-white p-5"
      >
        <h2 className="perfil-titulo">
          <span className="perfil-icono">
            <IconoPerfil nombre="calendario" />
          </span>
          Mi calendario
        </h2>

        <SelectorFechaAsistencia fecha={fecha} cambiar={setFecha} disabled={cargando || ocupado} />

        <button
          type="button"
          disabled={cargando || ocupado}
          onClick={cargar}
          className="min-h-11 font-semibold text-dojo-700"
        >
          Actualizar asistencia
        </button>
      </section>

      {cargando ? (
        <p role="status">Cargando asistencia…</p>
      ) : error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : !alumnos.length ? (
        <p>No tienes inscripciones para consultar.</p>
      ) : (
        alumnos.map((alumno) => {
          const seguimiento = alumno.seguimiento;
          const asistencia = seguimiento.asistencias.find((item) => item.fecha === fecha);
          const pausa = seguimiento.congelamientos.some(
            (congelamiento) =>
              congelamiento.desde <= fecha &&
              (!congelamiento.hasta || fecha < congelamiento.hasta) &&
              (!congelamiento.reactivado || fecha < congelamiento.reactivado),
          );

          const cancelada = sesiones.some(
            (s) => s.alumnoId === alumno.id && s.fecha === fecha && s.estado === 'cancelada',
          );
          const recuperada = seguimiento.recuperaciones.some(
            (r) => r.fecha === fecha && !r.revocada,
          );
          const puedeAvisar =
            proximoEntrenamiento(alumno, fecha, '00:00', sesiones).fecha === fecha;
          const etiqueta = cancelada
            ? 'Cancelada por el dojo'
            : asistencia
              ? {
                  presente: 'Presente',
                  falta: 'Faltó',
                  avisada: 'Ausencia avisada',
                }[asistencia.estado]
              : pausa
                ? 'Plan congelado'
                : !seguimiento.plan
                  ? 'Sin plan activo'
                  : !sesiones.some((s) => s.alumnoId === alumno.id && s.fecha === fecha)
                    ? 'Sin clase programada'
                    : 'Sin asistencia registrada';

          return (
            <section
              key={alumno.id}
              className="perfil-tarjeta space-y-3 rounded-2xl border border-gray-200 bg-white p-5"
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
                <h3 className="font-bold">{alumno.nombre}</h3>
              </div>

              <p className="text-sm text-gray-600">
                {alumno.clase?.turno ?? alumno.clase?.nivel ?? 'Clase asignada'}
              </p>

              <p
                className="perfil-estado"
                data-estado={
                  cancelada
                    ? 'cancelada'
                    : pausa
                      ? 'congelado'
                      : (asistencia?.estado ?? 'pendiente')
                }
              >
                <IconoPerfil
                  nombre={
                    cancelada
                      ? 'pausa'
                      : asistencia?.estado === 'presente'
                        ? 'presente'
                        : 'calendario'
                  }
                  size={18}
                />
                {etiqueta}
              </p>

              {recuperada && (
                <p className="perfil-estado">
                  <IconoPerfil nombre="historial" size={18} />
                  Recuperación autorizada
                </p>
              )}

              {fecha >= hoy() &&
                seguimiento.plan &&
                !pausa &&
                !cancelada &&
                !recuperada &&
                (puedeAvisar || asistencia?.estado === 'avisada') &&
                (!asistencia || asistencia.estado === 'avisada') && (
                  <button
                    type="button"
                    disabled={ocupado || cargando}
                    onClick={() => avisar(alumno, asistencia?.estado === 'avisada')}
                    className="perfil-accion-asistencia min-h-12 rounded-xl border border-dojo-600 bg-dojo-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {asistencia?.estado === 'avisada' ? 'Retirar aviso' : 'Avisar ausencia'}
                  </button>
                )}
            </section>
          );
        })
      )}
    </main>
  );
}

export default function Calendario() {
  const sesion = useSesion();

  if (!sesion) {
    return <p className="p-4">Cargando tu perfil…</p>;
  }

  if (sesion.perfil === 'alumno') {
    return <CalendarioAlumno />;
  }

  if (sesion.perfil === 'profesor') {
    return <AsistenciaProfesor />;
  }

  return <Asistencia />;
}
