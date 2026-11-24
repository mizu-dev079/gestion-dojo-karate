import { etiquetaTurno } from '../../../lib/clases.js';
import { tarjeta, tituloTarjeta } from '../../../lib/estilos.js';
import ImagenClase from '../../ImagenClase.jsx';

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
  const turno = etiquetaTurno(c) === 'Horario' ? '' : etiquetaTurno(c);
  const dias = alumno.seguimiento.plan?.dias?.length
    ? alumno.seguimiento.plan.dias
    : (c.frecuencia ?? []);
  const filas = [
    ['Turno', turno],
    ['Días', dias.join(', ')],
    ['Horario', c.horaInicio && c.horaFin ? `${c.horaInicio} a ${c.horaFin}` : ''],
    ['Profesor', c.profesor],
    ['Sede', c.sede],
  ].filter(([, valor]) => valor);
  return (
    <section
      id={`clase-${alumno.id}`}
      className={tarjeta}
      aria-labelledby={`titulo-clase-${alumno.id}`}
    >
      <div className="clase-cabecera">
        <div>
          <h2 id={`titulo-clase-${alumno.id}`} className={tituloTarjeta}>
            Mi clase
          </h2>
          <p className="mt-2 text-xl font-bold">{c.nivel}</p>
        </div>
        <ImagenClase nombre={c.nivel} compacta />
      </div>
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
