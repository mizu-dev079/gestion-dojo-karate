import { chip, etiqueta, tarjeta, tituloTarjeta } from '../../../lib/estilos.js';
import {
  fechaVisible,
  paqueteActual,
  recuperacionesDelPaquete,
  unidad,
} from '../../../lib/seguimiento.js';

export default function Recuperaciones({ alumno }) {
  const s = alumno.seguimiento;
  if (!s.plan) return null;
  const paquete = paqueteActual(s);
  const { limite, usadas, disponibles } = recuperacionesDelPaquete(s, paquete);
  const autorizadas = s.recuperaciones
    .filter((r) => !r.revocada)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <section className={tarjeta} aria-labelledby={`recuperaciones-${alumno.id}`}>
      <h2 id={`recuperaciones-${alumno.id}`} className={tituloTarjeta}>
        Recuperaciones
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-3xl font-bold text-gray-900">{disponibles}</p>
          <p className="text-sm text-gray-600">disponibles</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-3xl font-bold text-gray-900">{usadas}</p>
          <p className="text-sm text-gray-600">autorizadas</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        Tu paquete de {paquete?.cantidad ?? s.plan.cantidad} clases permite{' '}
        {unidad(limite, 'recuperación', 'recuperaciones')}.
      </p>

      {autorizadas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {autorizadas.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Falta del {fechaVisible(r.fecha)}</span>
                <span className={`${chip} ${etiqueta.suave}`}>Autorizada</span>
              </div>
              {r.motivo && <p className="mt-1 text-sm text-gray-500">Motivo: {r.motivo}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
