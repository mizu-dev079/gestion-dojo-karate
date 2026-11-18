import { useState } from 'react';
import ConfirmarAccion from '../../ConfirmarAccion.jsx';
import { botonSecundario, enlace, tarjeta, tituloTarjeta } from './estilos.js';
import {
  avisosVigentes,
  congelamientoActual,
  desplazar,
  diaSemana,
  estadoAsistencia,
  fechaVisible,
  proximoEntrenamiento,
} from './utilidades.js';

function nombreDia(fecha, hoy) {
  if (fecha === hoy) return 'Hoy';
  if (fecha === desplazar(hoy, 1)) return 'Mañana';
  return diaSemana(fecha);
}

const sinProximo = {
  'sin-clase': 'Sin turno activo asignado.',
  'sin-sesiones': 'No se pudo consultar el horario. Intenta actualizar los datos.',
  'sin-clases': 'No tienes clases pendientes. Coordina la renovación con la administración.',
  congelado: 'Tu plan está congelado. Volverás a ver tu próximo entrenamiento al reactivarse.',
  'sin-dias': 'Tu plan no tiene días asignados. Consulta con la administración.',
  'sin-fecha': 'No encontramos un próximo entrenamiento con tus datos actuales.',
};

export default function MiAsistencia({ alumno, hoy, hora, ocupado, aviso, enviar, sesiones }) {
  const [confirmar, setConfirmar] = useState(null);
  const s = alumno.seguimiento;
  if (!s.plan) return null;
  const proximo = proximoEntrenamiento(alumno, hoy, hora, sesiones);
  const avisos = avisosVigentes(s, hoy).filter(
    (a) => !s.recuperaciones.some((r) => r.fecha === a.fecha && !r.revocada),
  );
  const recientes = s.asistencias
    .filter((a) => a.fecha <= hoy && a.estado !== 'avisada')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 3);
  const pausa = congelamientoActual(s, hoy);

  async function avisar() {
    if (confirmar !== proximoEntrenamiento(alumno, hoy, hora, sesiones).fecha) {
      setConfirmar(null);
      return;
    }
    const ok = await enviar(
      alumno,
      { accion: 'asistencia', fecha: confirmar, estado: 'avisada' },
      `Ausencia avisada para el ${fechaVisible(confirmar)}.`,
    );
    if (ok) setConfirmar(null);
  }

  return (
    <section className={tarjeta} aria-labelledby={`asistencia-${alumno.id}`}>
      <h2 id={`asistencia-${alumno.id}`} className={tituloTarjeta}>
        Próximo entrenamiento
      </h2>
      {proximo.fecha ? (
        <div className="mt-3 rounded-xl bg-gray-50 p-4">
          <p className="text-xl font-bold text-gray-900">
            {nombreDia(proximo.fecha, hoy)}{' '}
            <span className="font-semibold text-gray-600">{fechaVisible(proximo.fecha)}</span>
          </p>
          {alumno.clase && (
            <p className="mt-1 text-gray-700">
              {alumno.clase.horaInicio} a {alumno.clase.horaFin}
              {alumno.clase.sede ? ` · ${alumno.clase.sede}` : ''}
            </p>
          )}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setConfirmar(proximo.fecha)}
            className={`${botonSecundario} mt-3`}
          >
            No podré ir
          </button>
        </div>
      ) : (
        <p className="mt-2 text-gray-700">
          {proximo.motivo === 'congelado' && pausa?.hasta
            ? `Tu plan está congelado hasta el ${fechaVisible(pausa.hasta)}.`
            : sinProximo[proximo.motivo]}
        </p>
      )}

      {avisos.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-gray-900">Ausencias que avisaste</h3>
          <ul className="mt-2 space-y-2">
            {avisos.map((a) => (
              <li
                key={a.fecha}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
              >
                <span>
                  {nombreDia(a.fecha, hoy)} {fechaVisible(a.fecha)}
                </span>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    enviar(
                      alumno,
                      { accion: 'retirarAviso', fecha: a.fecha },
                      `Aviso retirado. Te esperamos el ${fechaVisible(a.fecha)}.`,
                    )
                  }
                  className="min-h-11 shrink-0 font-semibold text-dojo-700 disabled:opacity-50"
                >
                  Retirar aviso
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-sm font-bold text-gray-900">Asistencia reciente</h3>
        {recientes.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {recientes.map((a) => (
              <li key={a.fecha} className="flex justify-between gap-3">
                <span className="text-gray-600">{fechaVisible(a.fecha)}</span>
                <span
                  className={
                    a.estado === 'presente' ? 'font-semibold' : 'font-semibold text-dojo-700'
                  }
                >
                  {estadoAsistencia[a.estado]}
                  {s.recuperaciones.some((r) => r.fecha === a.fecha && !r.revocada) &&
                    ' · con recuperación'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-600">Aún no hay asistencias registradas.</p>
        )}
      </div>

      <a href="/calendario" className={`${enlace} mt-2`}>
        Ver mi calendario de asistencia
      </a>

      {confirmar && (
        <ConfirmarAccion
          titulo="¿Avisar tu ausencia?"
          ocupado={ocupado}
          aviso={aviso}
          onCancelar={() => setConfirmar(null)}
          onConfirmar={avisar}
          textoConfirmar="Avisar ausencia"
          textoOcupado="Avisando…"
        >
          <p>
            Avisarás que no irás el {diaSemana(confirmar).toLowerCase()} {fechaVisible(confirmar)}.
          </p>
        </ConfirmarAccion>
      )}
    </section>
  );
}
