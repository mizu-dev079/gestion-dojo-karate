import IconoPerfil from '../IconoPerfil.jsx';
import { tarjeta, tituloTarjeta } from './estilos.js';
import { cambioProgramado, pendientesAntesDelCambio, unidad } from './utilidades.js';

export default function ResumenPlan({ alumno }) {
  const s = alumno.seguimiento;
  if (!s.plan)
    return (
      <section className={tarjeta} aria-labelledby={`plan-${alumno.id}`}>
        <h2 id={`plan-${alumno.id}`} className={tituloTarjeta}>
          <span className="perfil-icono">
            <IconoPerfil nombre="clase" />
          </span>
          Mis clases
        </h2>
        <p className="mt-3 text-gray-700">Aún no tienes un plan activo.</p>
      </section>
    );

  const cambio = cambioProgramado(s);
  const actuales = pendientesAntesDelCambio(s);
  const siguientes = cambio ? Math.max(0, s.pendientes - actuales) : 0;
  const renovaciones = s.pagos.filter((p) => p.restantes > 0).length;

  return (
    <section className={tarjeta} aria-labelledby={`plan-${alumno.id}`}>
      <h2 id={`plan-${alumno.id}`} className={tituloTarjeta}>
        <span className="perfil-icono">
          <IconoPerfil nombre="clase" />
        </span>
        Mis clases
      </h2>
      <div className="perfil-saldo-principal">
        <p className="perfil-saldo-numero">{s.pendientes}</p>
        <p className="pb-1 text-gray-700">
          {s.pendientes === 1 ? 'clase disponible' : 'clases disponibles'}
          <span className="block text-sm text-gray-500">en total</span>
        </p>
      </div>

      {cambio ? (
        <ol className="perfil-plan-etapas" aria-label="Orden de tus clases">
          {actuales > 0 && (
            <li>
              <span className="perfil-plan-paso" aria-hidden="true">
                1
              </span>
              <div>
                <h3>Primero</h3>
                <p className="perfil-plan-clases">
                  <strong>{unidad(actuales, 'clase', 'clases')}</strong> de tu plan actual
                </p>
              </div>
            </li>
          )}
          <li>
            <span className="perfil-plan-paso" aria-hidden="true">
              {actuales > 0 ? '2' : '1'}
            </span>
            <div>
              <h3>{actuales > 0 ? 'Después' : 'Próximo plan'}</h3>
              <p className="perfil-plan-clases">
                <strong>{unidad(siguientes || cambio.cantidad, 'clase', 'clases')}</strong> de tu
                nuevo plan
              </p>
              <span className="perfil-plan-nota">
                {siguientes > 0 ? 'Ya incluidas en el total' : 'Se añaden al renovar'}
              </span>
            </div>
          </li>
        </ol>
      ) : (
        <div className="perfil-plan-vigente">
          <IconoPerfil nombre="clase" />
          <div>
            <p className="font-semibold text-gray-900">Plan de {s.plan.cantidad} clases</p>
            {renovaciones > 1 && (
              <p className="mt-1 text-sm text-gray-600">Incluye las clases de tu renovación.</p>
            )}
            {s.pendientes === 0 && (
              <p className="mt-1 text-sm text-gray-600">Coordina la renovación con el dojo.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
