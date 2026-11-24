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
      <div className="clase-horario">
        <p>
          {c.horaInicio && c.horaFin ? `${c.horaInicio} – ${c.horaFin}` : 'Horario por confirmar'}
        </p>
        <span>{dias.join(', ')}</span>
        {turno && <span className="clase-horario__turno">{turno}</span>}
      </div>
      {filas.length > 0 && (
        <details className="ficha-detalles">
          <summary>Profesor y sede</summary>
          <dl>
            {filas.map(([nombre, valor]) => (
              <div key={nombre}>
                <dt>{nombre}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
