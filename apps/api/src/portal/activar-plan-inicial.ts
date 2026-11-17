import { ConflictException } from '@nestjs/common';
import { aplicarComando, type PlanInicial, resumir } from '../alumnos/seguimiento.js';
import type { Libro } from './estructura.js';
import { numero } from './libro.js';
import { idTurnoInscripcion, leerClases } from './registros.js';
import { guardarSeguimiento, leerSeguimientos } from './seguimientos.js';

/** Se ejecuta dentro del mismo lote que crea la cuenta y, si corresponde, la inscripción. */
export function activarPlanInicial(
  l: Libro,
  id: number,
  plan: PlanInicial | undefined,
  usuario: string,
) {
  if (!plan) return { planActivado: false };
  const inscripcion = l.Inscripciones.find((i) => numero(i[0]) === id);
  const actual = leerSeguimientos(l).get(id);
  if (!inscripcion || !actual) throw new ConflictException('La inscripción ya no está disponible.');
  if (actual.plan)
    throw new ConflictException(
      'El alumno ya tiene un plan. Actualiza los datos para crear solo su acceso.',
    );
  const clase = leerClases(l).find((c) => c.id === idTurnoInscripcion(l, inscripcion));
  if (!clase || clase.estado !== 'Activa' || clase.configurado === false)
    throw new ConflictException(
      'Completa la sede y el profesor del turno antes de activar el plan.',
    );
  const siguiente = aplicarComando(
    actual,
    { accion: 'activarPlan', version: actual.version, ...plan },
    clase.frecuencia,
    undefined,
    usuario,
  );
  guardarSeguimiento(l, id, siguiente);
  return { planActivado: true, clasesPendientes: resumir(siguiente).pendientes };
}
