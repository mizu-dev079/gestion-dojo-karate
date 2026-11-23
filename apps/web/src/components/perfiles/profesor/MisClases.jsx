import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOperacion } from '../../../hooks/useOperacion.js';
import { useSesion } from '../../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../../lib/api.js';
import { agruparClases, idClase } from '../../../lib/turnos.js';
import Mensaje from '../../Mensaje.jsx';
import IconoPerfil from '../IconoPerfil.jsx';
import DetalleClase from './DetalleClase.jsx';
import FichaAlumnoProfesor from './FichaAlumnoProfesor.jsx';

export default function MisClases() {
  const sesion = useSesion();
  const [alumnos, setAlumnos] = useState([]);
  const [catalogoClases, setCatalogoClases] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [claseSeleccionadaId, setClaseSeleccionadaId] = useState(null);
  const [pestañaInicialDetalle, setPestañaInicialDetalle] = useState('alumnos');
  const [mostrarSolicitudes, setMostrarSolicitudes] = useState(false);
  const [seleccionSolicitud, setSeleccionSolicitud] = useState(null);

  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();

  // Carga de alumnos y catálogo de clases
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [datosAlumnos, datosCatalogo] = await Promise.all([
        apiFetch('/alumnos', { cache: 'no-store' }).then((r) =>
          leerRespuesta(r, 'No se pudieron cargar los alumnos.'),
        ),
        apiFetch('/clases/catalogo', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : { clases: [] }))
          .catch(() => ({ clases: [] })),
      ]);

      setAlumnos(datosAlumnos ?? []);
      const turnosPlanos = (datosCatalogo.clases ?? []).flatMap((c) => c.turnos ?? [c]);
      setCatalogoClases(turnosPlanos);
    } catch (error) {
      setAviso({ tipo: 'error', texto: error.message });
    } finally {
      setCargando(false);
    }
  }, [setAviso]);

  useEffect(() => {
    if (sesion?.perfil === 'profesor') {
      cargar();
    }
  }, [sesion, cargar]);

  // Guardar cambios en el seguimiento de un alumno (acciones como congelar, recuperar, etc.)
  async function guardarAlumno(id, datos) {
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
    if (ok) {
      setSeleccionSolicitud(null);
    }
  }

  // Agrupar clases del profesor
  const clasesDelProfesor = useMemo(() => {
    // 1. Clases donde hay alumnos asignados
    const mapaClases = new Map();

    for (const alumno of alumnos) {
      if (alumno.clase) {
        const id = alumno.clase.id;
        if (!mapaClases.has(id)) {
          mapaClases.set(id, {
            ...alumno.clase,
            alumnosIds: new Set([alumno.id]),
          });
        } else {
          mapaClases.get(id).alumnosIds.add(alumno.id);
        }
      }
    }

    // 2. Clases del catálogo que pertenezcan al profesor
    const nombreProfesor = alumnos[0]?.clase?.profesor ?? sesion?.usuario ?? '';
    for (const turno of catalogoClases) {
      const esDelProfesor =
        (turno.profesorId && sesion?.profesorId && turno.profesorId === sesion.profesorId) ||
        (turno.profesor &&
          nombreProfesor &&
          turno.profesor.trim().toLowerCase() === nombreProfesor.trim().toLowerCase());

      if (esDelProfesor && !mapaClases.has(turno.id)) {
        mapaClases.set(turno.id, {
          ...turno,
          alumnosIds: new Set(),
        });
      }
    }

    return Array.from(mapaClases.values());
  }, [alumnos, catalogoClases, sesion]);

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

  // Si hay una clase seleccionada, renderizamos el detalle de esa clase
  if (claseActiva) {
    return (
      <main className="perfil-page perfil-profesor-page space-y-4 px-4 pb-12 pt-4">
        <Mensaje aviso={aviso} />
        <DetalleClase
          clase={claseActiva}
          alumnosClase={alumnosClaseActiva}
          onVolver={() => setClaseSeleccionadaId(null)}
          ocupado={ocupado}
          guardarAlumno={guardarAlumno}
          recargarAlumnos={cargar}
          ejecutar={ejecutar}
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
      {/* Hero del profesor: Resumen general y acceso a solicitudes */}
      <header className="perfil-hero">
        <p className="perfil-eyebrow">ÁREA DEL PROFESOR</p>
        <h2 className="perfil-saludo">Mis clases</h2>

        <div className="perfil-resumen">
          <div>
            <strong>{cargando ? '—' : clasesDelProfesor.length}</strong>
            <span>{clasesDelProfesor.length === 1 ? 'Clase asignada' : 'Clases asignadas'}</span>
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
              <span>🔔</span>
              <span>
                {alumnosConSolicitudes.length}{' '}
                {alumnosConSolicitudes.length === 1 ? 'solicitud pendiente' : 'solicitudes'}
              </span>
            </button>
          )}
        </div>
      </header>

      <Mensaje aviso={aviso} />

      {/* Sección desplegable de solicitudes pendientes (si existen y se activan) */}
      {mostrarSolicitudes && alumnosConSolicitudes.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-amber-900 flex items-center gap-2">
              <span>🔔</span> Solicitudes pendientes de revisión
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
            {cargando ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>

        {cargando ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            Cargando tus clases asignadas…
          </div>
        ) : clasesDelProfesor.length === 0 ? (
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
            {clasesDelProfesor.map((clase) => {
              const cantidadAlumnos = clase.alumnosIds?.size ?? 0;
              const nombre = clase.turno || clase.claseNombre || clase.nivel;
              const dias = Array.isArray(clase.frecuencia)
                ? clase.frecuencia.join(', ')
                : clase.frecuencia;

              // Comprobar si esta clase tiene solicitudes pendientes
              const solicitudesClase = alumnos.filter(
                (a) =>
                  a.claseId === clase.id &&
                  a.seguimiento?.solicitudes?.some((s) => s.estado === 'pendiente'),
              ).length;

              return (
                <article
                  key={clase.id}
                  className="perfil-tarjeta rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-dojo-200 hover:shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-dojo-600">
                        {clase.sede || 'Sede por asignar'}
                      </span>
                      {solicitudesClase > 0 && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                          {solicitudesClase === 1
                            ? '1 solicitud'
                            : `${solicitudesClase} solicitudes`}
                        </span>
                      )}
                    </div>

                    <h4 className="text-lg font-extrabold text-gray-900 leading-snug">{nombre}</h4>

                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p className="font-medium">{dias || 'Días por confirmar'}</p>
                      <p className="text-gray-800 font-semibold">
                        {clase.horaInicio} – {clase.horaFin}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                        <IconoPerfil nombre="alumnos" size={14} />
                        {cantidadAlumnos}{' '}
                        {cantidadAlumnos === 1 ? 'alumno inscrito' : 'alumnos inscritos'}
                      </span>
                      {clase.cupos !== undefined && (
                        <span className="text-xs text-gray-500 font-medium">
                          Cupos: {clase.cupos}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPestañaInicialDetalle('alumnos');
                        setClaseSeleccionadaId(clase.id);
                      }}
                      className="flex-1 min-h-11 rounded-xl bg-dojo-600 px-3 py-2 text-xs font-bold text-white text-center hover:bg-dojo-700 transition-colors shadow-sm"
                    >
                      Ver alumnos ({cantidadAlumnos})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPestañaInicialDetalle('asistencia');
                        setClaseSeleccionadaId(clase.id);
                      }}
                      className="min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Asistencia
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
