import { tarjeta, tituloTarjeta } from './estilos.js';

export default function MiClase({ alumno }) {
  const c = alumno.clase;
  if (!c)
    return (
      <section id={`clase-${alumno.id}`} className={tarjeta}>
        <h2 className={tituloTarjeta}>Mi clase</h2>
        <p className="mt-2 text-gray-700">
          Tu clase ya no está disponible. Consulta con la administración del dojo.
        </p>
      </section>
    );
  const turno = c.turno?.includes('·') ? c.turno.split('·').at(-1).trim() : c.turno;
  const dias = alumno.seguimiento.plan?.dias?.length
    ? alumno.seguimiento.plan.dias
    : (c.frecuencia ?? []);
  const filas = [
    ['Clase', c.nivel],
    ['Turno', turno],
    ['Días', dias.join(', ')],
    ['Horario', c.horaInicio && c.horaFin ? `${c.horaInicio} a ${c.horaFin}` : ''],
    ['Profesor', c.profesor],
    ['Sede', c.sede],
  ].filter(([, valor]) => valor);
  return (
    <section id={`clase-${alumno.id}`} className={tarjeta} aria-labelledby={`clase-${alumno.id}`}>
      <h2 id={`clase-${alumno.id}`} className={tituloTarjeta}>
        Mi clase
      </h2>
      <dl className="mt-3 divide-y divide-gray-100">
        {filas.map(([nombre, valor]) => (
          <div key={nombre} className="flex justify-between gap-4 py-2">
            <dt className="text-sm text-gray-500">{nombre}</dt>
            <dd className="text-right font-semibold text-gray-900">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
