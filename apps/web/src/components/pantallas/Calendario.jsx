import { useCallback, useEffect, useState } from 'react';
import { useSesion } from '../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import SelectorFechaAsistencia from '../SelectorFechaAsistencia.jsx';
import Asistencia from './Asistencia.jsx';

const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
function CalendarioAlumno() {
  const [fecha, setFecha] = useState(hoy);
  const [alumnos, setAlumnos] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setAlumnos(
        await leerRespuesta(
          await apiFetch('/alumnos', { cache: 'no-store' }),
          'No se pudo cargar tu asistencia.',
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  return (
    <main className="space-y-4 p-4">
      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">Mi asistencia</h2>
        <SelectorFechaAsistencia fecha={fecha} cambiar={setFecha} disabled={cargando} />
        <button
          type="button"
          disabled={cargando}
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
          const s = alumno.seguimiento;
          const asistencia = s.asistencias.find((a) => a.fecha === fecha);
          const pausa = s.congelamientos.some(
            (c) =>
              c.desde <= fecha &&
              (!c.hasta || fecha < c.hasta) &&
              (!c.reactivado || fecha < c.reactivado),
          );
          const etiqueta = asistencia
            ? { presente: 'Presente', falta: 'Faltó', avisada: 'Ausencia avisada' }[
                asistencia.estado
              ]
            : pausa
              ? 'Plan congelado'
              : 'Sin asistencia registrada';
          return (
            <section
              key={alumno.id}
              className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4"
            >
              <h3 className="font-bold">{alumno.nombre}</h3>
              <p className="text-sm text-gray-600">
                {alumno.clase?.turno ?? alumno.clase?.nivel ?? 'Clase asignada'}
              </p>
              <p className="font-semibold text-dojo-700">{etiqueta}</p>
            </section>
          );
        })
      )}
    </main>
  );
}
export default function Calendario() {
  const sesion = useSesion();
  if (!sesion) return <p className="p-4">Cargando tu perfil…</p>;
  return sesion.perfil === 'alumno' ? <CalendarioAlumno /> : <Asistencia calendario />;
}
