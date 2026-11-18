import IconoPerfil from '../IconoPerfil.jsx';
import { tarjeta, tituloTarjeta } from './estilos.js';
import { cambioProgramado, fechaVisible, pendientesAntesDelCambio, unidad } from './utilidades.js';

export default function ResumenPlan({ alumno }) {
  const s = alumno.seguimiento;
  if (!s.plan)
    return (
      <section className={tarjeta} aria-labelledby={`plan-${alumno.id}`}>
        <h2 id={`plan-${alumno.id}`} className={tituloTarjeta}>
          Mi plan
        </h2>
        <p className="mt-2 text-gray-700">
          Todavía no tienes un plan activo. Coordina con la administración del dojo para empezar tus
          clases.
        </p>
      </section>
    );

  const conSaldo = s.pagos
    .filter((p) => p.restantes > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const total = conSaldo.reduce((n, p) => n + p.cantidad, 0) || s.plan.cantidad;
  const porcentaje = Math.round((Math.min(s.pendientes, total) / total) * 100);
  const cambio = cambioProgramado(s);
  const pendientesAnteriores = pendientesAntesDelCambio(s);

  return (
    <section className={tarjeta} aria-labelledby={`plan-${alumno.id}`}>
      <h2 id={`plan-${alumno.id}`} className={tituloTarjeta}>
        <span className="perfil-icono">
          <IconoPerfil nombre="clase" />
        </span>
        Mi plan
      </h2>
      <div className="perfil-saldo-principal">
        <p className="perfil-saldo-numero">{s.pendientes}</p>
        <p className="pb-1 text-gray-700">
          {s.pendientes === 1 ? 'clase pendiente' : 'clases pendientes'}
          <span className="block text-sm text-gray-500">
            Plan de {s.plan.cantidad} clases · {s.plan.dias.join(', ')}
          </span>
        </p>
      </div>
      <div
        className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={s.pendientes}
        aria-label="Clases pendientes"
      >
        <div className="h-full rounded-full bg-dojo-600" style={{ width: `${porcentaje}%` }} />
      </div>

      {conSaldo.length > 1 && (
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {conSaldo.map((p) => (
            <li key={p.id}>
              {unidad(p.restantes, 'clase', 'clases')} del paquete activado el{' '}
              {fechaVisible(p.fecha)}
            </li>
          ))}
        </ul>
      )}

      {s.pendientes === 0 && (
        <p className="mt-3 font-semibold text-dojo-700">Sin clases pendientes.</p>
      )}

      {cambio && (
        <div className="mt-4 rounded-xl border border-dashed border-gray-400 p-3">
          <p className="text-sm font-bold text-gray-900">Cambio de plan programado</p>
          <p className="mt-1 text-sm text-gray-700">
            Tu próximo plan será de {cambio.cantidad} clases ({cambio.dias.join(', ')}).{' '}
            {pendientesAnteriores > 0
              ? `Empezará cuando termines ${pendientesAnteriores === 1 ? 'tu clase pendiente' : `tus ${pendientesAnteriores} clases pendientes`} del plan actual.`
              : 'Se aplicará en tu próxima renovación.'}
          </p>
        </div>
      )}
    </section>
  );
}
