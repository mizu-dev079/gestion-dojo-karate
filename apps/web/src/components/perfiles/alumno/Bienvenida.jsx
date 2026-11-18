import { chip, etiqueta } from './estilos.js';
import { primerNombre } from './utilidades.js';

export default function Bienvenida({ alumno }) {
  const s = alumno.seguimiento;
  const estado = !s.plan
    ? { texto: 'Sin plan activo', estilo: etiqueta.neutro }
    : s.congelado
      ? { texto: 'Plan congelado', estilo: 'bg-white text-gray-900' }
      : { texto: 'Plan activo', estilo: etiqueta.activo };
  return (
    <header className="rounded-2xl bg-gray-900 p-5 text-white shadow-sm">
      <p className="text-sm text-gray-300">Bienvenido a tu dojo</p>
      <h2 className="mt-1 text-2xl font-bold">Hola, {primerNombre(alumno.nombre)}</h2>
      {alumno.clase && (
        <p className="mt-1 text-sm text-gray-300">{alumno.clase.turno ?? alumno.clase.nivel}</p>
      )}
      <span className={`${chip} ${estado.estilo} mt-3`}>{estado.texto}</span>
    </header>
  );
}
