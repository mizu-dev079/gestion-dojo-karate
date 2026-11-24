import { etiquetaTurno } from '../../../lib/clases.js';
import { chip, etiqueta } from '../../../lib/estilos.js';
import { primerNombre } from '../../../lib/seguimiento.js';
import IconoPerfil from '../IconoPerfil.jsx';

export default function Bienvenida({ alumno, children }) {
  const s = alumno.seguimiento;
  const estado = !s.plan
    ? { texto: 'Sin plan activo', estilo: etiqueta.neutro }
    : s.congelado
      ? { texto: 'Plan congelado', estilo: 'bg-white text-gray-900' }
      : { texto: 'Plan activo', estilo: etiqueta.activo };
  return (
    <header className="perfil-hero alumno-membresia">
      <p className="perfil-eyebrow">Tu entrenamiento</p>
      <h2 className="perfil-saludo">Hola, {primerNombre(alumno.nombre)}</h2>
      {alumno.clase && (
        <p className="mt-1 text-sm text-gray-300">
          {alumno.clase.nivel}
          {etiquetaTurno(alumno.clase) !== 'Horario' && ` · ${etiquetaTurno(alumno.clase)}`}
        </p>
      )}
      <div className="perfil-hero__pie">
        <span className={`${chip} ${estado.estilo}`}>{estado.texto}</span>
        <span className="perfil-hero__emblema">
          <IconoPerfil nombre="clase" size={32} />
        </span>
      </div>
      {children}
    </header>
  );
}
