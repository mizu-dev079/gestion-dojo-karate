import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActualizarAlVolver } from '../../../hooks/useActualizarAlVolver.js';
import { useOperacion } from '../../../hooks/useOperacion.js';
import { useSesion } from '../../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../../lib/api.js';
import {
  etiquetaTurno,
  clasesDelProfesor as obtenerClasesDelProfesor,
} from '../../../lib/clases.js';
import { actualizarNavegacion } from '../../../lib/navegacion.js';
import { primerNombre } from '../../../lib/seguimiento.js';
import { agruparClases } from '../../../lib/turnos.js';
import Mensaje from '../../Mensaje.jsx';
import PortadaClase from '../../PortadaClase.jsx';
import IconoPerfil from '../IconoPerfil.jsx';
import DetalleClase from './DetalleClase.jsx';
import FichaAlumnoProfesor from './FichaAlumnoProfesor.jsx';

export default function MisClases() {
  const sesion = useSesion();
  const [alumnos, setAlumnos] = useState([]);
  const [catalogoClases, setCatalogoClases] = useState([]);
  const [errorCarga, setErrorCarga] = useState('');
  const [cargando, setCargando] = useState(true);
  const [claseSeleccionadaId, setClaseSeleccionadaId] = useState(null);
  const [pestañaInicialDetalle, setPestañaInicialDetalle] = useState('alumnos');
  const [mostrarSolicitudes, setMostrarSolicitudes] = useState(false);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [seleccionSolicitud, setSeleccionSolicitud] = useState(null);

  const cargaActual = useRef(0);
  const { ocupado, aviso, ejecutar } = useOperacion();

  // Carga de alumnos y catálogo de clases
  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    const carga = ++cargaActual.current;
    if (!silencioso) setCargando(true);
    try {
      const [datosAlumnos, datosCatalogo] = await Promise.all([
        apiFetch('/alumnos', { cache: 'no-store' }).then((r) =>
          leerRespuesta(r, 'No se pudieron cargar los alumnos.'),
        ),
        apiFetch('/clases/catalogo', { cache: 'no-store' }).then((r) =>
          leerRespuesta(r, 'No se pudieron cargar las clases.'),
        ),
      ]);

      if (carga !== cargaActual.current) return;
      setErrorCarga('');
      setAlumnos(datosAlumnos ?? []);
      const turnosPlanos = (datosCatalogo.clases ?? []).flatMap((c) => c.turnos ?? [c]);
      setCatalogoClases(turnosPlanos);
    } catch (error) {
      if (carga === cargaActual.current) setErrorCarga(error.message);
    } finally {
      if (carga === cargaActual.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (sesion?.perfil === 'profesor') {
      cargar();
    }
  }, [sesion, cargar]);

  // Guardar cambios en el seguimiento de un alumno (acciones como congelar, recuperar, etc.)
  async function guardarAlumno(id, datos) {
    cargaActual.current += 1;
    setCargando(false);
    const ok = await ejecutar(async () => {
      const seguimiento = await leerRespuesta(
        await apiFetch(`/alumnos/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        }),
        'No se pudo actualizar el registro del alumno.',
      );
      setAlumnos((previos) => previos.map((a) => (a.id === id ? { ...a, seguimiento } : a)));
      return 'Registro actualizado correctamente.';
    });
    if (ok) setSeleccionSolicitud(null);
    return ok;
  }

  const clasesDelProfesor = useMemo(
    () => obtenerClasesDelProfesor(alumnos, catalogoClases, sesion),
    [alumnos, catalogoClases, sesion],
  );
  const grupos = agruparClases(clasesDelProfesor);
  useActualizarAlVolver(
    cargar,
    ocupado || formularioAbierto || Boolean(seleccionSolicitud),
    sesion?.perfil === 'profesor',
  );
  useEffect(() => {
    const leer = () => {
      const p = new URLSearchParams(window.location.search);
      setClaseSeleccionadaId(p.get('turno'));
      setPestañaInicialDetalle(p.get('seccion') === 'asistencia' ? 'asistencia' : 'alumnos');
    };
    leer();
    window.addEventListener('popstate', leer);
    return () => window.removeEventListener('popstate', leer);
  }, []);
  function seleccionarClase(id, seccion = 'alumnos', reemplazar = false) {
    setClaseSeleccionadaId(id);
    setPestañaInicialDetalle(seccion);
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set('turno', id);
      url.searchParams.set('seccion', seccion);
    } else {
      url.searchParams.delete('turno');
      url.searchParams.delete('seccion');
      url.searchParams.delete('fecha');
    }
    actualizarNavegacion(url, reemplazar);
  }

  // Total de solicitudes pendientes
  const alumnosConSolicitudes = useMemo(() => {
    return alumnos.filter((a) => a.seguimiento?.solicitudes?.some((s) => s.estado === 'pendiente'));
  }, [alumnos]);

  // Clase activa en detalle
  const claseActiva = useMemo(() => {
    if (!claseSeleccionadaId) return null;
    return clasesDelProfesor.find((c) => String(c.id) === String(claseSeleccionadaId)) ?? null;
  }, [clasesDelProfesor, claseSeleccionadaId]);

  const alumnosClaseActiva = useMemo(() => {
    if (!claseActiva) return [];
    return alumnos.filter((a) => a.claseId === claseActiva.id || a.clase?.id === claseActiva.id);
  }, [alumnos, claseActiva]);

  const errorVisible = errorCarga && (
    <div role="alert" className="rounded-xl border border-dojo-100 bg-white p-4 text-dojo-800">
      <p>{errorCarga}</p>
      <button
        type="button"
        disabled={ocupado || cargando}
        onClick={() => cargar()}
        className="mt-2 min-h-11 font-semibold"
      >
        Reintentar
      </button>
    </div>
  );

  // Si hay una clase seleccionada, renderizamos el detalle de esa clase
  if (claseActiva) {
    return (
      <main className="perfil-page perfil-profesor-page space-y-4 px-4 pb-12 pt-4">
        <Mensaje aviso={aviso} />
        {errorVisible}
        <DetalleClase
          clase={claseActiva}
          setFormularioAbierto={setFormularioAbierto}
          alumnosClase={alumnosClaseActiva}
          onVolver={() => {
            seleccionarClase(null);
            cargar({ silencioso: true });
          }}
          ocupado={ocupado}
          guardarAlumno={guardarAlumno}
          recargarAlumnos={cargar}
          cambiarPestaña={(seccion) => seleccionarClase(claseActiva.id, seccion, true)}
          pestañaInicial={pestañaInicialDetalle}
        />
      </main>
    );
  }

  return (
    <main
      className="perfil-page perfil-profesor-page space-y-5 px-4 pb-12 pt-4"
      aria-busy={cargando || ocupado}
    >
      <Mensaje aviso={aviso} />
      {errorVisible}
      {/* Hero del profesor: Resumen general y acceso a solicitudes */}
      <header className="perfil-hero profesor-bienvenida">
        <p className="perfil-eyebrow">Tus clases</p>
        <h2 className="perfil-saludo">
          {clasesDelProfesor[0]?.profesor
            ? `Hola, ${primerNombre(clasesDelProfesor[0].profesor)}`
            : 'Tus clases'}
        </h2>

        <div className="perfil-resumen">
          <div>
            <strong>{cargando ? '—' : grupos.length}</strong>
            <span>{grupos.length === 1 ? 'Clase asignada' : 'Clases asignadas'}</span>
          </div>
          <div>
            <strong>{cargando ? '—' : alumnos.length}</strong>
            <span>Total alumnos</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <a href="/calendario" className="perfil-hero__accion !mt-0 !min-h-11">
            <IconoPerfil nombre="calendario" />
            <span>Asistencia de hoy</span>
            <IconoPerfil nombre="flecha" />
          </a>

          {alumnosConSolicitudes.length > 0 && (
            <button
              type="button"
              onClick={() => setMostrarSolicitudes(!mostrarSolicitudes)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-colors"
            >
              <IconoPerfil nombre="postulaciones" size={18} />
              <span>
                {alumnosConSolicitudes.length}{' '}
                {alumnosConSolicitudes.length === 1 ? 'solicitud pendiente' : 'solicitudes'}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Sección desplegable de solicitudes pendientes (si existen y se activan) */}
      {mostrarSolicitudes && alumnosConSolicitudes.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-amber-900 flex items-center gap-2">
              <IconoPerfil nombre="postulaciones" size={18} /> Solicitudes pendientes de revisión
            </h3>
            <button
              type="button"
              onClick={() => setMostrarSolicitudes(false)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              Cerrar
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {alumnosConSolicitudes.map((alumno) => (
              <FichaAlumnoProfesor
                key={alumno.id}
                alumno={alumno}
                seleccion={seleccionSolicitud}
                setSeleccion={setSeleccionSolicitud}
                ocupado={ocupado}
                guardar={guardarAlumno}
              />
            ))}
          </div>
        </section>
      )}

      {/* Lista / Grid de Tarjetas de clases asignadas */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Clases a tu cargo</h3>
          <button
            type="button"
            onClick={cargar}
            disabled={cargando || ocupado}
            className="text-xs font-semibold text-dojo-700 hover:underline disabled:opacity-50"
          >
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {cargando ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            Cargando tus clases asignadas…
          </div>
        ) : clasesDelProfesor.length === 0 && errorCarga ? null : clasesDelProfesor.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <IconoPerfil nombre="clase" size={24} />
            </div>
            <h4 className="text-base font-bold text-gray-900">Aún no tienes clases asignadas</h4>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              El administrador del dojo te asignará a tus clases, sedes y horarios oficiales.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {grupos.map((grupo) => (
              <article
                key={grupo.id}
                className="curso-tarjeta profesor-curso perfil-tarjeta space-y-4 rounded-2xl border border-gray-200 bg-white p-5"
              >
                <PortadaClase nombre={grupo.nombre} turnos={grupo.turnos.length} nivel={3} />
                {grupo.turnos.map((clase) => {
                  const cantidadAlumnos = clase.alumnosIds?.size ?? 0;
                  const solicitudesClase = alumnos.filter(
                    (a) =>
                      String(a.claseId) === String(clase.id) &&
                      a.seguimiento.solicitudes.some((r) => r.estado === 'pendiente'),
                  ).length;
                  return (
                    <div key={clase.id} className="perfil-clase-turno">
                      <h4 className="font-bold">{etiquetaTurno(clase)}</h4>
                      <p className="mt-1 text-sm text-gray-600">
                        {clase.frecuencia?.join(', ')} · {clase.horaInicio}–{clase.horaFin}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {clase.sede || 'Sede por asignar'}
                      </p>
                      <p className="mt-2 text-sm">
                        {cantidadAlumnos} {cantidadAlumnos === 1 ? 'alumno' : 'alumnos'}
                        {solicitudesClase > 0 && (
                          <span className="ml-2 font-semibold text-dojo-700">
                            {solicitudesClase} por revisar
                          </span>
                        )}
                      </p>
                      <div className="perfil-clase-turno__acciones">
                        <button
                          type="button"
                          onClick={() => seleccionarClase(clase.id)}
                          className="min-h-11 rounded-xl bg-dojo-600 px-3 py-2 font-semibold text-white"
                        >
                          Ver alumnos
                        </button>
                        <button
                          type="button"
                          onClick={() => seleccionarClase(clase.id, 'asistencia')}
                          className="min-h-11 rounded-xl border border-gray-300 px-3 py-2 font-semibold"
                        >
                          Asistencia
                        </button>
                      </div>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
