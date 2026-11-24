import { useState } from 'react';
import { tarjeta } from '../../../lib/estilos.js';
import {
  estadoAsistencia,
  fechaVisible,
  limiteRecuperaciones,
  recuperacionesDelPaquete,
} from '../../../lib/seguimiento.js';

const CANTIDAD_INICIAL = 10;

function Bloque({ titulo, vacio, children, cantidad }) {
  return (
    <div className="pt-4">
      <h3 className="text-sm font-bold text-gray-900">{titulo}</h3>
      {cantidad ? (
        <ul className="mt-2 divide-y divide-gray-100 text-sm">{children}</ul>
      ) : (
        <p className="mt-1 text-sm text-gray-600">{vacio}</p>
      )}
    </div>
  );
}

const Fila = ({ izquierda, derecha }) => (
  <li className="flex justify-between gap-3 py-2">
    <span className="text-gray-600">{izquierda}</span>
    <span className="text-right font-semibold text-gray-900">{derecha}</span>
  </li>
);

export default function HistorialAlumno({ alumno }) {
  const [todo, setTodo] = useState(false);
  const s = alumno.seguimiento;
  if (!s.plan && !s.pagos.length && !s.asistencias.length) return null;
  const asistencias = [...s.asistencias].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const visibles = todo ? asistencias : asistencias.slice(0, CANTIDAD_INICIAL);
  const paquetes = [...s.pagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const recuperaciones = [...s.recuperaciones].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const congelamientos = [...s.congelamientos].sort((a, b) => b.desde.localeCompare(a.desde));
  const solicitudes = [...s.solicitudes].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <details className={`${tarjeta} group`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-bold text-gray-900">
        Ver mi historial
        <span aria-hidden="true" className="text-dojo-600 transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="divide-y divide-gray-100">
        <Bloque titulo="Asistencia" vacio="Sin registros." cantidad={asistencias.length}>
          {visibles.map((a) => (
            <Fila
              key={a.fecha}
              izquierda={fechaVisible(a.fecha)}
              derecha={`${estadoAsistencia[a.estado] ?? a.estado}${
                s.recuperaciones.some((r) => r.fecha === a.fecha && !r.revocada)
                  ? ' · recuperación'
                  : ''
              }`}
            />
          ))}
        </Bloque>
        {asistencias.length > CANTIDAD_INICIAL && (
          <button
            type="button"
            onClick={() => setTodo((v) => !v)}
            className="min-h-11 w-full text-sm font-semibold text-dojo-700"
          >
            {todo ? 'Mostrar menos' : `Mostrar todo (${asistencias.length})`}
          </button>
        )}
        <Bloque titulo="Paquetes de clases" vacio="Sin paquetes." cantidad={paquetes.length}>
          {paquetes.map((p) => (
            <Fila
              key={p.id}
              izquierda={`Activado el ${fechaVisible(p.fecha)}`}
              derecha={`${p.restantes} de ${p.cantidad} pendientes · ${
                recuperacionesDelPaquete(s, p).usadas
              }/${limiteRecuperaciones(p)} recup.`}
            />
          ))}
        </Bloque>
        <Bloque
          titulo="Recuperaciones"
          vacio="Sin recuperaciones."
          cantidad={recuperaciones.length}
        >
          {recuperaciones.map((r) => (
            <Fila
              key={r.id}
              izquierda={`Falta del ${fechaVisible(r.fecha)}`}
              derecha={r.revocada ? 'Revocada' : 'Autorizada'}
            />
          ))}
        </Bloque>
        <Bloque
          titulo="Congelamientos"
          vacio="Sin congelamientos."
          cantidad={congelamientos.length}
        >
          {congelamientos.map((c) => (
            <Fila
              key={c.id}
              izquierda={`Desde el ${fechaVisible(c.desde)}`}
              derecha={
                c.reactivado
                  ? `Reactivado el ${fechaVisible(c.reactivado)}`
                  : c.hasta
                    ? `Hasta el ${fechaVisible(c.hasta)}`
                    : 'Sin fecha de regreso'
              }
            />
          ))}
        </Bloque>
        <Bloque
          titulo="Solicitudes de congelamiento"
          vacio="Sin solicitudes."
          cantidad={solicitudes.length}
        >
          {solicitudes.map((r) => (
            <Fila
              key={r.id}
              izquierda={fechaVisible(r.fecha)}
              derecha={
                { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' }[
                  r.estado
                ] ?? r.estado
              }
            />
          ))}
        </Bloque>
      </div>
    </details>
  );
}
