import { useState } from 'react';
import {
  botonPrincipal,
  botonSecundario,
  campo,
  chip,
  etiqueta,
  tarjeta,
  tituloTarjeta,
} from './estilos.js';
import {
  congelamientoActual,
  desplazar,
  fechaVisible,
  solicitudPendiente,
  ultimaSolicitud,
} from './utilidades.js';

const estados = {
  pendiente: { texto: 'Pendiente de revisión', estilo: etiqueta.neutro },
  aprobada: { texto: 'Aprobada', estilo: etiqueta.oscuro },
  rechazada: { texto: 'Rechazada', estilo: etiqueta.activo },
};

function Solicitud({ solicitud }) {
  const estado = estados[solicitud.estado] ?? estados.pendiente;
  return (
    <div className="mt-3 rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">Solicitud del {fechaVisible(solicitud.fecha)}</span>
        <span className={`${chip} ${estado.estilo}`}>{estado.texto}</span>
      </div>
      <p className="mt-2 text-sm text-gray-700">Motivo: {solicitud.motivo}</p>
      <p className="text-sm text-gray-700">
        {solicitud.hasta
          ? `Regreso solicitado: ${fechaVisible(solicitud.hasta)}`
          : 'Sin fecha de regreso'}
      </p>
      {solicitud.respuesta && (
        <p className="mt-1 text-sm text-gray-700">Respuesta: {solicitud.respuesta}</p>
      )}
    </div>
  );
}

export default function Congelamiento({ alumno, hoy, ocupado, enviar }) {
  const [abierto, setAbierto] = useState(false);
  const s = alumno.seguimiento;
  if (!s.plan) return null;
  const pausa = congelamientoActual(s, hoy);
  const pendiente = solicitudPendiente(s);
  const ultima = ultimaSolicitud(s);
  const puedeSolicitar = !pausa && !pendiente && alumno.clase;

  async function solicitar(e) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const ok = await enviar(
      alumno,
      {
        accion: 'solicitarCongelamiento',
        motivo: String(datos.get('motivo') ?? '').trim(),
        hasta: datos.get('hasta') || null,
      },
      'Solicitud enviada.',
    );
    if (ok) setAbierto(false);
  }

  return (
    <section className={tarjeta} aria-labelledby={`congelamiento-${alumno.id}`}>
      <h2 id={`congelamiento-${alumno.id}`} className={tituloTarjeta}>
        Congelamiento del plan
      </h2>

      {pausa ? (
        <div className="mt-3 rounded-xl bg-gray-900 p-4 text-white">
          <p className="font-bold">Tu plan está congelado</p>
          <p className="mt-1 text-sm text-gray-200">
            Desde el {fechaVisible(pausa.desde)}.{' '}
            {pausa.hasta ? `Regresas el ${fechaVisible(pausa.hasta)}.` : 'Sin fecha de regreso.'}
          </p>
          <p className="mt-1 text-sm text-gray-200">Conservas tu cupo y tus clases pendientes.</p>
        </div>
      ) : null}

      {pendiente ? (
        <Solicitud solicitud={pendiente} />
      ) : (
        ultima && ultima.estado !== 'pendiente' && <Solicitud solicitud={ultima} />
      )}

      {puedeSolicitar && !abierto && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => setAbierto(true)}
          className={`${botonSecundario} mt-3`}
        >
          Solicitar congelamiento
        </button>
      )}

      {puedeSolicitar && abierto && (
        <form onSubmit={solicitar} className="mt-3 space-y-4 rounded-xl bg-dojo-50 p-4">
          <fieldset disabled={ocupado} className="space-y-4">
            <label className="block text-sm font-semibold">
              Motivo
              <textarea
                name="motivo"
                required
                maxLength={300}
                rows={3}
                placeholder="Por ejemplo: viaje familiar"
                className={campo}
              />
            </label>
            <label className="block text-sm font-semibold">
              Fecha de regreso (opcional)
              <input name="hasta" type="date" min={desplazar(hoy, 1)} className={campo} />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" className={botonPrincipal}>
                {ocupado ? 'Enviando…' : 'Enviar solicitud'}
              </button>
              <button type="button" onClick={() => setAbierto(false)} className={botonSecundario}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
