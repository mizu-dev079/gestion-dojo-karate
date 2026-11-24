import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActualizarAlVolver } from '../../../hooks/useActualizarAlVolver.js';
import { useFechaAsistencia } from '../../../hooks/useFechaAsistencia.js';
import { useOperacion } from '../../../hooks/useOperacion.js';
import { useSesion } from '../../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../../lib/api.js';
import { sesionesDelTurno } from '../../../lib/clases.js';
import { actualizarNavegacion } from '../../../lib/navegacion.js';
import { etiquetasAsistencia as etiquetas } from '../../../lib/seguimiento.js';
import Mensaje from '../../Mensaje.jsx';
import SelectorDiasAsistencia from '../../SelectorDiasAsistencia.jsx';
import IconoPerfil from '../IconoPerfil.jsx';
import SesionProfesor from './SesionProfesor.jsx';

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

export default function AsistenciaProfesor({
  claseId = null,
  incrustada = false,
  recargarAlumnos,
} = {}) {
  const sesion = useSesion();
  const { fecha, setFecha, limite } = useFechaAsistencia();
  const hoy = limite;
  const [filtroTurno, setFiltroTurno] = useState(null);
  const turnoSeleccionado = claseId ?? filtroTurno;
  useEffect(() => {
    if (claseId) return;
    const leer = () => setFiltroTurno(new URLSearchParams(window.location.search).get('turno'));
    leer();
    window.addEventListener('popstate', leer);
    return () => window.removeEventListener('popstate', leer);
  }, [claseId]);
  const [sesiones, setSesiones] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [errorCarga, setErrorCarga] = useState('');
  const [cargando, setCargando] = useState(true);
  const [gestionProfesor, setGestionProfesor] = useState(null);
  const [justificacionesAbiertas, setJustificacionesAbiertas] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [fechaAusencia, setFechaAusencia] = useState(hoy);
  const [motivoJustificacion, setMotivoJustificacion] = useState('');
  const { ocupado, aviso, ejecutar } = useOperacion();
  const cargaActual = useRef(0);

  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      const carga = ++cargaActual.current;
      if (!silencioso) setCargando(true);
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
        setErrorCarga('');
        setSesiones(sesionesDelTurno(resultadoSesiones.sesiones ?? [], turnoSeleccionado));
        setAlumnos(
          (resultadoAlumnos ?? []).filter(
            (a) => !turnoSeleccionado || String(a.claseId) === String(turnoSeleccionado),
          ),
        );
      } catch (error) {
        if (carga === cargaActual.current) {
          setSesiones([]);
          setAlumnos([]);
          setErrorCarga(error.message);
        }
      } finally {
        if (carga === cargaActual.current) setCargando(false);
      }
    },
    [fecha, turnoSeleccionado],
  );

  useEffect(() => {
    if (sesion?.perfil !== 'profesor') return;
    setGestionProfesor(null);
    setJustificacionesAbiertas(false);
    cargar();
    return () => {
      cargaActual.current += 1;
    };
  }, [sesion, cargar]);

  useActualizarAlVolver(
    cargar,
    ocupado || gestionProfesor !== null || justificacionesAbiertas,
    sesion?.perfil === 'profesor',
  );

  function elegirFecha(dia) {
    if (dia === fecha) return;
    setCargando(true);
    cerrarFormularioJustificacion();
    setFecha(dia);
  }
  async function actualizarSeguimiento() {
    await cargar();
    if (recargarAlumnos) await recargarAlumnos({ silencioso: true });
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
      await actualizarSeguimiento();
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

      await actualizarSeguimiento();
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

      await actualizarSeguimiento();
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

      await actualizarSeguimiento();
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

  const Contenedor = incrustada ? 'section' : 'main';
  return (
    <Contenedor
      className={
        incrustada
          ? 'space-y-4'
          : 'perfil-page perfil-profesor-page perfil-asistencia-page space-y-5 p-4'
      }
      aria-busy={ocupado || cargando}
    >
      {!incrustada && (
        <header className="perfil-hero jornada-resumen">
          <p className="perfil-eyebrow">ÁREA DEL PROFESOR</p>
          <h2 className="perfil-saludo">Tu jornada</h2>
          <div className="perfil-resumen">
            <div>
              <strong className="jornada-numero">{cargando ? '—' : sesiones.length}</strong>
              <span>Turnos</span>
            </div>
            <div>
              <strong className="jornada-numero">
                {cargando
                  ? '—'
                  : new Set(
                      sesiones.flatMap((s) =>
                        s.alumnos.filter((a) => a.programado).map((a) => a.id),
                      ),
                    ).size}
              </strong>
              <span>Alumnos</span>
            </div>
          </div>
          <button
            type="button"
            className="jornada-recuperaciones"
            aria-controls="recuperaciones"
            onClick={() => {
              const panel = document.getElementById('recuperaciones');
              if (panel) {
                panel.open = true;
                panel.scrollIntoView({ block: 'start' });
              }
            }}
          >
            <IconoPerfil nombre="historial" size={18} />
            Ausencias y recuperaciones{' '}
            <span className="jornada-recuperaciones__flecha" aria-hidden="true">
              <IconoPerfil nombre="flecha" size={18} />
            </span>
          </button>
        </header>
      )}
      {!incrustada && filtroTurno && (
        <button
          type="button"
          className="min-h-11 font-semibold text-dojo-700"
          disabled={ocupado}
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('turno');
            actualizarNavegacion(url);
            setFiltroTurno(null);
          }}
        >
          Ver todos mis turnos
        </button>
      )}
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
      ) : errorCarga ? (
        <div role="alert" className="rounded-xl border border-dojo-100 bg-white p-4 text-dojo-800">
          <p>{errorCarga}</p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => cargar()}
            className="mt-2 min-h-11 font-semibold"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <section id="asistencia-propia" className="jornada-sesiones space-y-4">
            <h2 className="sr-only">Mi asistencia</h2>
            <span id="asistencia-alumnos" className="ancla-asistencia" />
            {!sesiones.length && (
              <div className="portal-vacio">
                <IconoPerfil nombre="calendario" size={30} />
                <p>No hay turnos asignados para esta fecha.</p>
              </div>
            )}
            {sesiones.map((sesionTurno) => (
              <SesionProfesor
                key={sesionTurno.claseId}
                sesionTurno={sesionTurno}
                ocupado={ocupado}
                gestionProfesor={gestionProfesor}
                setGestionProfesor={setGestionProfesor}
                confirmarProfesor={confirmarProfesor}
                marcarAlumno={marcarAlumno}
              />
            ))}
          </section>

          <details
            id="recuperaciones"
            className="perfil-tarjeta space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <summary className="perfil-titulo">
              <span className="perfil-icono">
                <IconoPerfil nombre="historial" />
              </span>
              Ausencias y recuperaciones
              <span className="detalle-flecha" aria-hidden="true">
                ⌄
              </span>
            </summary>
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
          </details>
        </>
      )}
    </Contenedor>
  );
}
