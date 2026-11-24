import { useEffect, useMemo, useState } from 'react';
import { etiquetaTurno } from '../../../lib/clases.js';
import ImagenClase from '../../ImagenClase.jsx';
import AsistenciaProfesor from './AsistenciaProfesor.jsx';
import BusquedaAlumnos from './BusquedaAlumnos.jsx';
import FichaAlumnoProfesor from './FichaAlumnoProfesor.jsx';

export default function DetalleClase({
  clase,
  alumnosClase,
  onVolver,
  ocupado,
  guardarAlumno,
  recargarAlumnos,
  pestañaInicial = 'alumnos',
  cambiarPestaña,
  setFormularioAbierto,
}) {
  const [pestaña, setPestaña] = useState(pestañaInicial);
  useEffect(() => setPestaña(pestañaInicial), [pestañaInicial]);
  const elegirPestaña = (valor) => {
    setPestaña(valor);
    cambiarPestaña?.(valor);
  };
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState(null);
  useEffect(() => {
    setFormularioAbierto?.(Boolean(seleccion));
    return () => setFormularioAbierto?.(false);
  }, [seleccion, setFormularioAbierto]);

  // Filtrado de alumnos por búsqueda
  const alumnosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    if (!termino) return alumnosClase;
    return alumnosClase.filter((a) => a.nombre.toLocaleLowerCase('es').includes(termino));
  }, [alumnosClase, busqueda]);

  const nombreClase = clase.claseNombre || clase.nivel;
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
        <ImagenClase nombre={nombreClase} compacta />
        <p className="perfil-eyebrow">{clase.sede || 'SEDE POR ASIGNAR'}</p>
        <h2 className="perfil-saludo break-words">{nombreClase}</h2>
        {etiquetaTurno(clase) !== 'Horario' && (
          <p className="mt-2 font-semibold">{etiquetaTurno(clase)}</p>
        )}
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
          onClick={() => elegirPestaña('alumnos')}
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
          onClick={() => elegirPestaña('asistencia')}
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

      {pestaña === 'asistencia' && (
        <AsistenciaProfesor claseId={clase.id} incrustada recargarAlumnos={recargarAlumnos} />
      )}
    </div>
  );
}
